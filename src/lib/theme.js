export const THEMES = {
  dark: {
    id: 'dark', label: 'Oscuro', emoji: '🌑',
    bg: '#05080A', bg2: '#0A1014', panel: '#0D151A', panel2: '#111B21',
    border: '#1C292F', text: '#FFFFFF', text2: '#A7B0B5', textDim: '#667078',
    green: '#39FF14', green2: '#19D84A', greenDk: '#0B7A2A',
    red: '#FF3B30', yellow: '#FFD600',
  },
  light: {
    id: 'light', label: 'Claro', emoji: '☀️',
    bg: '#F0F2F5', bg2: '#FFFFFF', panel: '#FFFFFF', panel2: '#F0F2F5',
    border: '#D1D7DB', text: '#111B21', text2: '#54656F', textDim: '#8696A0',
    green: '#00A884', green2: '#06CF9C', greenDk: '#005c4b',
    red: '#E53935', yellow: '#F59F0A',
  },
  ocean: {
    id: 'ocean', label: 'Océano', emoji: '🌊',
    bg: '#0E1621', bg2: '#17212B', panel: '#1C2733', panel2: '#242F3D',
    border: '#2B3A4A', text: '#FFFFFF', text2: '#A2ADB8', textDim: '#617888',
    green: '#40A7E3', green2: '#5BC8F5', greenDk: '#1A6DAA',
    red: '#EE6E6E', yellow: '#F5C142',
  },
  purple: {
    id: 'purple', label: 'Violeta', emoji: '💜',
    bg: '#0D0B14', bg2: '#131020', panel: '#1A1530', panel2: '#1F1A38',
    border: '#2D2548', text: '#FFFFFF', text2: '#A89EC4', textDim: '#6B608A',
    green: '#A78BFA', green2: '#C4B5FD', greenDk: '#5B21B6',
    red: '#F87171', yellow: '#FCD34D',
  },
}

const STORAGE_KEY = 'app_theme'

export function getSavedThemeId() {
  try { return localStorage.getItem(STORAGE_KEY) || 'dark' } catch { return 'dark' }
}

export function applyTheme(id) {
  const t = THEMES[id] || THEMES.dark
  const root = document.documentElement
  Object.entries(t).forEach(([k, v]) => {
    if (typeof v === 'string') root.style.setProperty(`--c-${k}`, v)
  })
  try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  return t
}

// Apply saved theme immediately on module load (before React renders)
applyTheme(getSavedThemeId())
