import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { APP_DESCRIPTION, APP_NAME, DEFAULT_THEME, FONTS_HREF, themes, tokensCss, webManifest } from "@mortero/brand";

/**
 * Lleva la marca (packages/brand) a la web:
 * - `import "virtual:brand.css"` da todas las variables CSS (colores, temas, tamaños, radios…)
 * - completa los %MARCADORES% de index.html (nombre, color de la barra, fuentes, tema guardado)
 * - arma /manifest.webmanifest
 */
function brand(): Plugin {
  const CSS_ID = "virtual:brand.css";
  const manifest = JSON.stringify(webManifest(), null, 2);
  // Aplica el tema guardado antes de pintar, así no parpadea el oscuro al abrir en penumbra
  const colors = JSON.stringify(Object.fromEntries(Object.entries(themes).map(([k, v]) => [k, v.bg])));
  const themeScript =
    `(function(){try{var t=localStorage.getItem("mortero:tema"),c=${colors};` +
    `if(t&&t!==${JSON.stringify(DEFAULT_THEME)}&&c[t]){document.documentElement.dataset.theme=t;` +
    `document.querySelector('meta[name="theme-color"]').setAttribute("content",c[t]);}}catch(e){}})();`;
  const vars: Record<string, string> = {
    APP_NAME,
    APP_DESCRIPTION: APP_DESCRIPTION.replace(/^./, (c) => c.toLowerCase()),
    THEME_COLOR: themes[DEFAULT_THEME].bg,
    FONTS_HREF,
    THEME_SCRIPT: themeScript,
  };
  return {
    name: "brand",
    resolveId: (id) => (id === CSS_ID ? "\0" + CSS_ID : undefined),
    load: (id) => (id === "\0" + CSS_ID ? tokensCss() : undefined),
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replace(/%([A-Z_]+)%/g, (m, k: string) => vars[k] ?? m),
    },
    configureServer(server) {
      server.middlewares.use("/manifest.webmanifest", (_req, res) => {
        res.setHeader("Content-Type", "application/manifest+json");
        res.end(manifest);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: manifest });
    },
  };
}

// En desarrollo, Vite hace de proxy al API para que todo quede en el mismo origen (cookies de sesión).
export default defineConfig({
  plugins: [react(), brand()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3001", ws: true },
    },
  },
});
