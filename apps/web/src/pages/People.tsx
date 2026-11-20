import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, type Author, type Viewer } from "../api";
import { useMe } from "../App";
import { BackIcon } from "../components/Icons";

function ago(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `hace ${Math.max(1, Math.floor(diff / 60))} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

function PeopleGrid({ title, people, empty, note }: { title: string; people: (Author & { sub?: string })[] | null; empty: string; note?: string }) {
  const nav = useNavigate();
  return (
    <div className="page">
      <header className="topbar topbar--thread">
        <button className="iconbtn" onClick={() => nav("/yo")} aria-label="Volver"><BackIcon /></button>
        <h1 className="topbar__title topbar__title--sm">{title}</h1>
      </header>
      {note && <p className="muted small page-note">{note}</p>}
      {people && people.length === 0 && <div className="empty"><p className="muted">{empty}</p></div>}
      {people && people.length > 0 && (
        <ul className="grid grid--spaced">
          {people.map((p) => (
            <li key={p.id}>
              <Link to={`/perfil/${p.id}`} className="tile" aria-label={`${p.name}, ${p.age}`}>
                {p.photo ? <img src={p.photo} alt="" loading="lazy" /> : <span className="tile__empty">{p.name.charAt(0).toUpperCase()}</span>}
                <span className="tile__info">
                  <span className="tile__name">{p.name} <span className="tile__dist">{p.age}</span></span>
                  {p.sub && <span className="tile__dist">{p.sub}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Views() {
  const { me } = useMe();
  const [list, setList] = useState<Viewer[] | null>(null);
  useEffect(() => {
    api<Viewer[]>("/me/views").then(setList).catch(() => setList([]));
  }, []);
  return (
    <PeopleGrid
      title="Quién me vio"
      people={list?.map((v) => ({ ...v, sub: ago(v.viewedAt) })) ?? null}
      empty="Nadie visitó tu perfil en los últimos 30 días."
      note={me?.profile?.incognito ? "Estás en incógnito: vos podés ver quién te visitó, pero tus visitas no se registran." : "Visitas de los últimos 30 días. Quien está en incógnito no aparece."}
    />
  );
}

export function Favorites() {
  const [list, setList] = useState<Author[] | null>(null);
  useEffect(() => {
    api<Author[]>("/favorites").then(setList).catch(() => setList([]));
  }, []);
  return <PeopleGrid title="Favoritos" people={list} empty="Todavía no marcaste a nadie. Tocá la estrella en un perfil." note="Nadie se entera de que lo marcaste como favorito." />;
}
