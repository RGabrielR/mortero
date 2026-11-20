import mate from "../../brand/icono.svg";

/**
 * El mate culo, el logo de la app. Sale del mismo SVG que los íconos (apps/web/brand/icono.svg).
 * Va sin texto alternativo porque siempre está al lado del nombre (Wordmark), que ya lo dice.
 */
export function Logo({ className = "" }: { className?: string }) {
  return <img className={`logo ${className}`.trim()} src={mate} alt="" width={769} height={857} decoding="async" />;
}
