/* PWA shell + push handler; no caching of authenticated API or private data. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = {} }
  const title = typeof payload.title === 'string' ? payload.title : 'Accounting Task Manager'
  const body = typeof payload.body === 'string' ? payload.body : 'Anda memiliki notifikasi baru.'
  const url = typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//') ? payload.url : '/'
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: '/icon.svg', badge: '/icon.svg', tag: payload.tag || undefined,
    data: { url },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).pathname === url)
    if (existing) return existing.focus()
    return self.clients.openWindow(url)
  }))
})
