// Sound playback utility — reads user preferences from localStorage
// Sound files should be placed in public/sounds/

const SOUND_CACHE = {}

function getSoundSettings() {
  try {
    const raw = localStorage.getItem('sound_settings')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveSoundSettings(settings) {
  try { localStorage.setItem('sound_settings', JSON.stringify(settings)) } catch {}
}

export function loadSoundSettingsFromProfile(profile) {
  if (profile?.sound_settings) saveSoundSettings(profile.sound_settings)
}

function getAudio(filename) {
  if (!SOUND_CACHE[filename]) {
    SOUND_CACHE[filename] = new Audio(`/sounds/${filename}`)
    SOUND_CACHE[filename].volume = 0.7
  }
  return SOUND_CACHE[filename]
}

async function play(filename) {
  try {
    const audio = getAudio(filename)
    audio.currentTime = 0
    await audio.play()
  } catch {}
}

export async function playMessageSound() {
  const s = getSoundSettings()
  await play(s.message || 'msg-default.mp3')
}

export async function playCommunitySound() {
  const s = getSoundSettings()
  await play(s.community || 'comm-default.mp3')
}

export async function playTorneoSound() {
  const s = getSoundSettings()
  await play(s.torneo || 'torneo-default.mp3')
}

export async function playRingtone() {
  const s = getSoundSettings()
  await play(s.ringtone || 'ring-default.mp3')
}

export async function playVideoRingtone() {
  const s = getSoundSettings()
  await play(s.video_ringtone || 'video-ring-default.mp3')
}

export function vibrateIfEnabled() {
  const s = getSoundSettings()
  if (s.vibration !== false && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200])
  }
}

// ── Legacy API (used by ProfileSheet / CallPage) ──────────────────────────────
export const SOUND_PACKS = {
  default: { id: 'default', label: 'Clásico',   emoji: '🔔', desc: 'Sonidos originales' },
  soft:    { id: 'soft',    label: 'Suave',      emoji: '🎵', desc: 'Tonos suaves' },
  retro:   { id: 'retro',   label: 'Retro',      emoji: '👾', desc: 'Estilo gaming retro' },
}

export const RINGTONES = {
  default: { id: 'default', label: 'Clásico', emoji: '📞', desc: 'Tono de llamada estándar', play: () => play('ring-default.mp3') },
  soft:    { id: 'soft',    label: 'Suave',   emoji: '🎶', desc: 'Tono suave y tranquilo',  play: () => play('ring-soft.mp3') },
  retro:   { id: 'retro',   label: 'Retro',   emoji: '🕹',  desc: 'Tono estilo 8-bit',      play: () => play('ring-retro.mp3') },
}

export const OUTGOING_TONES = {
  default: { id: 'default', label: 'Estándar', emoji: '📲', desc: 'Tono de llamada saliente', play: () => play('ring-outgoing.mp3') },
  soft:    { id: 'soft',    label: 'Suave',    emoji: '🎵', desc: 'Tono suave de llamada',    play: () => play('ring-outgoing-soft.mp3') },
}

export const soundSettings = {
  isEnabled: () => { const s = getSoundSettings(); return s.enabled !== false },
  toggle:    () => { const s = getSoundSettings(); const next = s.enabled === false; saveSoundSettings({ ...s, enabled: next }); return next },
  getPack:   () => getSoundSettings().pack || 'default',
  setPack:   (id) => saveSoundSettings({ ...getSoundSettings(), pack: id }),
}

export const ringSettings = {
  getRing: () => getSoundSettings().ringtone || 'default',
  setRing: (id) => saveSoundSettings({ ...getSoundSettings(), ringtone: id }),
  getOut:  () => getSoundSettings().outgoing || 'default',
  setOut:  (id) => saveSoundSettings({ ...getSoundSettings(), outgoing: id }),
}

// ── Loop-able sound objects for calls (start/stop API) ────────────────────────
function makeLoopSound(filename) {
  let audio = null
  return {
    start() {
      try {
        if (!audio) { audio = new Audio(`/sounds/${filename}`); audio.loop = true; audio.volume = 0.6 }
        audio.currentTime = 0
        audio.play().catch(() => {})
      } catch {}
    },
    stop() {
      try { if (audio) { audio.pause(); audio.currentTime = 0 } } catch {}
    },
  }
}

export const ringtone    = makeLoopSound('ring-default.mp3')
export const outgoingRing = makeLoopSound('ring-outgoing.mp3')
export const busyTone    = makeLoopSound('busy-tone.mp3')

// One-shot call sounds
export const sounds = {
  callConnect: () => play('call-connect.mp3'),
  callEnd:     () => play('call-end.mp3'),
}
