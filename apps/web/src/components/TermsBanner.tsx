import { useState } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { useMe } from "../App";
import { APP_NAME } from "../brand";
import { TERMS_VERSION } from "../legal/version";

/**
 * Para quien creó la cuenta antes de que hubiera términos, o cuando cambian: pide aceptar la versión vigente.
 * No bloquea la app (estamos en beta), pero queda visible hasta que se acepte.
 */
export function TermsBanner() {
  const { me, reload } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!me?.profile || me.profile.termsVersion === TERMS_VERSION) return null;
  const isUpdate = me.profile.termsVersion != null;

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await api("/me/terms", { method: "PUT", json: { version: TERMS_VERSION } });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notify-banner" role="region" aria-label="Términos y privacidad">
      <div className="notify-banner__text">
        <b>{isUpdate ? "Actualizamos los términos" : `${APP_NAME} está en beta`}</b>
        <span className="muted small">
          {isUpdate ? "Leé los cambios en los " : "Sumamos los "}
          <Link to="/terminos">Términos</Link> y la <Link to="/privacidad">Política de privacidad</Link>
          {isUpdate ? "." : ": qué guardamos, dónde y qué podés pedir sobre tus datos."}
        </span>
        {error && <span className="error small" role="alert">{error}</span>}
      </div>
      <div className="notify-banner__actions">
        <button className="btn btn--small btn--primary" disabled={busy} onClick={accept}>
          {busy ? "…" : "Leí y acepto"}
        </button>
      </div>
    </div>
  );
}
