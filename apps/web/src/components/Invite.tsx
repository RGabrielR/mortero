import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, type InvitableGroup, type InviteCandidate, type InviteState, type MyInvite } from "../api";
import { Avatar } from "./Avatar";
import { GroupIcon } from "./Icons";

/**
 * Botón de invitar según dónde está la persona en el grupo.
 * Si ya había pedido entrar, invitarla es aceptarla.
 */
function InviteAction({ state, onInvite }: { state: InviteState; onInvite: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  if (state === "member") return <span className="pill">Ya está</span>;
  if (state === "invited") return <span className="pill pill--wait">Invitación enviada</span>;
  if (state === "declined") return <span className="pill">Rechazó hace poco</span>;
  const run = async () => {
    setBusy(true);
    try {
      await onInvite();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="btn btn--small btn--primary" disabled={busy} onClick={run}>
      {state === "requested" ? "Aceptar" : "Invitar"}
    </button>
  );
}

/** Desde la info de un grupo: buscar gente e invitarla. */
export function InvitePeopleSheet({ groupId, groupName, onClose, onChange }: {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<InviteCandidate[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    (query: string) =>
      api<InviteCandidate[]>(`/groups/${groupId}/invite-candidates?q=${encodeURIComponent(query)}`).then(setPeople).catch(() => setPeople([])),
    [groupId],
  );

  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  async function invite(p: InviteCandidate) {
    setError("");
    try {
      const r = await api<{ joined?: boolean }>(`/groups/${groupId}/invites`, { method: "POST", json: { userId: p.id } });
      setPeople((list) => list?.map((x) => (x.id === p.id ? { ...x, state: r.joined ? "member" : "invited" } : x)) ?? null);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--list" role="dialog" aria-modal aria-labelledby="invite-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="invite-title">Invitar a {groupName}</h2>
        <input
          className="input"
          type="search"
          placeholder="Buscar por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar gente"
          autoFocus
        />
        {!q && <p className="muted small">Gente con la que charlaste y tus favoritos. Para otra persona, buscala por su nombre.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <ul className="members invite-list">
          {people?.map((p) => (
            <li key={p.id} className="member">
              <Link to={`/perfil/${p.id}`} className="member__who">
                <Avatar src={p.photo} name={p.name} size={40} />
                <span><b>{p.name}</b> <span className="muted">{p.age}</span></span>
              </Link>
              <InviteAction state={p.state} onInvite={() => invite(p)} />
            </li>
          ))}
          {people && people.length === 0 && (
            <li className="muted">{q ? "No encontramos a nadie con ese nombre." : "Todavía no charlaste con nadie ni tenés favoritos. Buscá por nombre."}</li>
          )}
        </ul>
        <p className="muted small">La persona recibe la invitación y elige si entra.</p>
        <button className="btn" onClick={onClose}>Listo</button>
      </div>
    </div>
  );
}

/** Desde el perfil de alguien: invitarle a los grupos que modero. No se muestra si no modero ninguno. */
export function InviteToGroups({ userId, name }: { userId: string; name: string }) {
  const [groups, setGroups] = useState<InvitableGroup[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<InvitableGroup[]>(`/groups/invitable/${userId}`).then(setGroups).catch(() => setGroups([]));
  }, [userId]);

  if (!groups?.length) return null;

  async function invite(g: InvitableGroup) {
    setError("");
    try {
      const r = await api<{ joined?: boolean }>(`/groups/${g.id}/invites`, { method: "POST", json: { userId } });
      setGroups((list) => list?.map((x) => (x.id === g.id ? { ...x, state: r.joined ? "member" : "invited" } : x)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <button className="btn btn--ghost" onClick={() => setOpen(true)}><GroupIcon /> Invitar a un grupo</button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet sheet--list" role="dialog" aria-modal aria-labelledby="invite-groups-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="invite-groups-title">Invitar a {name}</h2>
            <p className="muted small">Estos son los grupos que moderás. {name} recibe la invitación y elige si entra.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <ul className="members invite-list">
              {groups.map((g) => (
                <li key={g.id} className="member">
                  <span className="member__who">
                    <span className="gcard__icon gcard__icon--sm" aria-hidden>{g.name.charAt(0).toUpperCase()}</span>
                    <b>{g.name}</b>
                  </span>
                  <InviteAction state={g.state} onInvite={() => invite(g)} />
                </li>
              ))}
            </ul>
            <button className="btn" onClick={() => setOpen(false)}>Listo</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Invitaciones que me mandaron, arriba de Mis grupos. */
export function MyInvites({ invites, onChange }: { invites: MyInvite[]; onChange: () => void }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!invites.length) return null;

  async function answer(inv: MyInvite, accept: boolean) {
    setBusy(inv.id);
    setError("");
    try {
      await api(`/invites/${inv.id}/${accept ? "accept" : "decline"}`, { method: "POST" });
      if (accept) nav(`/grupos/${inv.group.id}`);
      else onChange();
    } catch (e) {
      setError((e as Error).message);
      onChange();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="section">
      <h2 className="section__title">Te invitaron <span className="muted">{invites.length}</span></h2>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="reqs">
        {invites.map((inv) => (
          <li key={inv.id} className="req">
            <div className="req__who">
              <span className="gcard__icon" aria-hidden>{inv.group.name.charAt(0).toUpperCase()}</span>
              <span>
                <b>{inv.group.name}</b>
                <span className="gcard__meta">
                  {" "}· {inv.group.memberCount} {inv.group.memberCount === 1 ? "miembro" : "miembros"}
                </span>
              </span>
            </div>
            {inv.group.description && <p className="gcard__desc">{inv.group.description}</p>}
            {inv.invitedBy && (
              <p className="muted small">
                Te invitó <Link to={`/perfil/${inv.invitedBy.id}`}>{inv.invitedBy.name}</Link>
              </p>
            )}
            <div className="row">
              <button className="btn btn--small" disabled={busy === inv.id} onClick={() => answer(inv, false)}>No, gracias</button>
              <button className="btn btn--small btn--primary" disabled={busy === inv.id} onClick={() => answer(inv, true)}>Entrar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
