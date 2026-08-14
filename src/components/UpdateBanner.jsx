import { useState } from 'react'
import { useAppVersion } from '../hooks/useAppVersion'
import { C } from '../theme'

export default function UpdateBanner() {
  const { updateAvailable, newVersion, apkUrl } = useAppVersion()
  const [dismissed, setDismissed] = useState(false)

  if (!updateAvailable || dismissed) return null

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 16, zIndex: 9999,
      background: C.panel, border: `1px solid ${C.green}44`,
      borderRadius: 16, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${C.green}22`,
      maxWidth: 320, animation: 'toastIn .3s cubic-bezier(.34,1.56,.64,1)',
    }}>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: C.green + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
          Hay una nueva versión
        </div>
        <div style={{ color: C.textDim, fontSize: 11 }}>v{newVersion} disponible</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <a href={apkUrl || '/mimensajero.apk'} style={{
          background: C.green, color: C.bg, borderRadius: 8,
          padding: '5px 12px', fontSize: 12, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>Actualizar</a>
        <button onClick={() => setDismissed(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.textDim, fontSize: 11, padding: 0,
        }}>Descartar</button>
      </div>
    </div>
  )
}
