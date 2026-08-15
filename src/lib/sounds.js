let audioCtx = null
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

if (typeof window !== 'undefined') {
  const warm = () => { try { ac() } catch(e) {} }
  window.addEventListener('click', warm, { once: true })
  window.addEventListener('touchstart', warm, { once: true })
  window.addEventListener('keydown', warm, { once: true })
}

// ── Core helpers ──────────────────────────────────────────────────────────────
function tone(hz, dur, vol = 0.3, delay = 0, type = 'sine') {
  try {
    const c = ac(), o = c.createOscillator(), g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.frequency.value = hz; o.type = type
    const t = c.currentTime + delay
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.start(t); o.stop(t + dur)
  } catch(e) {}
}

function noise(dur, vol = 0.15, delay = 0) {
  try {
    const c = ac()
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    const f = c.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.5
    src.connect(f); f.connect(g); g.connect(c.destination)
    const t = c.currentTime + delay
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.start(t); src.stop(t + dur)
  } catch(e) {}
}

// ── Settings ──────────────────────────────────────────────────────────────────
const KEY_ENABLED = 'mm_sound_enabled'
const KEY_PACK    = 'mm_sound_pack'

export const soundSettings = {
  isEnabled:  () => localStorage.getItem(KEY_ENABLED) !== 'false',
  setEnabled: (v) => localStorage.setItem(KEY_ENABLED, v ? 'true' : 'false'),
  toggle() { const n = !this.isEnabled(); this.setEnabled(n); return n },
  getPack:    () => localStorage.getItem(KEY_PACK) || 'default',
  setPack:    (id) => localStorage.setItem(KEY_PACK, id),
}

// ── Sound Packs ───────────────────────────────────────────────────────────────
export const SOUND_PACKS = {
  default: {
    id: 'default', label: 'Mi Mensajero', emoji: '⚡',
    desc: 'Sonidos modernos y limpios',
    fns: {
      msgReceived() { tone(800,0.08,0.18); tone(1050,0.1,0.18,0.1) },
      msgSent()     { tone(600,0.06,0.12) },
      chatOpen()    { tone(520,0.1,0.12); tone(660,0.12,0.12,0.09) },
      groupJoin()   { tone(660,0.08,0.15); tone(784,0.08,0.15,0.08); tone(880,0.15,0.15,0.17) },
      notification(){ tone(900,0.07,0.18); tone(720,0.1,0.14,0.08) },
      nudge()       { msnNudge() },
      callConnect() { tone(900,0.1,0.3); tone(1100,0.15,0.3,0.13) },
      callEnd()     { tone(280,0.5,0.25) },
    }
  },

  msn: {
    id: 'msn', label: 'MSN Classic', emoji: '🦋',
    desc: 'Sonidos nostálgicos del MSN Messenger',
    fns: {
      msgReceived() {
        // The classic MSN "ding" — two falling tones
        tone(587, 0.15, 0.4, 0, 'sine')    // D5
        tone(392, 0.2,  0.35, 0.16, 'sine') // G4
      },
      msgSent()     { tone(659, 0.08, 0.2, 0, 'sine') },
      chatOpen()    {
        // MSN sign-in ascending chord
        tone(523, 0.12, 0.25, 0)
        tone(659, 0.12, 0.25, 0.1)
        tone(784, 0.18, 0.25, 0.2)
      },
      groupJoin()   {
        tone(784, 0.1, 0.3, 0)
        tone(880, 0.1, 0.3, 0.12)
        tone(1047,0.18, 0.3, 0.24)
      },
      notification(){ tone(587, 0.15, 0.35); tone(392, 0.2, 0.3, 0.16) },
      nudge()       { msnNudge() },
      callConnect() { tone(659, 0.1, 0.35); tone(784, 0.15, 0.35, 0.12) },
      callEnd()     { tone(392, 0.1, 0.3); tone(330, 0.4, 0.25, 0.12) },
    }
  },

  telegram: {
    id: 'telegram', label: 'Telegram', emoji: '✈️',
    desc: 'Suave y minimalista',
    fns: {
      msgReceived() { tone(1100, 0.06, 0.14, 0, 'sine'); tone(1320, 0.07, 0.1, 0.06) },
      msgSent()     { tone(880, 0.05, 0.1) },
      chatOpen()    { tone(1047, 0.1, 0.12) },
      groupJoin()   { tone(880, 0.06, 0.12); tone(1047, 0.1, 0.12, 0.07) },
      notification(){ tone(1100, 0.06, 0.14); tone(1320, 0.07, 0.1, 0.06) },
      nudge()       { msnNudge() },
      callConnect() { tone(1047, 0.12, 0.25); tone(1319, 0.15, 0.22, 0.14) },
      callEnd()     { tone(440, 0.4, 0.2) },
    }
  },

  gaming: {
    id: 'gaming', label: 'Gaming', emoji: '🎮',
    desc: 'Sonidos de videojuego, para e-sports',
    fns: {
      msgReceived() {
        tone(440, 0.04, 0.3, 0, 'square')
        tone(660, 0.06, 0.3, 0.06, 'square')
        noise(0.04, 0.08, 0.12)
      },
      msgSent()     {
        tone(330, 0.04, 0.2, 0, 'square')
        tone(440, 0.05, 0.2, 0.04, 'square')
      },
      chatOpen()    {
        tone(262, 0.05, 0.25, 0,    'square')
        tone(330, 0.05, 0.25, 0.06, 'square')
        tone(392, 0.08, 0.25, 0.12, 'square')
        tone(523, 0.1,  0.25, 0.18, 'square')
      },
      groupJoin()   {
        tone(523, 0.06, 0.3, 0,    'square')
        tone(659, 0.06, 0.3, 0.07, 'square')
        tone(784, 0.06, 0.3, 0.14, 'square')
        tone(1047,0.12, 0.3, 0.21, 'square')
        noise(0.06, 0.1, 0.27)
      },
      notification(){ tone(440,0.04,0.25,0,'square'); tone(660,0.06,0.25,0.06,'square') },
      nudge()       { msnNudge() },
      callConnect() {
        tone(262,0.04,0.3,0,'square'); tone(330,0.04,0.3,0.05,'square')
        tone(392,0.04,0.3,0.1,'square'); tone(523,0.1,0.3,0.15,'square')
      },
      callEnd()     { tone(200,0.08,0.25,0,'square'); tone(150,0.3,0.2,0.1,'square') },
    }
  },

  minimal: {
    id: 'minimal', label: 'Mínimal', emoji: '🤫',
    desc: 'Apenas perceptible, sin molestar',
    fns: {
      msgReceived() { tone(1000, 0.05, 0.06) },
      msgSent()     { tone(800, 0.04, 0.04) },
      chatOpen()    { tone(700, 0.04, 0.04) },
      groupJoin()   { tone(900, 0.05, 0.06); tone(1100, 0.06, 0.06, 0.06) },
      notification(){ tone(1000, 0.05, 0.06) },
      nudge()       { msnNudge() },
      callConnect() { tone(800, 0.08, 0.1) },
      callEnd()     { tone(400, 0.2, 0.08) },
    }
  },
}

