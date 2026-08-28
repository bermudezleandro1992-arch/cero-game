const VERSION = '2.0.4'
const CACHE = `nexotribu-${VERSION}`
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/icon.svg']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {}))
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })))
    return
  }

  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request))
    )
    return
  }

  if (url.pathname.match(/\.(png|svg|woff2?|ico|webp|jpg|jpeg|apk)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
          return res
        })
        return cached || net
      })
    )
    return
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.mode === 'navigate') {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
  )
})

// ── Web Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'NexoTribu', body: e.data.text() } }

  const title = data.title || 'NexoTribu'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'mm-notification',
    data: data,
    vibrate: data.type === 'call' ? [200, 100, 200, 100, 200] : [150, 50, 150],
    requireInteraction: data.type === 'call',
    actions: data.type === 'call'
      ? [
          { action: 'accept', title: '✅ Aceptar' },
          { action: 'decline', title: '❌ Rechazar' },
        ]
      : [{ action: 'open', title: 'Ver mensaje' }],
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const data = e.notification.data || {}

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing window if open
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', action: e.action, data })
          return client.focus()
        }
      }
      // Open new window
      return clients.openWindow('/?from=notification')
    })
  )
})
