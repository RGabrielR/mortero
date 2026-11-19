import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "./db/index.js";
import { blockedWith } from "./lib.js";
import { pushTo } from "./push.js";
import { APP_NAME } from "./brand.js";

const { groupMember, groupMessage, pushSubscription } = schema;

/** Como mucho un aviso de "mensajes nuevos" por grupo y persona cada este tiempo, para no saturar. */
const GROUP_PUSH_EVERY_MS = 10 * 60_000;
const lastGroupPush = new Map<string, number>();

/**
 * Avisa por push que hay un mensaje nuevo en un grupo (ya publicado, no en cola).
 * - A quien le respondieron: siempre, aunque tenga el grupo silenciado.
 * - Al resto: si no silenció el grupo, como mucho una vez cada 10 minutos.
 * Los textos no dicen el grupo ni quién escribió: se ven en la pantalla bloqueada.
 */
export async function notifyGroupMessage(msg: typeof groupMessage.$inferSelect) {
  const members = await db
    .select({ userId: groupMember.userId, muted: groupMember.muted })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, msg.groupId), ne(groupMember.userId, msg.userId)));
  if (!members.length) return;

  // Solo vale la pena mirar a quienes tienen alguna suscripción
  const subscribed = new Set(
    (await db
      .selectDistinct({ userId: pushSubscription.userId })
      .from(pushSubscription)
      .where(inArray(pushSubscription.userId, members.map((m) => m.userId)))).map((r) => r.userId),
  );
  if (!subscribed.size) return;
  const blocked = await blockedWith(msg.userId);

  let repliedTo: string | null = null;
  if (msg.replyToId) {
    const [orig] = await db.select({ userId: groupMessage.userId }).from(groupMessage).where(eq(groupMessage.id, msg.replyToId));
    repliedTo = orig?.userId ?? null;
  }

  const url = `/grupos/${msg.groupId}`;
  const now = Date.now();
  for (const m of members) {
    if (!subscribed.has(m.userId) || blocked.has(m.userId)) continue;
    const key = `${m.userId}:${msg.groupId}`;
    if (m.userId === repliedTo) {
      lastGroupPush.set(key, now);
      pushTo(m.userId, { title: APP_NAME, body: "Te respondieron en un grupo", url, tag: `grp-${msg.groupId}` }).catch(() => {});
      continue;
    }
    if (m.muted) continue;
    if (now - (lastGroupPush.get(key) ?? 0) < GROUP_PUSH_EVERY_MS) continue;
    lastGroupPush.set(key, now);
    pushTo(m.userId, { title: APP_NAME, body: "Hay mensajes nuevos en un grupo", url, tag: `grp-${msg.groupId}` }).catch(() => {});
  }
}
