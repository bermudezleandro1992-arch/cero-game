const SKIN_KEY = 'app_layout_skin'

export function getSkin() {
  try { return localStorage.getItem(SKIN_KEY) || 'default' } catch { return 'default' }
}

export function setLayoutSkin(s) {
  try { localStorage.setItem(SKIN_KEY, s) } catch {}
  window.dispatchEvent(new Event('skinchange'))
}
