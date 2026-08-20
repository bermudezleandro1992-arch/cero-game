import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'

async function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      <pre style={{
        margin: 0, background: '#0d1117', border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '12px 14px', fontFamily: 'monospace',
        fontSize: 11, color: '#e6edf3', overflowX: 'auto', lineHeight: 1.6,
        whiteSpace: 'pre',
      }}>{code}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: copied ? C.green : '#ffffff18', border: 'none',
          borderRadius: 6, padding: '3px 9px', cursor: 'pointer',
          color: copied ? '#000' : '#e6edf3', fontSize: 10, fontWeight: 700,
        }}
      >{copied ? '✓' : 'Copiar'}</button>
    </div>
  )
}

const TABS_DOC = ['cURL', 'JavaScript', 'Python', 'PHP']

export default function BotApiPage({ onBack }) {
  const { profile } = useAuthStore()
  const { conversations } = useChatStore()
  const [bots, setBots]         = useState([])
  const [creating, setCreating] = useState(false)
  const [newBotName, setNewBotName] = useState('')
  const [newBotConv, setNewBotConv] = useState('')
  const [copied, setCopied]     = useState(null)
  const [docTab, setDocTab]     = useState('cURL')
  const [expanded, setExpanded] = useState(null) // bot id
  const [logs, setLogs]         = useState({})   // botId -> []
  const [loadingLogs, setLoadingLogs] = useState(null)
  const [editWebhook, setEditWebhook] = useState({}) // botId -> url string
  const [savingWebhook, setSavingWebhook] = useState(null)

  const groups = conversations.filter(c => c.isGroup || c.isCommunity)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://TU_PROYECTO.supabase.co'
  const fnUrl = `${supabaseUrl}/functions/v1/bot-api`

  useEffect(() => { if (profile?.id) loadBots() }, [profile?.id])

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
    setNewBotName(''); setNewBotConv('')
    loadBots()
  }

  async function deleteBot(id) {
    if (!confirm('¿Eliminar este bot y todos sus logs?')) return
    await supabase.from('bot_tokens').delete().eq('id', id)
    loadBots()
  }

  async function toggleBot(id, active) {
    await supabase.from('bot_tokens').update({ active: !active }).eq('id', id)
    loadBots()
  }

  async function saveWebhook(id) {
    setSavingWebhook(id)
    await supabase.from('bot_tokens').update({ webhook_url: editWebhook[id] || null }).eq('id', id)
    setSavingWebhook(null)
    loadBots()
  }

  async function loadLogs(botId) {
    setLoadingLogs(botId)
    const { data } = await supabase
      .from('bot_logs')
      .select('action, status, payload, error, created_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(20)
    setLogs(prev => ({ ...prev, [botId]: data || [] }))
    setLoadingLogs(null)
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

  function codeExamples(token) {
    return {
      cURL: `# Enviar mensaje
curl -X POST "${fnUrl}/send" \\
  -H "Authorization: Bearer ${token || 'TU_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "⚽ Resultado: Argentina 3-1 Brasil"}'

# Enviar aviso (announcement)
curl -X POST "${fnUrl}/announce" \\
  -H "Authorization: Bearer ${token || 'TU_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "🏆 Torneo de eFootball esta noche 20hs"}'

# Info del bot
curl "${fnUrl}/info" \\
  -H "Authorization: Bearer ${token || 'TU_TOKEN'}"`,

      JavaScript: `const BOT_TOKEN = '${token || 'TU_TOKEN'}';
const API = '${fnUrl}';

// Enviar mensaje
async function sendMessage(text) {
  const res = await fetch(\`\${API}/send\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${BOT_TOKEN}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: text }),
  });
  return res.json();
}

// Aviso de torneo
sendMessage('⚽ Nuevo torneo disponible: Clasificatoria Copa Oro')
  .then(r => console.log('Enviado:', r.message_id));`,

      Python: `import requests

BOT_TOKEN = '${token || 'TU_TOKEN'}'
API = '${fnUrl}'
HEADERS = {
    'Authorization': f'Bearer {BOT_TOKEN}',
    'Content-Type': 'application/json',
}

def send_message(text: str) -> dict:
    r = requests.post(f'{API}/send',
        json={'message': text}, headers=HEADERS)
    r.raise_for_status()
    return r.json()

def announce(text: str) -> dict:
    r = requests.post(f'{API}/announce',
        json={'message': text}, headers=HEADERS)
    r.raise_for_status()
    return r.json()

# Ejemplo: notificar resultado de torneo
send_message('🏅 Ganador del torneo: @jugador99')
announce('📅 Próximo torneo: Domingo 20:00hs')`,

      PHP: `<?php
define('BOT_TOKEN', '${token || 'TU_TOKEN'}');
define('API_URL', '${fnUrl}');

function botRequest(string $endpoint, array $data): array {
    $ch = curl_init(API_URL . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . BOT_TOKEN,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($data),
    ]);
    $res = json_decode(curl_exec($ch), true);
    curl_close($ch);
    return $res;
}

// Enviar mensaje de torneo
botRequest('/send', ['message' => '⚽ Torneo iniciado!']);
botRequest('/announce', ['message' => '🏆 Resultados publicados']);`,
    }
  }

  const firstBotToken = bots[0]?.token

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>🤖 Bot API</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>Conectá plataformas externas para publicar mensajes automáticos</p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.green, background: `${C.green}18`, border: `1px solid ${C.green}33`, borderRadius: 20, padding: '3px 10px' }}>
          {bots.length} bot{bots.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Cómo funciona */}
        <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}30`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ color: C.green, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>📡 Cómo funciona</div>
          <div style={{ color: C.text2, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
            Creá un bot y asignalo a un grupo o comunidad. Desde tu plataforma externa (web, servidor, bot de Discord, etc.) publicá mensajes usando el token. Perfecto para notificaciones de torneos de eFootball, resultados en tiempo real, alertas de ligas, etc.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['POST', '/send', 'Enviar mensaje de texto al grupo'],
              ['POST', '/announce', 'Publicar aviso oficial (con 📢)'],
              ['GET',  '/info',     'Info del bot y grupo vinculado'],
              ['GET',  '/logs',     'Últimas 20 acciones del bot'],
            ].map(([method, path, desc]) => (
              <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                  background: method === 'GET' ? '#3b82f618' : '#f59e0b18',
                  color: method === 'GET' ? '#3b82f6' : '#f59e0b',
                  border: `1px solid ${method === 'GET' ? '#3b82f633' : '#f59e0b33'}`,
                  flexShrink: 0,
                }}>{method}</span>
                <code style={{ fontSize: 11, color: C.text, fontFamily: 'monospace' }}>{path}</code>
                <span style={{ fontSize: 11, color: C.textDim }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Crear nuevo bot */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px' }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>➕ Nuevo bot</div>
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
              }}
            >{creating ? 'Creando...' : 'Crear bot'}</button>
          </div>
        </div>

        {/* Lista de bots */}
        {bots.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.textDim, padding: '32px 0', fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
            No tenés bots creados aún
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Mis bots</p>
            {bots.map(bot => {
              const conv = groups.find(c => c.id === bot.conversation_id)
              const isExpanded = expanded === bot.id
              return (
                <div key={bot.id} style={{ background: C.panel, border: `1px solid ${bot.active ? C.green + '33' : C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  {/* Bot header */}
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: bot.active ? `${C.green}22` : C.panel2,
                      border: `2px solid ${bot.active ? C.green + '44' : C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>🤖</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{bot.name}</div>
                      <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
                        {conv ? (conv.isCommunity ? '🌐 ' : '👥 ') + conv.name : '⚠️ Grupo eliminado'}
                        {bot.last_used_at && (
                          <span style={{ marginLeft: 8, color: C.green }}>
                            · último uso {new Date(bot.last_used_at).toLocaleDateString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      {/* Toggle activo */}
                      <button
                        onClick={() => toggleBot(bot.id, bot.active)}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                          background: bot.active ? C.green : C.panel2, outline: `1px solid ${bot.active ? C.green : C.border}`,
                          position: 'relative', transition: 'background .2s',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2, left: bot.active ? 22 : 2,
                          width: 20, height: 20, borderRadius: '50%', background: '#fff',
                          transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        }} />
                      </button>
                      {/* Expandir */}
                      <button
                        onClick={() => {
                          setExpanded(isExpanded ? null : bot.id)
                          if (!isExpanded && !logs[bot.id]) loadLogs(bot.id)
                        }}
                        style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: C.textDim, fontSize: 11 }}
                      >{isExpanded ? '▲' : '▼'}</button>
                      {/* Eliminar */}
                      <button
                        onClick={() => deleteBot(bot.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Token */}
                  <div style={{ padding: '0 16px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bot.token.slice(0, 16)}...{bot.token.slice(-8)}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToken(bot.token, bot.id)}
                      style={{
                        background: copied === bot.id ? C.green : C.panel2, border: `1px solid ${copied === bot.id ? C.green : C.border}`,
                        borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                        color: copied === bot.id ? C.bg : C.text, fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}
                    >{copied === bot.id ? '✓ Copiado' : '📋 Token'}</button>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                      {/* Webhook */}
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>Webhook URL (opcional)</p>
                        <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textDim }}>Tu servidor recibe un POST cada vez que el bot envía un mensaje.</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            value={editWebhook[bot.id] ?? bot.webhook_url ?? ''}
                            onChange={e => setEditWebhook(prev => ({ ...prev, [bot.id]: e.target.value }))}
                            placeholder="https://tu-servidor.com/webhook"
                            style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 12, outline: 'none' }}
                          />
                          <button
                            onClick={() => saveWebhook(bot.id)}
                            disabled={savingWebhook === bot.id}
                            style={{ background: C.green, border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: C.bg, fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                          >{savingWebhook === bot.id ? '...' : 'Guardar'}</button>
                        </div>
                      </div>

                      {/* Logs */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>Últimas acciones</p>
                          <button onClick={() => loadLogs(bot.id)} style={{ background: 'none', border: 'none', color: C.green, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                            {loadingLogs === bot.id ? '...' : '↻ Actualizar'}
                          </button>
                        </div>
                        {(logs[bot.id] || []).length === 0 ? (
                          <p style={{ margin: 0, fontSize: 12, color: C.textDim, textAlign: 'center', padding: '16px 0' }}>Sin actividad aún</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {(logs[bot.id] || []).map((log, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                padding: '7px 10px', background: C.panel2, borderRadius: 8,
                                borderLeft: `3px solid ${log.status === 'ok' ? C.green : '#ef4444'}`,
                              }}>
                                <span style={{ fontSize: 11, color: log.status === 'ok' ? C.green : '#ef4444', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                                  {log.status === 'ok' ? '✓' : '✗'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{log.action}</div>
                                  {log.payload?.message && (
                                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {log.payload.message}
                                    </div>
                                  )}
                                  {log.error && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>{log.error}</div>}
                                </div>
                                <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>
                                  {new Date(log.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Documentación / ejemplos de código */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>📖 Ejemplos de integración</p>
          </div>
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginTop: 10 }}>
            {TABS_DOC.map(t => (
              <button key={t} onClick={() => setDocTab(t)} style={{
                flex: 1, padding: '8px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                color: docTab === t ? C.green : C.textDim,
                borderBottom: `2px solid ${docTab === t ? C.green : 'transparent'}`,
              }}>{t}</button>
            ))}
          </div>
          <div style={{ padding: '12px 16px 16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: C.textDim }}>
              {firstBotToken ? '🔑 Usando tu primer token real' : 'Creá un bot arriba para ver tu token real'}
            </p>
            <CodeBlock code={codeExamples(firstBotToken)[docTab]} />
          </div>
        </div>


      </div>
    </div>
  )
}
