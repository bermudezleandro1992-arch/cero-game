import { useState } from 'react'
import { useAppVersion } from '../hooks/useAppVersion'
import { C } from '../theme'

export default function UpdateBanner() {
  const { updateAvailable, newVersion, changelog, apkUrl } = useAppVersion()
  const [dismissed, setDismissed] = useState(false)

  if (!updateAvailable || dismissed) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#005c4b', padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 700 }}>
          Nueva versión v{newVersion} disponible
        </p>
        {changelog && (
          <p style={{ margin: '2px 0 0', color: '#a8d5c8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {changelog}
          </p>
        )}
      </div>
      <a
        href={apkUrl || '/mimensajero.apk'}
        style={{
          background: '#25D366', color: '#fff', borderRadius: 10,
          padding: '6px 14px', fontSize: 13, fontWeight: 700,
          textDecoration: 'none', flexShrink: 0,
        }}
      >
        Actualizar
      </a>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8d5c8', fontSize: 18, flexShrink: 0, padding: 0 }}
      >
        ✕
      </button>
    </div>
  )
}
