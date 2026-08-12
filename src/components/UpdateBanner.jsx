import { useAppVersion } from '../hooks/useAppVersion'

export default function UpdateBanner() {
  const { updateAvailable, forceUpdate, newVersion, changelog } = useAppVersion()

  if (!updateAvailable) return null

  function doUpdate() {
    window.location.reload(true)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between gap-3"
      style={{ background: '#005c4b' }}>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">
          Nueva versión disponible — v{newVersion}
        </p>
        {changelog && (
          <p className="text-xs mt-0.5 truncate" style={{ color: '#a8d5c8' }}>{changelog}</p>
        )}
      </div>
      <button
        onClick={doUpdate}
        className="px-4 py-1.5 rounded-xl text-sm font-semibold flex-shrink-0"
        style={{ background: '#00a884', color: 'white' }}
      >
        Actualizar
      </button>
      {!forceUpdate && (
        <button onClick={() => {}} className="text-xs flex-shrink-0" style={{ color: '#a8d5c8' }}>
          Después
        </button>
      )}
    </div>
  )
}
