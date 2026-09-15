/* Iris — service worker solo para notificaciones push.
   No cachea nada (sin handler de fetch), así nunca sirve versiones viejas. */
self.addEventListener("install", function(e){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { try { d = { body: e.data.text() }; } catch (__) { d = {}; } }
  var title = d.title || "Iris";
  var opts = {
    body: d.body || "",
    icon: d.icon || "./icon-192.png",
    badge: d.badge || "./icon-192.png",
    tag: d.tag || "iris",
    renotify: true,
    data: { url: d.url || "./" }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(cs){
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        if ("focus" in c) { try { c.navigate && c.navigate(url); } catch (_) {} return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
