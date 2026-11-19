import { useEffect, useState } from "react";
import { APP_NAME } from "../brand";

// Chrome/Android avisa que la app se puede instalar con este evento. Lo guardamos apenas carga la página,
// porque puede llegar antes de que se monte el componente.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const KEY = "mortero:instalar-oculto";
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function wasHidden() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Invita a instalar mortero como app. En iPhone explica los pasos, porque Safari no tiene botón. */
export function InstallBanner() {
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(wasHidden);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  if (hidden || isStandalone()) return null;
  const ios = isIOS();
  if (!deferred && !ios) return null;

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* sin storage: se oculta solo por ahora */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    force((n) => n + 1);
  }

  return (
    <div className="notice install">
      <img src="/icon-192.png" alt="" className="install__icon" />
      <div className="install__text">
        <p><b>Instalá {APP_NAME}</b></p>
        {ios ? (
          <p className="muted small">En Safari, tocá <b>Compartir</b> y después <b>Agregar a inicio</b>. Así se abre como una app y te llegan los avisos.</p>
        ) : (
          <p className="muted small">Se abre como una app, sin tienda y sin ocupar casi nada.</p>
        )}
      </div>
      <div className="install__actions">
        {!ios && <button className="btn btn--small btn--primary" onClick={install}>Instalar</button>}
        <button className="linkbtn small muted" onClick={hide}>Ahora no</button>
      </div>
    </div>
  );
}
