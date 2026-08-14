// Called once on app load — maximizes window when running as installed PWA
export function initAppWindow() {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: window-controls-overlay)').matches
    || window.navigator.standalone === true // iOS Safari

  if (!isPWA) return // Don't interfere with regular browser tabs

  // On desktop PWA: maximize the window
  try {
    if (screen.availWidth && screen.availHeight) {
      window.moveTo(0, 0)
      window.resizeTo(screen.availWidth, screen.availHeight)
    }
  } catch {}

  // Request fullscreen on first tap/click (required by browser security policy)
  // Only do this on mobile where fullscreen feels native
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile && document.documentElement.requestFullscreen) {
    const tryFullscreen = () => {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
      window.removeEventListener('touchstart', tryFullscreen)
      window.removeEventListener('click', tryFullscreen)
    }
    window.addEventListener('touchstart', tryFullscreen, { once: true })
    window.addEventListener('click', tryFullscreen, { once: true })
  }

  // Re-request fullscreen if user accidentally exits it (e.g. swipes up)
  if (isMobile) {
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        // Small delay so the browser doesn't block immediate re-request
        setTimeout(() => {
          document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
        }, 300)
      }
    })
  }

  // Prevent pull-to-refresh on mobile (feels wrong in a native-like app)
  document.body.style.overscrollBehavior = 'none'
}

// Keep the screen awake during calls (if supported)
let wakeLock = null
export async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen')
    }
  } catch {}
}
export function releaseWakeLock() {
  wakeLock?.release?.().catch(() => {})
  wakeLock = null
}

// Re-acquire wake lock when tab becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && wakeLock !== null) {
    await acquireWakeLock()
  }
})
