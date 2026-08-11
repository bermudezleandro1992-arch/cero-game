import { useAuthStore } from '../store/authStore'

export default function ChatListPage() {
  const { profile, signOut } = useAuthStore()

  return (
    <div className="h-full flex flex-col" style={{ background: '#111b21' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#202c33' }}>
        <h1 className="text-lg font-semibold text-white">Mi Mensajero</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: '#8696a0' }}>
            {profile?.username ? `@${profile.username}` : profile?.display_name}
          </span>
          <button
            onClick={signOut}
            className="text-sm px-3 py-1 rounded-lg"
            style={{ color: '#8696a0', background: '#2a3942' }}
          >
            Salir
          </button>
        </div>
      </div>

      {/* Placeholder conversaciones */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: '#8696a0' }}>
        <div className="text-5xl">💬</div>
        <p className="text-base">Tus conversaciones aparecerán acá</p>
        <p className="text-sm">Próximamente...</p>
      </div>
    </div>
  )
}
