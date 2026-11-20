import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { env } from "../env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../../drizzle");

export type DB = NodePgDatabase<typeof schema>;

type Conn = { db: DB; migrate: () => Promise<void>; close: () => Promise<void> };

async function connect(): Promise<Conn> {
  if (env.DATABASE_URL) {
    // Producción: Postgres real
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const db = drizzle(env.DATABASE_URL, { schema });
    return { db, migrate: () => migrate(db, { migrationsFolder }), close: () => db.$client.end() };
  }
  // Desarrollo: Postgres embebido (PGlite), sin instalar nada
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  mkdirSync(env.DATA_DIR, { recursive: true });
  const client = new PGlite(path.join(env.DATA_DIR, "pglite"));
  const db = drizzle(client, { schema });
  // PGlite guarda todo en archivos: si el proceso muere a mitad de una escritura, la base puede quedar
  // dañada y no volver a abrir. Por eso hay que cerrarla antes de salir (ver closeDb en index.ts).
  return { db: db as unknown as DB, migrate: () => migrate(db, { migrationsFolder }), close: () => client.close() };
}

const conn = await connect();
export const db = conn.db;
export const runMigrations = conn.migrate;
export const closeDb = conn.close;
export { schema };
