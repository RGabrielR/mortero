import { existsSync, readFileSync } from "node:fs";
import type { Server as HttpServer } from "node:http";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth.js";
import { db, runMigrations, schema } from "./db/index.js";
import { env } from "./env.js";
import { APP_NAME } from "./brand.js";
import type { AppEnv } from "./lib.js";
import { attachRealtime } from "./realtime.js";
import { groupRoutes } from "./routes/groups.js";
import { meRoutes } from "./routes/me.js";
import { socialRoutes } from "./routes/social.js";
import { nearbyRoutes } from "./routes/nearby.js";
import { premiumRoutes } from "./routes/premium.js";
import { adminRoutes } from "./routes/admin.js";

await runMigrations();

// El chat general existe siempre
const [general] = await db.select().from(schema.group).where(eq(schema.group.isGeneral, true));
if (!general) {
  await db.insert(schema.group).values({
    id: "general",
    name: "General",
    description: "El chat de toda la app. Modo lento activado: un mensaje por minuto, ráfagas de dos.",
    isGeneral: true,
  });
}

const app = new Hono<AppEnv>();

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api", meRoutes);
app.route("/api", groupRoutes);
app.route("/api", socialRoutes);
app.route("/api", nearbyRoutes);
app.route("/api", premiumRoutes);
app.route("/api", adminRoutes);
app.all("/api/*", (c) => c.json({ error: "No existe" }, 404));

// En producción el API también sirve la web compilada (un solo proceso, un solo puerto)
if (existsSync(env.WEB_DIST)) {
  const index = readFileSync(path.join(env.WEB_DIST, "index.html"), "utf8");
  app.use("/*", serveStatic({
    root: path.relative(process.cwd(), env.WEB_DIST),
    onFound: (p, c) => {
      // Los assets con hash se cachean para siempre; el resto, no
      c.header("Cache-Control", p.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    },
  }));
  // Rutas de la app (SPA): todo lo demás devuelve index.html
  app.get("*", (c) => c.html(index, 200, { "Cache-Control": "no-cache" }));
}

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  if (err && typeof err === "object" && "issues" in err) return c.json({ error: "Datos inválidos" }, 400);
  console.error(err);
  return c.json({ error: "Algo salió mal" }, 500);
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`${APP_NAME} API escuchando en http://localhost:${info.port}`);
});
attachRealtime(server as HttpServer);
