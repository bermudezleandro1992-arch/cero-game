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
  // Incoming ring: two rising tones, repeating
  start() {
    const r = () => {
      tone(523, 0.18, 0.45)           // C5
      tone(659, 0.18, 0.45, 0.22)     // E5
      tone(784, 0.22, 0.45, 0.44)     // G5
    }
    r(); ringHandle = setInterval(r, 2200)
  },
  stop() { if (ringHandle) { clearInterval(ringHandle); ringHandle = null } },
}

let outRingHandle = null
export const outgoingRing = {
  // Outgoing ring: steady "tuuu" like a phone dial tone
  start() {
    const r = () => {
      tone(440, 0.8, 0.2)             // A4 steady
      tone(480, 0.8, 0.1, 0)
    }
    r(); outRingHandle = setInterval(r, 3000)
  },
  stop() { if (outRingHandle) { clearInterval(outRingHandle); outRingHandle = null } },
}
