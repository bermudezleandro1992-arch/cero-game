let audioCtx = null
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Pre-warm AudioContext on first user interaction so it's ready for incoming messages
if (typeof window !== 'undefined') {
  const warm = () => { try { ac() } catch(e) {} }
  window.addEventListener('click', warm, { once: true })
  window.addEventListener('touchstart', warm, { once: true })
  window.addEventListener('keydown', warm, { once: true })
}

// ── Sound settings ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'mm_sound_enabled'
export const soundSettings = {
  isEnabled: () => localStorage.getItem(STORAGE_KEY) !== 'false',
  setEnabled: (v) => localStorage.setItem(STORAGE_KEY, v ? 'true' : 'false'),
  toggle: () => {
    const next = !soundSettings.isEnabled()
    soundSettings.setEnabled(next)
    return next
  },
}

function tone(hz, dur, vol = 0.3, delay = 0, type = 'sine') {
  try {
    const c = ac()
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.frequency.value = hz; o.type = type
    const t = c.currentTime + delay
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.start(t); o.stop(t + dur)
  } catch (e) {}
}

export const sounds = {
  msgReceived() { if (!soundSettings.isEnabled()) return; tone(800, 0.08, 0.18); tone(1050, 0.1, 0.18, 0.1) },
  msgSent()     { if (!soundSettings.isEnabled()) return; tone(600, 0.06, 0.12) },
  callConnect() { tone(900, 0.1, 0.3); tone(1100, 0.15, 0.3, 0.13) },
  callEnd()     { tone(280, 0.5, 0.25) },
}

let ringHandle = null
export const ringtone = {
  start() {
    const r = () => { tone(880, 0.22, 0.4); tone(880, 0.22, 0.4, 0.38) }
    r(); ringHandle = setInterval(r, 2000)
  },
  stop() { if (ringHandle) { clearInterval(ringHandle); ringHandle = null } },
}
