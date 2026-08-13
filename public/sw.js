const VERSION = '1.5.0'
const CACHE = `mimensajero-${VERSION}`
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/icon.svg']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Network-first for API/supabase calls
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
    return
  }

  // Cache-first for static assets
  if (url.pathname.match(/\.(js|css|png|svg|woff2?|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          const clone = res.clone()  // clone eagerly before any async gap
          caches.open(CACHE).then(c => c.put(e.request, clone))
          return res
        })
        return cached || net
      })
    )
    return
  }

  // Navigate: network-first, fallback to cached shell
  e.respondWith(
    fetch(e.request).catch(() => caches.match('/') )
  )
})
