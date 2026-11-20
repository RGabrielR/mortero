import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const env = {
  PORT: Number(process.env.PORT ?? 3001),
  // URL pública de la web (en desarrollo, Vite en el 5173 hace de proxy al API)
  APP_URL: process.env.APP_URL ?? "http://localhost:5173",
  DATABASE_URL: process.env.DATABASE_URL,
  DATA_DIR: process.env.DATA_DIR ?? path.join(root, "data"),
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "solo-para-desarrollo-cambiar-en-produccion",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  // Mails (bienvenida, recuperar contraseña). Ej.: smtps://resend:API_KEY@smtp.resend.com:465
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM ?? "qule.ar <hola@qule.local>",
  // Emails con acceso al panel de moderación, separados por coma
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  // IDs de cuenta con acceso a moderación. Sirve para quien entra con mail y contraseña: hoy esos mails no se
  // verifican, así que ADMIN_EMAILS solo cuenta para cuentas con el mail verificado (por ejemplo, las de Google).
  ADMIN_USER_IDS: (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  // Carpeta con la web compilada (en producción el API la sirve)
  WEB_DIST: process.env.WEB_DIST ?? path.join(root, "apps/web/dist"),
  // Encabezado del que sale la IP real de cada persona (límite de intentos y sesiones). Tiene que ser uno que el
  // proxy de adelante pise siempre: cf-connecting-ip con el túnel de Cloudflare, x-real-ip con el nginx de deploy/.
  CLIENT_IP_HEADER: (process.env.CLIENT_IP_HEADER ?? "cf-connecting-ip").toLowerCase(),
};

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
  throw new Error("Falta BETTER_AUTH_SECRET");
}
