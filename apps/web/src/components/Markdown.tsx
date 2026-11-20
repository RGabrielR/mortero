import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";

/**
 * Markdown mínimo para los textos legales (src/legal/*.md): títulos (# y ##), párrafos, listas con
 * un nivel de anidado, citas (>), **negrita** y [links](url). Los textos son nuestros, pero igual
 * se arma todo con nodos de React: nunca se inyecta HTML.
 */
export function Markdown({ source }: { source: string }) {
  return <>{parse(source)}</>;
}

type Item = { text: string; children: string[] };
type Block =
  | { kind: "h1" | "h2" | "p" | "quote"; text: string }
  | { kind: "list"; items: Item[] };

function parse(src: string): ReactNode[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };

  for (const raw of src.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const last = blocks[blocks.length - 1];
    if (line.startsWith("## ")) { flush(); blocks.push({ kind: "h2", text: line.slice(3) }); continue; }
    if (line.startsWith("# ")) { flush(); blocks.push({ kind: "h1", text: line.slice(2) }); continue; }
    if (line.startsWith("> ")) {
      flush();
      if (last?.kind === "quote") last.text += " " + line.slice(2);
      else blocks.push({ kind: "quote", text: line.slice(2) });
      continue;
    }
    const nested = /^\s{2,}- (.*)$/.exec(line);
    if (nested && last?.kind === "list" && last.items.length) {
      last.items[last.items.length - 1].children.push(nested[1]);
      continue;
    }
    if (line.startsWith("- ")) {
      flush();
      if (last?.kind === "list") last.items.push({ text: line.slice(2), children: [] });
      else blocks.push({ kind: "list", items: [{ text: line.slice(2), children: [] }] });
      continue;
    }
    para.push(line.trim());
  }
  flush();

  return blocks.map((b, i) => {
    switch (b.kind) {
      case "h1": return <h1 key={i}>{inline(b.text)}</h1>;
      case "h2": return <h2 key={i}>{inline(b.text)}</h2>;
      case "quote": return <blockquote key={i}>{inline(b.text)}</blockquote>;
      case "p": return <p key={i}>{inline(b.text)}</p>;
      case "list":
        return (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                {inline(it.text)}
                {it.children.length > 0 && <ul>{it.children.map((c, k) => <li key={k}>{inline(c)}</li>)}</ul>}
              </li>
            ))}
          </ul>
        );
    }
  });
}

/** **negrita** y [texto](url). Los links internos (/algo) usan el router; los externos abren aparte. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let at = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const key = out.length;
    if (m[1] !== undefined) {
      out.push(<strong key={key}>{inline(m[1])}</strong>);
    } else {
      const [label, href] = [m[2], m[3]];
      if (href.startsWith("/")) out.push(<Link key={key} to={href}>{label}</Link>);
      else if (/^https?:\/\//.test(href)) out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
      else out.push(<Fragment key={key}>{label}</Fragment>);
    }
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
