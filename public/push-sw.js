/* global self, clients, caches */
// =====================================================================
// Gestionnaires Web Push importés dans le service worker généré
// (configuré via workbox.importScripts dans vite.config).
// Affiche la notification dans la barre du téléphone (son + vibration)
// même quand l'application est fermée, et ouvre l'app au clic.
// =====================================================================

// À chaque nouvelle version du service worker : prendre le contrôle
// immédiatement et purger TOUS les anciens caches pour que l'APK charge
// toujours la dernière version (plus d'écran/ancien code en cache).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: "Easy Dunya", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Easy Dunya";
  const data = payload.data || {};
  const options = {
    body: payload.body || "",
    icon: "/brand/emblem.png",
    badge: "/brand/emblem.png",
    vibrate: [200, 100, 200],
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/", ...data },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
