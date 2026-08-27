import { initAppWindow } from './lib/appStartup'
initAppWindow()

// Apply font size preference before React mounts
;(() => {
  try {
    const prefs = JSON.parse(localStorage.getItem('generalPrefs') || '{}')
    const map = { 'Pequeño': '13px', 'Normal': '15px', 'Grande': '17px', 'Extra grande': '20px' }
    const size = map[prefs.fontSize] || '15px'
    document.documentElement.style.setProperty('--app-font-size', size)
  } catch {}
})()

// Catch crashes before React mounts (module errors, etc.)
window.addEventListener('error', (e) => {
  const div = document.getElementById('pre-react-error')
  if (div) {
    div.style.display = 'block'
    div.querySelector('pre').textContent = `${e.message}\n${e.filename}:${e.lineno}`
  }
})
window.addEventListener('unhandledrejection', (e) => {
  const div = document.getElementById('pre-react-error')
  if (div) {
    div.style.display = 'block'
    div.querySelector('pre').textContent = String(e.reason)
  }
})

import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './lib/ThemeContext.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#b91c1c', color: '#fff', padding: 32, fontFamily: 'monospace', minHeight: '100vh' }}>
          <h2 style={{ color: '#fff', margin: '0 0 12px' }}>⚠️ Error de aplicación</h2>
          <pre style={{ color: '#FFD600', whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.message}</pre>
          <pre style={{ color: '#667078', whiteSpace: 'pre-wrap', fontSize: 11 }}>{this.state.error?.stack}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', background: '#39FF14', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
