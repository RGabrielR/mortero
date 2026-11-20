import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authClient } from "../api";
import { Wordmark } from "../components/Wordmark";
import { Logo } from "../components/Logo";

/** Pedir el mail para recuperar la contraseña. */
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await authClient.requestPasswordReset({ email, redirectTo: "/nueva-clave" });
    setBusy(false);
    // Siempre decimos lo mismo, exista o no la cuenta, para no revelar quién está registrado
    if (res.error && res.error.status !== 404) setError("No se pudo. Probá de nuevo en un rato.");
    else setSent(true);
  }

  return (
    <div className="auth">
      <div className="auth__hero">
        <Logo className="auth__logo" />
        <Wordmark big />
      </div>
      <div className="auth__card">
        <h2 className="auth__title">Recuperar contraseña</h2>
        {sent ? (
          <>
            <p className="muted">Si hay una cuenta con <b>{email}</b>, te mandamos un mail con un link para elegir una contraseña nueva. Vence en 1 hora.</p>
            <p className="muted small">¿No llega? Fijate en spam o promociones.</p>
          </>
        ) : (
          <form onSubmit={submit} className="form">
            <p className="muted">Escribí el email con el que te registraste y te mandamos un link.</p>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn btn--primary" disabled={busy}>{busy ? "Un toque…" : "Mandar link"}</button>
          </form>
        )}
        <Link to="/entrar" className="linkbtn center-link">Volver a entrar</Link>
      </div>
    </div>
  );
}

/** Elegir la contraseña nueva, con el token que llega por mail. */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") ? "El link venció o ya se usó. Pedí uno nuevo." : "");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== repeat) return setError("Las contraseñas no coinciden.");
    if (!token) return setError("Falta el link del mail. Pedí uno nuevo.");
    setBusy(true);
    setError("");
    const res = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (res.error) setError(res.error.code === "INVALID_TOKEN" ? "El link venció o ya se usó. Pedí uno nuevo." : "No se pudo. Probá de nuevo.");
    else setDone(true);
  }

  return (
    <div className="auth">
      <div className="auth__hero">
        <Logo className="auth__logo" />
        <Wordmark big />
      </div>
      <div className="auth__card">
        <h2 className="auth__title">Contraseña nueva</h2>
        {done ? (
          <>
            <p className="muted">Listo, ya podés entrar con tu contraseña nueva.</p>
            <button className="btn btn--primary" onClick={() => nav("/entrar", { replace: true })}>Entrar</button>
          </>
        ) : (
          <form onSubmit={submit} className="form">
            <label className="field">
              <span>Contraseña nueva</span>
              <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <small className="muted">Mínimo 8 caracteres.</small>
            </label>
            <label className="field">
              <span>Repetila</span>
              <input className="input" type="password" required minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn btn--primary" disabled={busy || !token}>{busy ? "Un toque…" : "Guardar"}</button>
            {!token && <Link to="/recuperar" className="linkbtn center-link">Pedir un link nuevo</Link>}
          </form>
        )}
      </div>
    </div>
  );
}
