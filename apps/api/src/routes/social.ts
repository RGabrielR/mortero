import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import {
  ageFrom, authorsFor, imageUrl, isBlocked, newId, requireProfile, requireUser, type AppEnv,
} from "../lib.js";
import { emitToUser, isOnline } from "../realtime.js";
import { distanceKm, distanceLabel } from "../geo.js";
import { deleteImage, MAX_UPLOAD_BYTES, saveImage } from "../storage.js";
import { hasAlbumAccess, recordView } from "./premium.js";
import { pushTo } from "../push.js";
import { APP_NAME } from "../brand.js";

const { profile, photo, block, report, conversation, directMessage } = schema;

export const socialRoutes = new Hono<AppEnv>();
for (const p of ["/users/*", "/conversations", "/conversations/*", "/blocks", "/blocks/*", "/reports"]) {
  socialRoutes.use(p, requireUser, requireProfile);
}

// ---------- Perfiles de otras personas ----------

socialRoutes.get("/users/:id", async (c) => {
  const me = c.get("user");
  const id = c.req.param("id");
  if (id !== me.id && (await isBlocked(me.id, id))) return c.notFound();
  const [p] = await db.select().from(profile).where(eq(profile.userId, id));
  if (!p || (p.suspendedAt && id !== me.id)) return c.notFound();
  const allPhotos = await db.select().from(photo).where(eq(photo.userId, id)).orderBy(asc(photo.position));
  const photos = allPhotos.filter((x) => !x.isPrivate);
  const privatePhotos = allPhotos.filter((x) => x.isPrivate);
  const albumAccess = privatePhotos.length > 0 && (await hasAlbumAccess(id, me.id));
  // Lista explícita de campos públicos: nunca la fecha de nacimiento ni la celda de ubicación
  const mine = c.get("profile")!;
  await recordView(me.id, mine.incognito, id);
  const canShowDistance =
    id !== me.id && p.showDistance && mine.showDistance &&
    p.cellLat != null && p.cellLng != null && mine.cellLat != null && mine.cellLng != null;
  // En incógnito no se muestra si estás en línea
  const on = !p.incognito && isOnline(id);
  const [fav] = await db.select().from(schema.favorite)
    .where(and(eq(schema.favorite.userId, me.id), eq(schema.favorite.favoriteId, id)));
  const [shared] = await db.select().from(schema.albumGrant)
    .where(and(eq(schema.albumGrant.ownerId, me.id), eq(schema.albumGrant.granteeId, id)));
  return c.json({
    id,
    displayName: p.displayName,
    age: ageFrom(p.birthdate),
    about: p.about,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    bodyType: p.bodyType,
    position: p.position,
    tribes: p.tribes,
    lookingFor: p.lookingFor,
    relationship: p.relationship,
    pronouns: p.pronouns,
    hivStatus: p.hivStatus,
    lastTested: p.lastTested,
    photos: photos.map((x) => imageUrl(x.key)),
    isMe: id === me.id,
    online: on,
    recent: !p.incognito && (on || Date.now() - p.lastSeenAt.getTime() < 15 * 60_000),
    favorite: Boolean(fav),
    // Álbum privado: cuántas fotos hay y, si te lo compartieron, las fotos
    privateAlbum: privatePhotos.length
      ? { count: privatePhotos.length, photos: albumAccess ? privatePhotos.map((x) => imageUrl(x.key)) : null }
      : null,
    iSharedAlbum: Boolean(shared),
    distance: canShowDistance ? distanceLabel(distanceKm(mine.cellLat!, mine.cellLng!, p.cellLat!, p.cellLng!)) : null,
  });
});

// ---------- Mensajes privados ----------

const pair = (a: string, b: string) => (a < b ? { userA: a, userB: b } : { userA: b, userB: a });

async function myConversation(convId: string, userId: string) {
  const [conv] = await db.select().from(conversation).where(eq(conversation.id, convId));
  if (!conv || (conv.userA !== userId && conv.userB !== userId)) {
    throw new HTTPException(404, { message: "Conversación no encontrada" });
  }
  return { conv, otherId: conv.userA === userId ? conv.userB : conv.userA };
}

function serializeDm(m: typeof directMessage.$inferSelect) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    kind: m.kind === "text" && m.photoKey ? "photo" : m.kind,
    body: m.body,
    // Las fotos temporales nunca viajan en la lista: se piden una sola vez con /open
    photo: m.expiring ? null : imageUrl(m.photoKey),
    expiring: m.expiring,
    opened: Boolean(m.openedAt),
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Segundos que se puede ver una foto temporal antes de que se borre. */
const EXPIRING_SECONDS = 10;

