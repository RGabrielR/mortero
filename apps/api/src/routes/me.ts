import { and, asc, eq, sql } from "drizzle-orm";
import { mailEnabled } from "../mail.js";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { ageFrom, imageUrl, newId, requireProfile, requireUser, type AppEnv } from "../lib.js";
import { syncGroupRoom } from "../realtime.js";
import { deleteImage, MAX_UPLOAD_BYTES, readImage, saveImage } from "../storage.js";
import { googleEnabled } from "../auth.js";
import { hasAlbumAccess } from "./premium.js";
import { isAdminEmail } from "./admin.js";
import { APP_NAME } from "../brand.js";

const { profile, photo, user, group, groupMember, directMessage, conversation } = schema;
const MAX_PHOTOS = 6;

const shortText = z.string().trim().max(60);
const profileInput = z.object({
  displayName: z.string().trim().min(1, "Poné un nombre").max(40),
  birthdate: z.iso.date().optional(),
  about: z.string().trim().max(500).nullish(),
  heightCm: z.number().int().min(120).max(230).nullish(),
  weightKg: z.number().int().min(35).max(250).nullish(),
  bodyType: shortText.nullish(),
  position: shortText.nullish(),
  tribes: z.array(shortText).max(10).default([]),
  lookingFor: z.array(shortText).max(10).default([]),
  relationship: shortText.nullish(),
  pronouns: shortText.nullish(),
  hivStatus: shortText.nullish(),
  lastTested: z.iso.date().nullish(),
});

export const meRoutes = new Hono<AppEnv>();

// Config pública: qué métodos de login hay
// passwordReset: sin mails configurados no ofrecemos recuperar la contraseña (en desarrollo sí: el mail sale por consola)
meRoutes.get("/config", (c) => c.json({ google: googleEnabled, passwordReset: mailEnabled || process.env.NODE_ENV !== "production" }));

// Archivos: solo para gente con sesión, así no se pueden scrapear las fotos desde afuera
meRoutes.get("/files/:key", requireUser, async (c) => {
  const key = c.req.param("key");
  const viewer = c.get("user").id;
  // Foto de álbum privado: solo dueño o gente con acceso
  const [ph] = await db.select().from(photo).where(eq(photo.key, key));
  if (ph?.isPrivate && !(await hasAlbumAccess(ph.userId, viewer))) return c.notFound();
  // Foto de mensaje privado: solo las dos personas de la charla; si es temporal, solo quien la recibe tras abrirla
  const [dm] = await db.select().from(directMessage).where(eq(directMessage.photoKey, key));
  if (dm) {
    const [conv] = await db.select().from(conversation).where(eq(conversation.id, dm.conversationId));
    const inConv = conv && (conv.userA === viewer || conv.userB === viewer);
    if (!inConv) return c.notFound();
    if (dm.expiring && (dm.senderId === viewer || !dm.openedAt)) return c.notFound();
  }
  const buf = await readImage(key, c.req.query("s") === "thumb");
  if (!buf) return c.notFound();
  return c.body(new Uint8Array(buf), 200, {
    "Content-Type": "image/webp",
    // Las privadas no se cachean, así revocar el acceso tiene efecto
    "Cache-Control": ph?.isPrivate || dm?.expiring ? "no-store" : "private, max-age=31536000, immutable",
  });
});

meRoutes.get("/me", requireUser, async (c) => {
  const u = c.get("user");
  const p = c.get("profile");
  const photos = await db.select().from(photo).where(eq(photo.userId, u.id)).orderBy(asc(photo.position));
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, isAdmin: isAdminEmail(u.email) },
    profile: p
      ? (() => {
          const { cellLat, cellLng, ...rest } = p;
          // A la propia persona solo le decimos si tiene ubicación, no la celda
          return { ...rest, age: ageFrom(p.birthdate), hasLocation: cellLat != null && cellLng != null };
        })()
      : null,
    photos: photos.map((x) => ({ id: x.id, url: imageUrl(x.key), position: x.position, isPrivate: x.isPrivate })),
  });
});

