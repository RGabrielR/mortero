// Service worker de qule.ar: hace la app instalable y recibe notificaciones push.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "qule.ar", body: "Tenés novedades", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* payload vacío o inválido: usamos el texto genérico */
  }
  event.waitUntil(
    (async () => {
      // Si la app ya está abierta y visible, no hace falta molestar con una notificación
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (wins.some((w) => w.visibilityState === "visible")) return;
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon-192.png",
        // Silueta blanca con fondo transparente: con un PNG a color, Android muestra un cuadrado blanco
        badge: "/badge-96.png",
        tag: data.tag,
        renotify: Boolean(data.tag),
        data: { url: data.url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          return w.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
