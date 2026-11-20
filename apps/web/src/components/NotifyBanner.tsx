import { useEffect, useState } from "react";
import { APP_NAME } from "../brand";
import { enablePush, pushHelp, pushState, testPush, type PushState } from "../push";

const KEY = "mortero:avisos-oculto";
const HIDE_DAYS = 3;

function hiddenRecently() {
  try {
    const t = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - t < HIDE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Casos en los que vale la pena mostrar el cartel: se pueden activar, o hay algo que la persona puede hacer. */
const SHOW: PushState[] = ["off", "denied", "in-app", "ios-install"];

/**
 * Invita a activar las notificaciones, en el celu o en la compu. Sin esto casi nadie las activa
 * y nunca se entera de que le escribieron. Si la persona dice "Ahora no", vuelve a aparecer en 3 días.
 * Al activarlas manda una de prueba, así se ve enseguida que funcionan.
 */
export function NotifyBanner() {
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(hiddenRecently);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hidden) return;
    pushState().then(setState).catch(() => setState(null));
  }, [hidden]);

  if (hidden || !state || !SHOW.includes(state)) return null;

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* sin storage: se oculta solo por ahora */
    }
  }

  async function enable() {
    setBusy(true);
    const s = await enablePush().catch(() => "off" as PushState);
    setBusy(false);
    setState(s);
    if (s === "on") testPush().catch(() => {});
  }

  return (
    <div className="notify-banner" role="region" aria-label="Activar avisos">
      <div className="notify-banner__text">
        <b>{state === "off" ? "Enterate cuando te escriben" : "Los avisos no pueden llegarte"}</b>
        <span className="muted small">{pushHelp(state, APP_NAME)}</span>
      </div>
      <div className="notify-banner__actions">
        {state === "off" && (
          <button className="btn btn--small btn--primary" disabled={busy} onClick={enable}>{busy ? "…" : "Activar"}</button>
        )}
        <button className="linkbtn small muted" onClick={hide}>Ahora no</button>
      </div>
    </div>
  );
}
