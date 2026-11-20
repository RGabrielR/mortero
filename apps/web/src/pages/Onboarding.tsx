import { useState } from "react";
import { useNavigate } from "react-router";
import { api, authClient } from "../api";
import { useMe } from "../App";
import { APP_NAME } from "../brand";
import { Wordmark } from "../components/Wordmark";
import { Logo } from "../components/Logo";

function maxBirthdate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function Onboarding() {
  const { me, reload } = useMe();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState(me?.user.name ?? "");
  const [birthdate, setBirthdate] = useState("");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/me/profile", { method: "PUT", json: { displayName, birthdate } });
      await reload();
      nav("/yo?nuevo=1", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__hero">
        <Logo className="auth__logo" />
        <Wordmark big />
        <p className="auth__tag">Dos datos y entrás.</p>
      </div>
      <form className="auth__card form" onSubmit={submit}>
        <label className="field">
          <span>¿Cómo querés que te vean?</span>
          <input className="input" required maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="field">
          <span>Fecha de nacimiento</span>
          <input className="input" type="date" required max={maxBirthdate()} value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
          <small className="muted">Solo mostramos tu edad. La fecha no se puede cambiar después.</small>
        </label>
        <label className="check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          <span>Confirmo que tengo 18 años o más.</span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--primary" disabled={!adult || busy}>{busy ? "Un toque…" : `Entrar a ${APP_NAME}`}</button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={async () => {
            await authClient.signOut();
            await reload();
          }}
        >
          Salir
        </button>
      </form>
    </div>
  );
}
