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
