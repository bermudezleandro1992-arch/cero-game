const VERSION = '1.6.0'
const CACHE = `mimensajero-${VERSION}`
const SHELL = ['/manifest.json', '/icon-192.png', '/icon-512.png', '/icon.svg']

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
      .then(() =>
        // Force all open tabs to reload so they pick up the new SW immediately
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients =>
          Promise.all(clients.map(c => c.navigate(c.url)))
        )
      )
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

  // Always network-first for JS and CSS bundles (Vite content-hashes handle versioning)
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

  // Cache-first for other static assets (images, fonts, icons)
  if (url.pathname.match(/\.(png|svg|woff2?|ico|webp|jpg|jpeg)$/)) {
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

  // Navigate: always network-first, fallback to cached index
  e.respondWith(
    fetch(e.request).catch(() => caches.match('/'))
  )
})
