/**
 * Nombre de la app. Para renombrarla, cambiá esto y APP_NAME en apps/api/src/brand.ts.
 * index.html lo toma solo (lo inyecta vite.config.ts).
 *
 * Quedan a mano, porque son archivos estáticos que no pasan por el código:
 * - public/manifest.webmanifest: "name" y "short_name"
 * - public/sw.js: el título por defecto de las notificaciones
 * - los íconos: public/icon.svg y public/badge.svg (después, npm run icons --workspace web)
 *
 * Las claves de localStorage ("mortero:filtros", etc.) y el evento "mortero:read" NO se renombran:
 * son internas y si cambian se pierden las preferencias que cada persona ya tiene guardadas.
 */
export const APP_NAME = "mortero";