meRoutes.put("/me/profile", requireUser, async (c) => {
  const u = c.get("user");
  const existing = c.get("profile");
  const parsed = profileInput.safeParse(await c.req.json());
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0].message });
  const data = parsed.data;

  if (!existing) {
    // Alta del perfil: acá se verifica la edad
    if (!data.birthdate) throw new HTTPException(400, { message: "Falta la fecha de nacimiento" });
    if (ageFrom(data.birthdate) < 18) throw new HTTPException(403, { message: `${APP_NAME} es solo para mayores de 18` });
    await db.insert(profile).values({ ...data, birthdate: data.birthdate, userId: u.id });
    // Todo el mundo entra al chat general
    const [general] = await db.select().from(group).where(eq(group.isGeneral, true));
    if (general) {
      await db.insert(groupMember).values({ groupId: general.id, userId: u.id }).onConflictDoNothing();
      syncGroupRoom(u.id, general.id, true);
    }
  } else {
    // La fecha de nacimiento no se puede cambiar después del alta
    const { birthdate: _ignored, ...rest } = data;
    await db.update(profile).set({ ...rest, updatedAt: new Date() }).where(eq(profile.userId, u.id));
  }
  return c.json({ ok: true });
});

meRoutes.post("/me/photos", requireUser, requireProfile, async (c) => {
  const u = c.get("user");
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) throw new HTTPException(400, { message: "Falta la foto" });
  if (file.size > MAX_UPLOAD_BYTES) throw new HTTPException(413, { message: "La foto pesa demasiado (máx. 12 MB)" });
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(photo).where(eq(photo.userId, u.id));
  if (n >= MAX_PHOTOS) throw new HTTPException(400, { message: `Podés tener hasta ${MAX_PHOTOS} fotos` });
  let key: string;
  try {
    key = await saveImage(await file.arrayBuffer());
  } catch {
    throw new HTTPException(400, { message: "No pudimos leer esa imagen" });
  }
  const id = newId();
  const isPrivate = body.private === "1";
  await db.insert(photo).values({ id, userId: u.id, key, position: n, isPrivate });
  return c.json({ id, url: imageUrl(key), position: n, isPrivate });
});

/** Pasar una foto al álbum privado o sacarla. */
meRoutes.patch("/me/photos/:id", requireUser, async (c) => {
  const u = c.get("user");
  const { isPrivate } = z.object({ isPrivate: z.boolean() }).parse(await c.req.json());
  const [row] = await db
    .update(photo)
    .set({ isPrivate })
    .where(and(eq(photo.id, c.req.param("id")), eq(photo.userId, u.id)))
    .returning();
  if (!row) return c.notFound();
  return c.json({ ok: true });
});

meRoutes.delete("/me/photos/:id", requireUser, async (c) => {
  const u = c.get("user");
  const [row] = await db
    .delete(photo)
    .where(and(eq(photo.id, c.req.param("id")), eq(photo.userId, u.id)))
    .returning();
  if (!row) return c.notFound();
  await deleteImage(row.key);
  // Reordenar las que quedan
  const rest = await db.select().from(photo).where(eq(photo.userId, u.id)).orderBy(asc(photo.position));
  for (const [i, p] of rest.entries()) {
    if (p.position !== i) await db.update(photo).set({ position: i }).where(eq(photo.id, p.id));
  }
  return c.json({ ok: true });
});

meRoutes.put("/me/photos/order", requireUser, async (c) => {
  const u = c.get("user");
  const ids = z.array(z.string()).parse(await c.req.json());
  const mine = await db.select().from(photo).where(eq(photo.userId, u.id));
  const valid = new Set(mine.map((p) => p.id));
  if (ids.length !== mine.length || !ids.every((id) => valid.has(id))) {
    throw new HTTPException(400, { message: "Orden inválido" });
  }
  for (const [i, id] of ids.entries()) await db.update(photo).set({ position: i }).where(eq(photo.id, id));
  return c.json({ ok: true });
});

/** Borra la cuenta y todo lo asociado. No se puede deshacer. */
meRoutes.delete("/me", requireUser, async (c) => {
  const u = c.get("user");
  const photos = await db.select().from(photo).where(eq(photo.userId, u.id));
  const dmPhotos = await db.select().from(directMessage).where(eq(directMessage.senderId, u.id));
  await db.delete(user).where(eq(user.id, u.id)); // en cascada: perfil, fotos, mensajes, sesiones, etc.
  for (const p of photos) await deleteImage(p.key);
  for (const m of dmPhotos) if (m.photoKey) await deleteImage(m.photoKey);
  return c.json({ ok: true });
});
