/** Las reacciones de qule.ar: sirven para los toques y para reaccionar a mensajes. Los íconos están en public/reacciones. */
export const REACTIONS = [
  { kind: "hola", label: "Hola" },
  { kind: "fuego", label: "Fuego" },
  { kind: "rayo", label: "Rayo" },
  { kind: "lengua", label: "Lengua" },
  { kind: "chispa", label: "Chispa" },
  { kind: "ojitos", label: "Te miro" },
  { kind: "ganas", label: "Con ganas" },
  { kind: "gotas", label: "Gotitas" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];
export type ReactionSummary = { kind: string; by: string[] };

export const reactionSrc = (kind: string) => `/reacciones/${kind}.svg`;
export const reactionLabel = (kind: string) => REACTIONS.find((r) => r.kind === kind)?.label ?? kind;