socialRoutes.get("/conversations", async (c) => {
  const me = c.get("user");
  const convs = await db
    .select()
    .from(conversation)
    .where(or(eq(conversation.userA, me.id), eq(conversation.userB, me.id)))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(100);
  if (!convs.length) return c.json([]);
  const others = convs.map((cv) => (cv.userA === me.id ? cv.userB : cv.userA));
  const authors = await authorsFor(others);
  const blockedRows = await db
    .select()
    .from(block)
    .where(or(
      and(eq(block.blockerId, me.id), inArray(block.blockedId, others)),
      and(eq(block.blockedId, me.id), inArray(block.blockerId, others)),
    ));
  const blocked = new Set(blockedRows.map((r) => (r.blockerId === me.id ? r.blockedId : r.blockerId)));

  const out = [];
  for (const cv of convs) {
    const otherId = cv.userA === me.id ? cv.userB : cv.userA;
    if (blocked.has(otherId)) continue;
    const [last] = await db
      .select()
      .from(directMessage)
      .where(eq(directMessage.conversationId, cv.id))
      .orderBy(desc(directMessage.createdAt))
      .limit(1);
    if (!last) continue;
    const [{ unread }] = await db
      .select({ unread: sql<number>`count(*)::int` })
      .from(directMessage)
      .where(and(eq(directMessage.conversationId, cv.id), ne(directMessage.senderId, me.id), isNull(directMessage.readAt)));
    out.push({ id: cv.id, other: authors.get(otherId), last: serializeDm(last), unread });
  }
  return c.json(out);
});

/** Abre (o crea) la conversación con alguien. */
socialRoutes.post("/conversations", async (c) => {
  const me = c.get("user");
  const { userId } = z.object({ userId: z.string() }).parse(await c.req.json());
  if (userId === me.id) throw new HTTPException(400, { message: "No podés escribirte a vos" });
  if (await isBlocked(me.id, userId)) throw new HTTPException(404, { message: "Perfil no disponible" });
  const [p] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (!p) throw new HTTPException(404, { message: "Perfil no disponible" });
  const key = pair(me.id, userId);
  await db.insert(conversation).values({ id: newId(), ...key }).onConflictDoNothing();
  const [conv] = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.userA, key.userA), eq(conversation.userB, key.userB)));
  return c.json({ id: conv.id });
});

socialRoutes.get("/conversations/:id", async (c) => {
  const me = c.get("user");
  const { conv, otherId } = await myConversation(c.req.param("id"), me.id);
  if (await isBlocked(me.id, otherId)) return c.notFound();
  const authors = await authorsFor([otherId]);
  return c.json({ id: conv.id, other: authors.get(otherId) });
});

socialRoutes.get("/conversations/:id/messages", async (c) => {
  const me = c.get("user");
  const { conv, otherId } = await myConversation(c.req.param("id"), me.id);
  if (await isBlocked(me.id, otherId)) return c.notFound();
  const before = c.req.query("before");
  const conds = [eq(directMessage.conversationId, conv.id)];
  if (before) conds.push(lt(directMessage.createdAt, new Date(before)));
  const rows = await db
    .select()
    .from(directMessage)
    .where(and(...conds))
    .orderBy(desc(directMessage.createdAt))
    .limit(50);
  return c.json({ messages: rows.reverse().map(serializeDm), hasMore: rows.length === 50 });
});

socialRoutes.post("/conversations/:id/messages", async (c) => {
  const me = c.get("user");
  const { conv, otherId } = await myConversation(c.req.param("id"), me.id);
  if (await isBlocked(me.id, otherId)) throw new HTTPException(404, { message: "Perfil no disponible" });

  let body: string | null = null;
  let photoKey: string | null = null;
  let expiring = false;
  if ((c.req.header("content-type") ?? "").includes("multipart/form-data")) {
    const form = await c.req.parseBody();
    expiring = form.expiring === "1";
    const file = form.file;
    if (!(file instanceof File)) throw new HTTPException(400, { message: "Falta la foto" });
    if (file.size > MAX_UPLOAD_BYTES) throw new HTTPException(413, { message: "La foto pesa demasiado (máx. 12 MB)" });
    try {
      photoKey = await saveImage(await file.arrayBuffer());
    } catch {
      throw new HTTPException(400, { message: "No pudimos leer esa imagen" });
    }
  } else {
    const r = z.object({ body: z.string().trim().min(1).max(2000) }).safeParse(await c.req.json());
    if (!r.success) throw new HTTPException(400, { message: "Mensaje vacío o demasiado largo" });
    body = r.data.body;
  }

  const now = new Date();
  const [row] = await db
    .insert(directMessage)
    .values({ id: newId(), conversationId: conv.id, senderId: me.id, kind: photoKey ? "photo" : "text", body, photoKey, expiring, createdAt: now })
    .returning();
  await db.update(conversation).set({ lastMessageAt: now }).where(eq(conversation.id, conv.id));
  const msg = serializeDm(row);
  emitToUser(me.id, "dm:message", msg);
  emitToUser(otherId, "dm:message", msg);
  // Notificación discreta (sin nombre ni contenido). Se manda siempre: si la app está abierta y a la vista,
  // el service worker no la muestra. Antes se salteaba si "estaba en línea", y en el celu con la app
  // minimizada la conexión queda abierta un rato y el aviso nunca llegaba.
  pushTo(otherId, { title: APP_NAME, body: "Tenés un mensaje nuevo", url: `/mensajes/${conv.id}`, tag: `dm-${conv.id}` }).catch(() => {});
  return c.json(msg);
});

