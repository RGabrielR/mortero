import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { APP_NAME } from "./src/brand.ts";

// En desarrollo, Vite hace de proxy al API para que todo quede en el mismo origen (cookies de sesión).
export default defineConfig({
  plugins: [
    react(),
    // Pone el nombre de la app (src/brand.ts) en index.html
    { name: "app-name", transformIndexHtml: { order: "pre", handler: (html) => html.replaceAll("%APP_NAME%", APP_NAME) } },
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3001", ws: true },
    },
  },
});
