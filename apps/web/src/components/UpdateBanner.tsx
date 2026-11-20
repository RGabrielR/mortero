import { useEffect, useRef, useState } from "react";

/** Sello de este build, lo pone vite.config.ts. */
declare const __APP_VERSION__: string;

/** Cada cuánto se fija, mientras la app está a la vista. */
const CHECK_EVERY_MS = 15 * 60_000;
/** Si la app estuvo en segundo plano más que esto, al volver se actualiza sola, sin preguntar. */
const AUTO_RELOAD_AFTER_MS = 30 * 60_000;

async function latestVersion(): Promise<string | null> {
  try {
    const res = await fetch("/version.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null; // sin conexión: se vuelve a intentar más tarde
  }
}

/**
 * La app agregada a la pantalla de inicio no se recarga nunca: el celu la deja suspendida y al volver sigue
 * la versión vieja (y en iPhone no hay botón de recargar). Esto se fija si hay una versión nueva:
 * - al volver a la app y cada 15 minutos;
 * - si volvés después de un buen rato, se actualiza sola, porque no estabas haciendo nada;
 * - si no, aparece un aviso para actualizar cuando quieras, así no se pierde lo que estás escribiendo.
 */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hiddenSince = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;

    async function check(autoReload = false) {
      const v = await latestVersion();
      if (stopped || !v || v === __APP_VERSION__) return;
      if (autoReload) {
        window.location.reload();
        return;
      }
      setAvailable(true);
      // Que el service worker también se renueve
      navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
        return;
      }
      const away = hiddenSince.current ? Date.now() - hiddenSince.current : 0;
      hiddenSince.current = null;
      check(away > AUTO_RELOAD_AFTER_MS);
    };

    const onOnline = () => check();
    check();
    const timer = setInterval(() => document.visibilityState === "visible" && check(), CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!available || dismissed) return null;

  return (
    <div className="update-banner" role="status">
      <b className="update-banner__text">Hay una versión nueva</b>
      <div className="row">
        <button className="linkbtn small" onClick={() => setDismissed(true)}>Después</button>
        <button className="btn btn--small btn--primary" onClick={() => window.location.reload()}>Actualizar</button>
      </div>
    </div>
  );
}
