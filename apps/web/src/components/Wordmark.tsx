import { APP_NAME } from "../brand";

/** El logo en texto. Cuando haya logo nuevo, se cambia acá y en todas las pantallas a la vez. */
export function Wordmark({ big = false }: { big?: boolean }) {
  // Mientras la app esté en beta, se dice al lado del nombre
  const beta = <span className="beta">beta</span>;
  return big ? (
    <h1 className="wordmark wordmark--big">{APP_NAME} {beta}</h1>
  ) : (
    <span className="wordmark">{APP_NAME} {beta}</span>
  );
}
