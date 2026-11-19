import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, authClient } from "../api";
import { useMe } from "../App";
import { Wordmark } from "../components/Wordmark";

export function Login() {
  const { reload } = useMe();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const [canReset, setCanReset] = useState(false);

  useEffect(() => {
    api<{ google: boolean; passwordReset: boolean }>("/config").then((c) => { setGoogle(c.google); setCanReset(c.passwordReset); }).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res =
      mode === "up"
        ? await authClient.signUp.email({ name: name || email.split("@")[0], email, password })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(translate(res.error.code, res.error.message));
      return;
    }
    await reload();
  }

  return (
    <div className="auth">
      <div className="auth__hero">
        <Wordmark big />
        <p className="auth__tag">Gente cerca, grupos y charla. Gratis y de código abierto, para siempre.</p>
      </div>

      <div className="auth__card">
        {google && (
          <>
            <button
              className="btn btn--google"
              onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
            >
              <GoogleMark /> Seguir con Google
            </button>
            <div className="divider"><span>o con tu email</span></div>
          </>
        )}

        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={mode === "in"} onClick={() => setMode("in")}>Entrar</button>
          <button role="tab" aria-selected={mode === "up"} onClick={() => setMode("up")}>Crear cuenta</button>
        </div>

        <form onSubmit={submit} className="form">
          {mode === "up" && (
            <label className="field">
              <span>Nombre</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" maxLength={40} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
            {mode === "up" && <small className="muted">Mínimo 8 caracteres.</small>}
            {mode === "in" && canReset && <Link to="/recuperar" className="linkbtn small forgot">¿Te olvidaste la contraseña?</Link>}
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Un toque…" : mode === "up" ? "Crear cuenta" : "Entrar"}
          </button>
        </form>
        <p className="fineprint">Solo para mayores de 18. Al seguir aceptás tratar a los demás con respeto.</p>
      </div>
    </div>
  );
}

function translate(code: string | undefined, fallback: string | undefined) {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD": return "Email o contraseña incorrectos.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": return "Ya hay una cuenta con ese email.";
    case "PASSWORD_TOO_SHORT": return "La contraseña es muy corta.";
    case "INVALID_EMAIL": return "Ese email no parece válido.";
    default: return fallback ?? "No se pudo. Probá de nuevo.";
  }
}

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);