// ── MSN Nudge ─────────────────────────────────────────────────────────────────
// Recreates the classic MSN "buzz/zumbido" as accurately as possible
function msnNudge() {
  try {
    const c = ac()
    const t = c.currentTime

    // 3 rapid vibration pulses — sawtooth at ~100Hz gives the buzzy character
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator()
      const g = c.createGain()
      const f = c.createBiquadFilter()
      f.type = 'lowpass'; f.frequency.value = 800
      o.connect(f); f.connect(g); g.connect(c.destination)
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(110, t + i * 0.11)
      o.frequency.linearRampToValueAtTime(80, t + i * 0.11 + 0.09)
      g.gain.setValueAtTime(0.45, t + i * 0.11)
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.11 + 0.1)
      o.start(t + i * 0.11)
      o.stop(t + i * 0.11 + 0.12)
    }

    // Screen shake
    if (typeof document !== 'undefined') {
      const root = document.getElementById('root')
      if (root) {
        root.style.animation = 'none'
        root.offsetHeight // reflow
        root.style.animation = 'msnNudge 0.55s cubic-bezier(.36,.07,.19,.97)'
        setTimeout(() => { root.style.animation = '' }, 600)
      }
    }
  } catch(e) {}
}

// inject nudge CSS once
if (typeof document !== 'undefined') {
  const styleId = 'msn-nudge-style'
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style')
    s.id = styleId
    s.textContent = `
      @keyframes msnNudge {
        0%,100%{transform:translate(0,0)}
        10%{transform:translate(-10px,2px)}
        20%{transform:translate(10px,-2px)}
        30%{transform:translate(-9px,2px)}
        40%{transform:translate(8px,-1px)}
        50%{transform:translate(-7px,1px)}
        60%{transform:translate(6px,0)}
        70%{transform:translate(-4px,1px)}
        80%{transform:translate(3px,0)}
        90%{transform:translate(-2px,0)}
      }
    `
    document.head.appendChild(s)
  }
}

// ── Public sounds API ─────────────────────────────────────────────────────────
function play(event) {
  if (!soundSettings.isEnabled()) return
  const pack = SOUND_PACKS[soundSettings.getPack()] || SOUND_PACKS.default
  pack.fns[event]?.()
}

export const sounds = {
  msgReceived() { play('msgReceived') },
  msgSent()     { play('msgSent') },
  chatOpen()    { play('chatOpen') },
  groupJoin()   { play('groupJoin') },
  notification(){ play('notification') },
  nudge()       { play('nudge') },  // also called when receiving a nudge
  callConnect() { play('callConnect') },
  callEnd()     { play('callEnd') },
}

// ── Ringtones (same across all packs but themed) ───────────────────────────────
let ringHandle = null
export const ringtone = {
  start() {
    const r = () => { tone(523,0.18,0.45); tone(659,0.18,0.45,0.22); tone(784,0.22,0.45,0.44) }
    r(); ringHandle = setInterval(r, 2200)
  },
  stop() { if (ringHandle) { clearInterval(ringHandle); ringHandle = null } },
}

let outRingHandle = null
export const outgoingRing = {
  start() {
    const r = () => { tone(440,0.8,0.2); tone(480,0.8,0.1,0) }
    r(); outRingHandle = setInterval(r, 3000)
  },
  stop() { if (outRingHandle) { clearInterval(outRingHandle); outRingHandle = null } },
}

// Tono de ocupado — beeps cortos dobles repetidos (como línea telefónica)
let busyHandle = null
export const busyTone = {
  start() {
    const b = () => {
      tone(480, 0.5, 0.3)
      tone(620, 0.5, 0.3)
    }
    b(); busyHandle = setInterval(b, 1100)
  },
  stop() { if (busyHandle) { clearInterval(busyHandle); busyHandle = null } },
}
