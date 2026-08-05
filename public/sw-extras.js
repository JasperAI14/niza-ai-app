// Niza Prime AI — background sync + push notification support.
// Loaded via importScripts from the Workbox-generated /sw.js.

// ---- Push notifications ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Niza Prime AI", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Niza Prime AI";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: { url: data.url || "/" },
    tag: data.tag || "niza-push",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsArr) {
        if ("focus" in c) {
          try { await c.navigate(url); } catch {}
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});

// ---- Background sync ----
// Pages can request a sync via: reg.sync.register('niza-sync')
self.addEventListener("sync", (event) => {
  if (event.tag === "niza-sync") {
    event.waitUntil(
      (async () => {
        const clientsArr = await self.clients.matchAll({ includeUncontrolled: true });
        for (const c of clientsArr) c.postMessage({ type: "SYNC", tag: event.tag });
      })(),
    );
  }
});

// Periodic background sync (Android Chrome, with permission).
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "niza-refresh") {
    event.waitUntil(
      (async () => {
        const clientsArr = await self.clients.matchAll({ includeUncontrolled: true });
        for (const c of clientsArr) c.postMessage({ type: "PERIODIC_SYNC", tag: event.tag });
      })(),
    );
  }
});
