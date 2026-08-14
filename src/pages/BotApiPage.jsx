import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'

// Simple crypto token generator using Web Crypto API
async function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function BotApiPage({ onBack }) {
  const { profile } = useAuthStore()
  const { conversations } = useChatStore()
  const [bots, setBots] = useState([])
  const [creating, setCreating] = useState(false)
  const [newBotName, setNewBotName] = useState('')
  const [newBotConv, setNewBotConv] = useState('')
  const [copied, setCopied] = useState(null)

  const groups = conversations.filter(c => c.isGroup)

  useEffect(() => {
    if (!profile?.id) return
    loadBots()
  }, [profile?.id])

  async function loadBots() {
    const { data } = await supabase
      .from('bot_tokens')
      .select('*')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false })
    setBots(data || [])
  }

  async function createBot() {
    if (!newBotName.trim() || !newBotConv) return
    setCreating(true)
    const token = await generateToken()
    const { error } = await supabase.from('bot_tokens').insert({
      owner_id: profile.id,
      name: newBotName.trim(),
      conversation_id: newBotConv,
      token,
      active: true,
    })
    setCreating(false)
    if (error) { alert('Error: ' + error.message); return }
    setNewBotName('')
    setNewBotConv('')
    loadBots()
  }

  async function deleteBot(id) {
    if (!confirm('¿Eliminar este bot?')) return
    await supabase.from('bot_tokens').delete().eq('id', id)
    loadBots()
  }

  async function toggleBot(id, active) {
    await supabase.from('bot_tokens').update({ active: !active }).eq('id', id)
    loadBots()
  }

  function copyToken(token, id) {
    navigator.clipboard.writeText(token).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = token; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    })
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>API de Bots</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>Conectá plataformas externas para publicar mensajes</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* How it works */}
        <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ color: C.green, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>📡 Cómo funciona</div>
          <div style={{ color: C.text2, fontSize: 12, lineHeight: 1.6 }}>
            Generá un token por grupo/comunidad. Desde tu plataforma externa hacé un <strong style={{ color: C.text }}>POST</strong> con el token para publicar mensajes automáticamente — ideal para torneos, notificaciones, bots de eFootball, etc.
          </div>
          <div style={{ marginTop: 10, background: C.panel2, borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: C.green, overflowX: 'auto', whiteSpace: 'nowrap' }}>
            POST {supabaseUrl}/rest/v1/rpc/bot_send_message
          </div>
          <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: C.text2, lineHeight: 1.7 }}>
            {`{
  "bot_token": "TU_TOKEN",
  "message": "⚽ Resultado: Argentina 3-1 Brasil",
  "type": "text"
}`}
          </div>
        </div>

        {/* Create new bot */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px', marginBottom: 20 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Nuevo bot</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={newBotName}
              onChange={e => setNewBotName(e.target.value)}
              placeholder="Nombre del bot (ej: Bot Torneos eFootball)"
              style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none' }}
            />
            <select
              value={newBotConv}
              onChange={e => setNewBotConv(e.target.value)}
              style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: newBotConv ? C.text : C.textDim, fontSize: 14, outline: 'none' }}
            >
              <option value="">Seleccionar grupo o comunidad...</option>
              {groups.map(c => (
                <option key={c.id} value={c.id}>{c.isCommunity ? '🌐 ' : '👥 '}{c.name}</option>
              ))}
            </select>
            <button
              onClick={createBot}
              disabled={creating || !newBotName.trim() || !newBotConv}
              style={{
                background: C.green, border: 'none', borderRadius: 10, padding: '11px',
                color: C.bg, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                opacity: (!newBotName.trim() || !newBotConv) ? 0.4 : 1,
                transition: 'opacity .15s',
              }}
            >
              {creating ? 'Creando...' : 'Crear bot'}
            </button>
          </div>
        </div>

        {/* Bot list */}
        {bots.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.textDim, padding: '32px 0', fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
            No tenés bots creados aún
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bots.map(bot => {
              const conv = groups.find(c => c.id === bot.conversation_id)
              return (
                <div key={bot.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>🤖 {bot.name}</div>
                      <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
                        {conv ? (conv.isCommunity ? '🌐 ' : '👥 ') + conv.name : 'Grupo eliminado'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => toggleBot(bot.id, bot.active)}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                          background: bot.active ? C.green : C.border, position: 'relative', transition: 'background .2s',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2, left: bot.active ? 22 : 2,
                          width: 20, height: 20, borderRadius: '50%', background: '#fff',
                          transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        }} />
                      </button>
                      <button
                        onClick={() => deleteBot(bot.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Token display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.panel2, borderRadius: 8, padding: '8px 12px' }}>
                    <code style={{ flex: 1, fontSize: 11, color: C.textDim, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bot.token.slice(0, 12)}...{bot.token.slice(-8)}
                    </code>
                    <button
                      onClick={() => copyToken(bot.token, bot.id)}
                      style={{ background: copied === bot.id ? C.green : C.border, border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: copied === bot.id ? C.bg : C.text2, fontSize: 11, fontWeight: 600, transition: 'all .2s', flexShrink: 0 }}
                    >
                      {copied === bot.id ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>

                  <div style={{ marginTop: 6, color: C.textDim, fontSize: 10 }}>
                    Creado {new Date(bot.created_at).toLocaleDateString('es-AR')} · {bot.active ? '✓ Activo' : '○ Pausado'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* SQL migration hint */}
        <div style={{ marginTop: 24, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>SQL requerido en Supabase (una vez)</div>
          <pre style={{ margin: 0, fontSize: 10, color: C.textDim, overflowX: 'auto', lineHeight: 1.5 }}>{`-- Tabla de tokens de bots
create table if not exists bot_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  name text not null,
  conversation_id uuid references conversations(id) on delete cascade,
  token text unique not null,
  active boolean default true,
  created_at timestamptz default now()
);
alter table bot_tokens enable row level security;
create policy "owner" on bot_tokens for all using (owner_id = auth.uid());

-- Función para que el bot envíe mensajes
create or replace function bot_send_message(
  bot_token text, message text, type text default 'text'
) returns json language plpgsql security definer as $$
declare
  tok bot_tokens;
begin
  select * into tok from bot_tokens where token = bot_token and active = true;
  if not found then raise exception 'Token inválido'; end if;
  insert into messages (conversation_id, sender_id, content, type)
  values (tok.conversation_id, tok.owner_id, message, type);
  return json_build_object('ok', true);
end;
$$;`}</pre>
        </div>
      </div>
    </div>
  )
}
