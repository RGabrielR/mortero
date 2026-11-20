import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db, schema } from "./db/index.js";
import { deleteImage } from "./storage.js";

const { directMessage } = schema;

/** Segundos que se puede ver una foto temporal antes de que se borre. */
export const EXPIRING_SECONDS = 10;
/** Margen para que termine de cargar antes de borrarla. Pasado esto, la foto ya no se sirve aunque el archivo exista. */
export const EXPIRING_GRACE_MS = (EXPIRING_SECONDS + 5) * 1000;

/** ¿Ya pasó el tiempo para ver esta foto temporal? */
export function expiringIsOver(openedAt: Date | null) {
  return openedAt != null && Date.now() - openedAt.getTime() > EXPIRING_GRACE_MS;
}

/**
 * Borra las fotos temporales que ya se vieron. Se llama al arrancar y cada minuto: así, si el API se reinicia
 * justo después de que alguien abre una (por ejemplo, en un deploy), igual se borra.
 */
export async function sweepExpiredPhotos() {
  const due = await db
    .select({ id: directMessage.id, key: directMessage.photoKey })
    .from(directMessage)
    .where(and(
      eq(directMessage.expiring, true),
      isNotNull(directMessage.photoKey),
      lt(directMessage.openedAt, new Date(Date.now() - EXPIRING_GRACE_MS)),
    ));
  for (const m of due) {
    if (m.key) await deleteImage(m.key);
    await db.update(directMessage).set({ photoKey: null }).where(eq(directMessage.id, m.id));
  }
}
