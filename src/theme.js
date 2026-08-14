// C reads from CSS variables set by applyTheme() — no component needs to change
const getCSSVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim()

export const C = new Proxy({}, {
  get(_, key) { return getCSSVar(key) }
})
