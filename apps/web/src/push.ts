import { api } from "./api";

/**
 * - in-app: el navegador interno de Instagram, X, TikTok, etc. No permite avisos: hay que abrir el link en Chrome o Safari.
 * - ios-install: en iPhone los avisos web solo andan con la app agregada a la pantalla de inicio.
 */
export type PushState = "unsupported" | "in-app" | "ios-install" | "denied" | "off" | "on" | "disabled";

const ua = () => navigator.userAgent;
const isIos = () => /iphone|ipad|ipod/i.test(ua());
const isInApp = () => /Instagram|FBAN|FBAV|FB_IAB|Twitter|TwitterAndroid|BytedanceWebview|musical_ly|Line\/|GSA\//i.test(ua());
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** El service worker listo, o null si no arranca (navegación privada, navegadores raros). Sin esto quedaba colgado. */
async function swReady(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 5000)),
  ]);
}

export async function pushState(): Promise<PushState> {
  if (isInApp()) return "in-app";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  }
  const { enabled } = await api<{ enabled: boolean }>("/push/key");
  if (!enabled) return "disabled";
  if (Notification.permission === "denied") return "denied";
  const reg = await swReady();
  if (!reg) return "unsupported";
  const sub = await reg.pushManager.getSubscription();
  // Con permiso pero sin suscripción en el servidor (por ejemplo, después de cambiar de dominio) cuenta como apagado
  return sub ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const { key } = await api<{ key: string }>("/push/key");
  const reg = await swReady();
  if (!reg) return "unsupported";
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  await api("/push/subscribe", { method: "POST", json: sub.toJSON() });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await swReady();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/push/subscribe", { method: "DELETE", json: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

/** Manda una notificación de prueba a todos tus dispositivos. Devuelve a cuántos llegó. */
export async function testPush(): Promise<number> {
  const { sent } = await api<{ sent: number }>("/push/test", { method: "POST" });
  return sent;
}

/** Qué decirle a la persona en cada caso. */
export function pushHelp(state: PushState, appName: string): string {
  const desktop = !/android|iphone|ipad|ipod/i.test(ua());
  switch (state) {
    case "on":
      return "Te avisamos de mensajes nuevos y solicitudes cuando no estás mirando la app, en el celu o en la compu. Los avisos no dicen quién te escribió ni qué.";
    case "off":
      return "Activalas para enterarte de mensajes nuevos con la app cerrada o en otra pestaña. Son discretas: no dicen quién te escribió ni qué.";
    case "denied":
      return desktop
        ? "Las bloqueaste para este sitio. Tocá el candado al lado de la dirección, poné Notificaciones en Permitir y recargá la página."
        : "Las bloqueaste para este sitio. Habilitalas en los ajustes del navegador (Configuración del sitio → Notificaciones) y recargá.";
    case "in-app":
      return `Estás en el navegador de otra app, que no permite avisos. Abrí ${appName} en Chrome o Safari (menú ⋯ → Abrir en el navegador).`;
    case "ios-install":
      return `En iPhone los avisos llegan solo con la app instalada: en Safari, tocá Compartir → Agregar a inicio y abrila desde ahí.`;
    case "unsupported":
      return "Este navegador no permite notificaciones. Probá con Chrome, Firefox, Edge o Safari.";
    default:
      return "";
  }
}
