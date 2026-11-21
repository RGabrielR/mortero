import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { customType } from "drizzle-orm/pg-core";
import { env } from "./env.js";

/**
 * Cifrado de datos sensibles en la base (hoy: estado serológico y fecha del último test).
 * AES-256-GCM con la clave DATA_KEY. Quien vea la base o un backup sin la clave no puede leerlos.
 *
 * Formato guardado: "v1:" + base64(iv de 12 bytes | tag de 16 bytes | texto cifrado).
 * Un valor sin el prefijo es de antes del cifrado: se lee tal cual y se cifra al arrancar (encryptLegacyHealth).
 *
 * Si se pierde DATA_KEY, esos datos no se pueden recuperar. Ver docs/DEPLOY.md.
 */
const PREFIX = "v1:";
let cached: Buffer | undefined;

function key(): Buffer {
  if (cached) return cached;
  let b64 = env.DATA_KEY;
  if (!b64) {
    if (process.env.NODE_ENV === "production") throw new Error("Falta DATA_KEY (ver docs/DEPLOY.md)");
    // Desarrollo: se crea sola, como las claves VAPID
    const file = path.join(env.DATA_DIR, "data-key");
    if (existsSync(file)) b64 = readFileSync(file, "utf8").trim();
    else {
      mkdirSync(env.DATA_DIR, { recursive: true });
      b64 = randomBytes(32).toString("base64");
      writeFileSync(file, b64, { mode: 0o600 });
    }
  }
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("DATA_KEY tiene que ser de 32 bytes en base64 (openssl rand -base64 32)");
  return (cached = k);
}

/** Para chequear al arrancar que la clave está y es válida, antes de atender a nadie. */
export const checkDataKey = () => void key();

export const isEncrypted = (v: string) => v.startsWith(PREFIX);

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function decrypt(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

/** Columna de texto que se guarda cifrada y se lee en claro. No se puede buscar ni ordenar por ella. */
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType: () => "text",
  toDriver: (v) => encrypt(v),
  fromDriver: (v) => decrypt(v),
});