/**
 * Abrir una foto temporal. Solo quien la recibe, una sola vez.
 * Después de unos segundos el archivo se borra del servidor.
 * (No se puede evitar una captura de pantalla: eso lo avisa la app.)
 */
socialRoutes.post("/conversations/:id/messages/:mid/open", async (c) => {
  const me = c.get("user");
  const { conv } = await myConversation(c.req.param("id"), me.id);
  const [row] = await db
    .update(directMessage)
    .set({ openedAt: new Date() })
    .where(and(
      eq(directMessage.id, c.req.param("mid")),
      eq(directMessage.conversationId, conv.id),
      eq(directMessage.expiring, true),
      ne(directMessage.senderId, me.id),
      isNull(directMessage.openedAt),
    ))
    .returning();
  if (!row?.photoKey) throw new HTTPException(410, { message: "Esta foto ya se vio" });
  const key = row.photoKey;
  setTimeout(async () => {
    await deleteImage(key);
    await db.update(directMessage).set({ photoKey: null }).where(eq(directMessage.id, row.id)).catch(() => {});
  }, (EXPIRING_SECONDS + 5) * 1000);
  emitToUser(row.senderId, "dm:opened", { conversationId: conv.id, id: row.id });
  return c.json({ photo: imageUrl(key), seconds: EXPIRING_SECONDS });
});

/** Desenviar: borra el mensaje para las dos personas. */
socialRoutes.delete("/conversations/:id/messages/:mid", async (c) => {
  const me = c.get("user");
  const { conv, otherId } = await myConversation(c.req.param("id"), me.id);
  const [row] = await db
    .delete(directMessage)
    .where(and(eq(directMessage.id, c.req.param("mid")), eq(directMessage.conversationId, conv.id), eq(directMessage.senderId, me.id)))
    .returning();
  if (!row) return c.notFound();
  if (row.photoKey) await deleteImage(row.photoKey);
  const payload = { conversationId: conv.id, id: row.id };
  emitToUser(me.id, "dm:deleted", payload);
  emitToUser(otherId, "dm:deleted", payload);
  return c.json({ ok: true });
});

socialRoutes.post("/conversations/:id/read", async (c) => {
  const me = c.get("user");
  const { conv, otherId } = await myConversation(c.req.param("id"), me.id);
  const now = new Date();
  const updated = await db
    .update(directMessage)
    .set({ readAt: now })
    .where(and(eq(directMessage.conversationId, conv.id), eq(directMessage.senderId, otherId), isNull(directMessage.readAt)))
    .returning({ id: directMessage.id });
  if (updated.length) emitToUser(otherId, "dm:read", { conversationId: conv.id, readAt: now.toISOString() });
  return c.json({ ok: true });
});

// ---------- Bloqueos ----------

socialRoutes.get("/blocks", async (c) => {
  const me = c.get("user");
  const rows = await db.select().from(block).where(eq(block.blockerId, me.id)).orderBy(desc(block.createdAt));
  const authors = await authorsFor(rows.map((r) => r.blockedId));
  return c.json(rows.map((r) => authors.get(r.blockedId) ?? { id: r.blockedId, name: "Cuenta borrada", age: 0, photo: null }));
});

socialRoutes.post("/blocks", async (c) => {
  const me = c.get("user");
  const { userId } = z.object({ userId: z.string() }).parse(await c.req.json());
  if (userId === me.id) throw new HTTPException(400, { message: "No podés bloquearte a vos" });
  await db.insert(block).values({ blockerId: me.id, blockedId: userId }).onConflictDoNothing();
  return c.json({ ok: true });
});

socialRoutes.delete("/blocks/:userId", async (c) => {
  const me = c.get("user");
  await db.delete(block).where(and(eq(block.blockerId, me.id), eq(block.blockedId, c.req.param("userId"))));
  return c.json({ ok: true });
});

// ---------- Reportes ----------

export const REPORT_REASONS = ["spam", "acoso", "menor de edad", "fotos inapropiadas", "perfil falso", "otro"] as const;

socialRoutes.post("/reports", async (c) => {
  const me = c.get("user");
  const r = z
    .object({
      userId: z.string(),
      reason: z.enum(REPORT_REASONS),
      details: z.string().trim().max(1000).optional(),
      messageId: z.string().optional(),
      messageKind: z.enum(["group", "dm"]).optional(),
    })
    .safeParse(await c.req.json());
  if (!r.success) throw new HTTPException(400, { message: "Elegí un motivo" });
  const { userId, ...rest } = r.data;
  await db.insert(report).values({ id: newId(), reporterId: me.id, targetUserId: userId, ...rest });
  return c.json({ ok: true });
});
