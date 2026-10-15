/* Recebe as notificações do Bolão F1 (Firebase Cloud Messaging) com o site fechado. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data.json(); } catch (_) { try { p = { notification: { body: event.data.text() } }; } catch (__) {} }
  const n = p.notification || {}, d = p.data || {};
  const title = n.title || d.title || 'Bolão F1 by Mascarelo';
  const link = (p.fcmOptions && p.fcmOptions.link) || d.url || self.registration.scope;
  event.waitUntil(self.registration.showNotification(title, {
    body: n.body || d.body || '',
    icon: n.icon || new URL('icon.png', self.registration.scope).href,
    data: { url: link },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
