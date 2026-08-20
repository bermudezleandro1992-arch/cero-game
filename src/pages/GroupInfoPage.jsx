import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import CommunityBotSettingsPage from './CommunityBotSettingsPage'

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 46, color, url, onClick }) {
  const inner = url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    : (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color || C.panel2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.34, fontWeight: 700, color: '#fff',
      }}>
        {name?.slice(0, 2).toUpperCase() || '?'}
      </div>
    )
  if (!onClick) return inner
  return <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>{inner}</button>
}

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{
        width: 46, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: value ? C.green : C.panel2,
        position: 'relative', transition: 'background .2s', flexShrink: 0,
        outline: `1px solid ${value ? C.green : C.border}`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left .2s',
      }} />
    </button>
  )
}

function SectionLabel({ label }) {
  return (
    <p style={{ margin: '0 16px 8px', fontSize: 10, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
      {label}
    </p>
  )
}

function Row({ icon, label, value, onClick, danger, right }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', cursor: onClick ? 'pointer' : 'default',
        borderBottom: `1px solid ${C.border}11`,
        transition: 'background .12s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = C.panel }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {icon && <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1, fontSize: 14, color: danger ? '#ef4444' : C.text }}>{label}</span>
      {value && <span style={{ fontSize: 12, color: C.textDim }}>{value}</span>}
      {right}
      {onClick && !right && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )
}

function RadioGroup({ label, options, value, onChange }) {
  return (
    <div style={{ padding: '16px 0 0', borderTop: `1px solid ${C.border}` }}>
      <SectionLabel label={label} />
      {options.map(([v, lbl, desc]) => (
        <div key={v} onClick={() => onChange(v)} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer',
          borderBottom: `1px solid ${C.border}11`,
          background: value === v ? `${C.green}08` : 'transparent',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${value === v ? C.green : C.border}`,
            background: value === v ? C.green : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {value === v && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.bg }} />}
          </div>
          <div>
            <span style={{ fontSize: 13, color: C.text }}>{lbl}</span>
            {desc && <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>{desc}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

function PrivacyRow({ icon, label, desc, value, onChange }) {
  return (
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}11` }}>
      <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{icon} {label}</p>
        {desc && <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textDim, lineHeight: 1.35 }}>{desc}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

// Role config within group/community
const GROUP_ROLE_CFG = {
  owner:       { label: 'Dueño',       color: '#f59e0b', icon: '👑' },
  admin:       { label: 'Admin',       color: '#ef4444', icon: '🛡️' },
  moderador:   { label: 'Moderador',   color: '#8b5cf6', icon: '🔰' },
  organizador: { label: 'Organizador', color: '#10b981', icon: '🎖️' },
  member:      { label: 'Miembro',     color: '#64748b', icon: '👤' },
}

export default function GroupInfoPage({ conversation, onBack, onLeft }) {
  const { profile } = useAuthStore()
  const { leaveGroup, pinMessage, fetchConversations } = useChatStore()
  const fileRef = useRef(null)

  // ── State ──
  const [tab, setTab] = useState('info')
  const [showBotSettings, setShowBotSettings] = useState(false)
  const [memberMenu, setMemberMenu] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [inviting, setInviting] = useState(null)
  const [roles, setRoles] = useState({})
  const [playerRanks, setPlayerRanks] = useState({})
  const [memberCustomRoles, setMemberCustomRoles] = useState({}) // userId -> roleId[]
  const [customRoleMenuMember, setCustomRoleMenuMember] = useState(null)
  const [leavingGroup, setLeavingGroup] = useState(false)
  const [rankMenuMember, setRankMenuMember] = useState(null)

  // Join requests
  const [joinRequests, setJoinRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [processingReq, setProcessingReq] = useState(null)

  // Info editable
  const [name, setName] = useState(conversation?.name || '')
  const [editingName, setEditingName] = useState(false)
  const [description, setDescription] = useState(conversation?.description || '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [isPublic, setIsPublic] = useState(conversation?.is_public || false)
  const [isLocked, setIsLocked] = useState(conversation?.is_locked || false)
  const [savingInfo, setSavingInfo] = useState(false)

  // Pinned
  const [pinText, setPinText] = useState(conversation?.pinned_message || '')
  const [editingPin, setEditingPin] = useState(false)
  const [savingPin, setSavingPin] = useState(false)

  // Permisos básicos
  const [whoCanSend, setWhoCanSend] = useState(conversation?.who_can_send || 'everyone')
  const [whoCanAdd,  setWhoCanAdd]  = useState(conversation?.who_can_add  || 'everyone')
  const [whoCanEdit, setWhoCanEdit] = useState(conversation?.who_can_edit_info || 'everyone')
  const [slowMode,   setSlowMode]   = useState(conversation?.slow_mode_seconds || null)
  const [autoDelete, setAutoDelete] = useState(conversation?.auto_delete_hours || null)

  // Community torneos config
  const [torneosEnabled,  setTorneosEnabled]  = useState(conversation?.torneos_enabled  !== false)
  const [ligasEnabled,    setLigasEnabled]    = useState(conversation?.ligas_enabled    !== false)
  const [clanesEnabled,   setClanesEnabled]   = useState(conversation?.clanes_enabled   || false)
  const [communityGames,  setCommunityGames]  = useState(conversation?.tags || [])
  const [savingTorneos,   setSavingTorneos]   = useState(false)
  const [gameRules,       setGameRules]       = useState(conversation?.game_rules || {})
  const [rulesTab,        setRulesTab]        = useState('efootball')

  // Privacidad avanzada
  const [allowExport,      setAllowExport]      = useState(conversation?.allow_export      !== false)
  const [allowAutoSave,    setAllowAutoSave]    = useState(conversation?.allow_auto_save    !== false)
  const [announcementOnly, setAnnouncementOnly] = useState(conversation?.announcement_only || false)
  const [requireApproval,  setRequireApproval]  = useState(conversation?.require_approval  || false)
  const [savingPerms, setSavingPerms] = useState(false)

  // Invite link — token stored in DB, full URL shown to user
  const rawToken = conversation?.invite_link || ''
  const [inviteLink, setInviteLink] = useState(
    rawToken ? `${window.location.origin}/join/${rawToken}` : ''
  )
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Media
  const [media, setMedia] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)

  // Stats
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Roles PRO
  const [customRoles, setCustomRoles] = useState([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const ROLE_PERMS_DEFAULT = {
    can_send_messages: true,
    can_create_tournaments: false,
    can_manage_tournaments: false,
    can_create_events: false,
    can_publish_announcements: false,
    can_manage_members: false,
    can_kick_members: false,
    can_manage_roles: false,
    can_view_stats: false,
    can_manage_bots: false,
  }
  const [roleForm, setRoleForm] = useState({ name: '', color: '#8b5cf6', icon: '', ...ROLE_PERMS_DEFAULT })
  const [editingRole, setEditingRole] = useState(null) // role object being edited
  const [savingRole, setSavingRole] = useState(false)
  const [deletingRole, setDeletingRole] = useState(null)

  const members = conversation?.members || []
  const allMembers = [
    { id: profile?.id, display_name: profile?.display_name, username: profile?.username, avatar_url: profile?.avatar_url, isMe: true },
    ...members.filter(m => m?.id !== profile?.id).map(m => ({ ...m, isMe: false })),
  ]

  const myRole = roles[profile?.id]
  const isOwner = conversation?.created_by === profile?.id
  const isAdmin = isOwner || myRole === 'owner' || myRole === 'admin'
  const isMod   = isAdmin || myRole === 'moderador'
  const isOrganizador = isMod || myRole === 'organizador'
  const isCommunity = conversation?.group_type === 'community'
  const isPROOwner  = ['ceo', 'admin', 'comunidad'].includes(conversation?.owner_role || '')

  // ── Load roles ──
  useEffect(() => {
    if (!conversation?.id) return
    supabase.from('group_roles')
      .select('user_id, role, player_rank')
      .eq('conversation_id', conversation.id)
      .then(({ data }) => {
        const roleMap = {}
        const rankMap = {}
        ;(data || []).forEach(r => {
          roleMap[r.user_id] = r.role
          if (r.player_rank) rankMap[r.user_id] = r.player_rank
        })
        if (conversation.created_by && !roleMap[conversation.created_by]) {
          roleMap[conversation.created_by] = 'owner'
        }
        setRoles(roleMap)
        setPlayerRanks(rankMap)
      })
  }, [conversation?.id])

  // ── Load media ──
  useEffect(() => {
    if (tab !== 'media' || !conversation?.id) return
    setMediaLoading(true)
    supabase.from('messages')
      .select('id, content, created_at, sender_id')
      .eq('conversation_id', conversation.id)
      .eq('type', 'image')
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => { setMedia(data || []); setMediaLoading(false) })
  }, [tab, conversation?.id])

  // ── Load stats ──
  useEffect(() => {
    if (tab !== 'stats' || !conversation?.id || !isAdmin) return
    setStatsLoading(true)
    supabase.from('community_stats')
      .select('*')
      .eq('conversation_id', conversation.id)
      .single()
      .then(({ data }) => { setStats(data || null); setStatsLoading(false) })
  }, [tab, conversation?.id, isAdmin])

  // ── Load custom roles ──
  useEffect(() => {
    if (!conversation?.id || !isCommunity) return
    supabase.from('community_custom_roles')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('priority', { ascending: false })
      .then(({ data }) => setCustomRoles(data || []))
  }, [conversation?.id, isCommunity])

  // ── Load member custom role assignments ──
  useEffect(() => {
    if (!conversation?.id || !isCommunity) return
    supabase.from('community_role_members')
      .select('user_id, role_id')
      .eq('conversation_id', conversation.id)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(r => {
          if (!map[r.user_id]) map[r.user_id] = []
          map[r.user_id].push(r.role_id)
        })
        setMemberCustomRoles(map)
      })
  }, [conversation?.id, isCommunity])

  // ── Load join requests ──
  useEffect(() => {
    if (tab !== 'requests' || !conversation?.id || !isAdmin) return
    setLoadingRequests(true)
    supabase.from('join_requests')
      .select('id, user_id, status, requested_at, users:user_id(id, display_name, username, avatar_url)')
      .eq('conversation_id', conversation.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })
      .then(({ data }) => { setJoinRequests(data || []); setLoadingRequests(false) })
  }, [tab, conversation?.id, isAdmin])

  // ── Invite search ──
  useEffect(() => {
    if (!inviteSearch.trim()) { setInviteResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('users')
        .select('id, display_name, username, avatar_url')
        .or(`username.ilike.%${inviteSearch.replace('@','')}%,display_name.ilike.%${inviteSearch}%`)
        .neq('id', profile.id)
        .limit(8)
      const memberIds = new Set(allMembers.map(m => m.id))
      setInviteResults((data || []).filter(u => !memberIds.has(u.id)))
    }, 300)
    return () => clearTimeout(t)
  }, [inviteSearch])

  // ── Handlers ──
  async function saveName() {
    if (!name.trim()) return
    setSavingInfo(true)
    await supabase.from('conversations').update({ name: name.trim() }).eq('id', conversation.id)
    setSavingInfo(false); setEditingName(false)
  }

  async function saveDesc() {
    setSavingInfo(true)
    await supabase.from('conversations').update({ description: description.trim() }).eq('id', conversation.id)
    setSavingInfo(false); setEditingDesc(false)
  }

  async function savePin() {
    if (!pinText.trim()) return
    setSavingPin(true)
    await pinMessage(conversation.id, pinText.trim())
    setSavingPin(false); setEditingPin(false)
  }

    const PERM_GROUPS = [
    {
      label: 'General',
      items: [
        { key: 'can_send_messages', label: 'Enviar mensajes', desc: 'Puede escribir en los canales de la comunidad' },
        { key: 'can_view_stats', label: 'Ver estadísticas', desc: 'Acceso a la pestaña de stats de la comunidad' },
      ],
    },
    {
      label: 'Torneos & Eventos',
      items: [
        { key: 'can_create_tournaments', label: 'Crear torneos', desc: 'Puede crear torneos y ligas dentro de la comunidad' },
        { key: 'can_manage_tournaments', label: 'Gestionar torneos', desc: 'Puede editar y eliminar torneos existentes' },
        { key: 'can_create_events', label: 'Crear eventos', desc: 'Puede publicar eventos en la comunidad' },
      ],
    },
    {
      label: 'Moderación',
      items: [
        { key: 'can_publish_announcements', label: 'Publicar anuncios', desc: 'Puede publicar anuncios para todos los miembros' },
        { key: 'can_manage_members', label: 'Gestionar miembros', desc: 'Puede ver y administrar la lista de miembros' },
        { key: 'can_kick_members', label: 'Expulsar miembros', desc: 'Puede expulsar miembros de la comunidad' },
      ],
    },
    {
      label: 'Administración',
      items: [
        { key: 'can_manage_roles', label: 'Gestionar roles', desc: 'Puede crear, editar y asignar roles personalizados' },
        { key: 'can_manage_bots', label: 'Gestionar bots', desc: 'Puede configurar bots de la comunidad' },
      ],
    },
  ]

  function openRoleForm(role = null) {
    if (role) {
      setEditingRole(role)
      setRoleForm({ name: role.name, color: role.color, icon: role.icon || '', ...Object.fromEntries(Object.keys(ROLE_PERMS_DEFAULT).map(k => [k, role[k] ?? ROLE_PERMS_DEFAULT[k]])) })
    } else {
      setEditingRole(null)
      setRoleForm({ name: '', color: '#8b5cf6', icon: '', ...ROLE_PERMS_DEFAULT })
    }
    setShowRoleForm(true)
  }

  function closeRoleForm() {
    setShowRoleForm(false)
    setEditingRole(null)
    setRoleForm({ name: '', color: '#8b5cf6', icon: '', ...ROLE_PERMS_DEFAULT })
  }

  async function saveCustomRole() {
    if (!roleForm.name.trim()) return
    setSavingRole(true)
    const perms = Object.fromEntries(Object.keys(ROLE_PERMS_DEFAULT).map(k => [k, !!roleForm[k]]))
    if (editingRole) {
      const { data, error } = await supabase.from('community_custom_roles').update({
        name: roleForm.name.trim(), color: roleForm.color,
        icon: roleForm.icon.trim() || null, ...perms,
      }).eq('id', editingRole.id).select().single()
      if (!error && data) setCustomRoles(prev => prev.map(r => r.id === data.id ? data : r))
    } else {
      const { data, error } = await supabase.from('community_custom_roles').insert({
        conversation_id: conversation.id,
        name: roleForm.name.trim(), color: roleForm.color,
        icon: roleForm.icon.trim() || null,
        priority: customRoles.length, ...perms,
      }).select().single()
      if (!error && data) setCustomRoles(prev => [data, ...prev])
    }
    setSavingRole(false)
    closeRoleForm()
  }

  async function deleteCustomRole(roleId) {
    setDeletingRole(roleId)
    await supabase.from('community_custom_roles').delete().eq('id', roleId)
    setCustomRoles(prev => prev.filter(r => r.id !== roleId))
    setDeletingRole(null)
  }

  async function togglePublic() {
    const next = !isPublic; setIsPublic(next)
    await supabase.from('conversations').update({ is_public: next }).eq('id', conversation.id)
  }

  async function toggleLocked() {
    const next = !isLocked; setIsLocked(next)
    await supabase.from('conversations').update({ is_locked: next }).eq('id', conversation.id)
  }

  async function savePerms() {
    setSavingPerms(true)
    await supabase.from('conversations').update({
      who_can_send:      whoCanSend,
      who_can_add:       whoCanAdd,
      who_can_edit_info: whoCanEdit,
      slow_mode_seconds: slowMode,
      auto_delete_hours: autoDelete,
      allow_export:      allowExport,
      allow_auto_save:   allowAutoSave,
      announcement_only: announcementOnly,
      require_approval:  requireApproval,
    }).eq('id', conversation.id)
    setSavingPerms(false)
  }

  async function generateInviteLink() {
    setGeneratingLink(true)
    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
    const link = `${window.location.origin}/join/${token}`
    await supabase.from('conversations').update({ invite_link: token }).eq('id', conversation.id)
    setInviteLink(link)
    setGeneratingLink(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function revokeLink() {
    if (!window.confirm('¿Revocar el enlace actual? El anterior dejará de funcionar.')) return
    await supabase.from('conversations').update({ invite_link: null }).eq('id', conversation.id)
    setInviteLink('')
  }

  async function inviteMember(user) {
    setInviting(user.id)
    await supabase.from('conversation_members').upsert(
      { conversation_id: conversation.id, user_id: user.id },
      { onConflict: 'conversation_id,user_id' }
    )
    setInviting(null); setInviteSearch(''); setInviteResults([])
    fetchConversations(profile.id)
  }

  async function setRole(memberId, role) {
    await supabase.from('group_roles').upsert(
      { conversation_id: conversation.id, user_id: memberId, role, granted_by: profile.id },
      { onConflict: 'conversation_id,user_id' }
    )
    setRoles(prev => ({ ...prev, [memberId]: role }))
    setMemberMenu(null)
  }

  async function setPlayerRank(memberId, rank) {
    await supabase.from('group_roles').upsert(
      { conversation_id: conversation.id, user_id: memberId, role: roles[memberId] || 'member', player_rank: rank || null, granted_by: profile.id },
      { onConflict: 'conversation_id,user_id' }
    )
    setPlayerRanks(prev => rank ? { ...prev, [memberId]: rank } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== memberId)))
    setRankMenuMember(null)
    setMemberMenu(null)
  }

  async function assignCustomRole(memberId, roleId) {
    await supabase.from('community_role_members').upsert(
      { conversation_id: conversation.id, user_id: memberId, role_id: roleId, assigned_by: profile.id },
      { onConflict: 'conversation_id,user_id,role_id' }
    )
    setMemberCustomRoles(prev => ({
      ...prev,
      [memberId]: [...new Set([...(prev[memberId] || []), roleId])],
    }))
    setCustomRoleMenuMember(null)
    setMemberMenu(null)
  }

  async function removeCustomRole(memberId, roleId) {
    await supabase.from('community_role_members').delete()
      .eq('conversation_id', conversation.id)
      .eq('user_id', memberId)
      .eq('role_id', roleId)
    setMemberCustomRoles(prev => ({
      ...prev,
      [memberId]: (prev[memberId] || []).filter(id => id !== roleId),
    }))
    setCustomRoleMenuMember(null)
    setMemberMenu(null)
  }

  async function silenceMember(memberId, hours) {
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString()
    await supabase.from('conversation_members')
      .update({ muted_until: until })
      .eq('conversation_id', conversation.id)
      .eq('user_id', memberId)
    setMemberMenu(null)
  }

  async function unsilenceMember(memberId) {
    await supabase.from('conversation_members')
      .update({ muted_until: null })
      .eq('conversation_id', conversation.id)
      .eq('user_id', memberId)
    setMemberMenu(null)
  }

  async function kickMember(memberId) {
    if (!window.confirm('¿Expulsar a este miembro?')) return
    await supabase.from('conversation_members')
      .delete().eq('conversation_id', conversation.id).eq('user_id', memberId)
    await supabase.from('group_roles')
      .delete().eq('conversation_id', conversation.id).eq('user_id', memberId)
    setMemberMenu(null)
    fetchConversations(profile.id)
  }

  async function saveTorneosConfig() {
    setSavingTorneos(true)
    await supabase.from('conversations').update({
      torneos_enabled: torneosEnabled,
      ligas_enabled:   ligasEnabled,
      clanes_enabled:  clanesEnabled,
      tags:            communityGames,
      game_rules:      gameRules,
    }).eq('id', conversation.id)
    setSavingTorneos(false)
  }

  function setRule(game, key, value) {
    setGameRules(prev => ({
      ...prev,
      [game]: { ...(prev[game] || {}), [key]: value },
    }))
  }

  function getRule(game, key, defaultVal) {
    return gameRules?.[game]?.[key] ?? defaultVal
  }

  async function handleLeave() {
    if (!window.confirm('¿Salir del grupo?')) return
    setLeavingGroup(true)
    await leaveGroup(conversation.id, profile.id)
    onLeft?.()
  }

  async function handleDeleteGroup() {
    const label = isCommunity ? 'comunidad' : 'grupo'
    if (!window.confirm(`⚠️ ¿Eliminar la ${label} permanentemente? Esto borrará todos los mensajes y no se puede deshacer.`)) return
    const { data, error } = await supabase.rpc('delete_group_or_community', { p_conversation_id: conversation.id })
    if (error || data?.ok === false) {
      alert('Error al eliminar: ' + (data?.error || error?.message || 'Error desconocido'))
      return
    }
    onLeft?.()
  }

  async function uploadAvatar(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase().replace('jpeg', 'jpg')
    const path = `group-avatars/${conversation.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
    if (error) { alert('Error al subir imagen: ' + error.message); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = data.publicUrl + '?t=' + Date.now()
    await supabase.from('conversations').update({ avatar_url: publicUrl }).eq('id', conversation.id)
  }

  async function approveRequest(reqId) {
    setProcessingReq(reqId)
    await supabase.rpc('approve_join_request', { p_request_id: reqId })
    setJoinRequests(prev => prev.filter(r => r.id !== reqId))
    setProcessingReq(null)
    fetchConversations(profile.id)
  }

  async function rejectRequest(reqId) {
    setProcessingReq(reqId)
    await supabase.from('join_requests')
      .update({ status: 'rejected', reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('id', reqId)
    setJoinRequests(prev => prev.filter(r => r.id !== reqId))
    setProcessingReq(null)
  }

  const filteredMembers = memberSearch
    ? allMembers.filter(m =>
        (m.display_name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.username || '').toLowerCase().includes(memberSearch.toLowerCase())
      )
    : allMembers

  const TABS = [
    { id: 'info',     label: '📋 Info' },
    { id: 'members',  label: '👥 Miembros' },
    { id: 'perms',    label: '🔐 Permisos' },
    ...(isCommunity ? [{ id: 'torneos', label: '🏆 Torneos' }] : []),
    ...(isAdmin && requireApproval ? [{ id: 'requests', label: `📬 Solicitudes${joinRequests.length ? ` (${joinRequests.length})` : ''}` }] : []),
    ...(isCommunity && isAdmin ? [{ id: 'stats', label: '📊 Stats' }] : []),
    ...(isCommunity && isAdmin ? [{ id: 'roles', label: '🎭 Roles' }] : []),
    { id: 'media',    label: '🖼 Medios' },
  ]

  // ── RENDER ────────────────────────────────────────────────────────────────────
  if (showBotSettings) {
    return <CommunityBotSettingsPage conversation={conversation} onBack={() => setShowBotSettings(false)} />
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16, flex: 1 }}>
          Info del {conversation?.group_type === 'community' ? 'comunidad' : 'grupo'}
        </h2>
        {announcementOnly && (
          <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b33', borderRadius: 20, padding: '3px 8px' }}>
            📢 Solo avisos
          </span>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 6px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            color: tab === t.id ? C.green : C.textDim,
            borderBottom: `2px solid ${tab === t.id ? C.green : 'transparent'}`,
            transition: 'color .15s', whiteSpace: 'nowrap', minWidth: 70,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ════ TAB: INFO ════ */}
        {tab === 'info' && (
          <>
            {/* Hero: avatar + name */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '28px 20px 20px',
              background: `radial-gradient(ellipse at 50% 0%, ${C.greenDk}22 0%, transparent 65%)`,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <div style={{
                  width: 90, height: 90, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.greenDk}88, ${C.panel2})`,
                  border: `2px solid ${C.green}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 34, fontWeight: 800, color: C.text,
                  boxShadow: `0 0 32px ${C.green}22`, overflow: 'hidden',
                }}>
                  {conversation?.avatar_url
                    ? <img src={conversation.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : conversation?.name?.slice(0, 2).toUpperCase() || '👥'
                  }
                </div>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => fileRef.current?.click()}
                      style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 28, height: 28, borderRadius: '50%',
                        background: C.green, border: `2px solid ${C.bg}`,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => uploadAvatar(e.target.files?.[0])} />
                  </>
                )}
              </div>

              {/* Name editable */}
              {editingName ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', maxWidth: 280 }}>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                    style={{
                      flex: 1, background: C.panel2, border: `1px solid ${C.green}`,
                      borderRadius: 10, padding: '8px 12px', color: C.text,
                      fontSize: 16, fontWeight: 700, outline: 'none', textAlign: 'center',
                    }}
                  />
                  <button onClick={saveName} disabled={savingInfo} style={{ background: C.green, border: 'none', borderRadius: 8, padding: '8px 12px', color: C.bg, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                    {savingInfo ? '...' : 'OK'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>{name || conversation?.name}</p>
                  {isAdmin && (
                    <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4 }}>✏️</button>
                  )}
                </div>
              )}
              <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textDim }}>
                {conversation?.group_type === 'community' ? 'Comunidad' : 'Grupo'} · {allMembers.length} participantes
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {isLocked && (
                  <span style={{ fontSize: 11, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b33', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>
                    🔒 Bloqueado
                  </span>
                )}
                {announcementOnly && (
                  <span style={{ fontSize: 11, color: '#3b82f6', background: '#3b82f618', border: '1px solid #3b82f633', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>
                    📢 Solo avisos
                  </span>
                )}
                {requireApproval && (
                  <span style={{ fontSize: 11, color: '#10b981', background: '#10b98118', border: '1px solid #10b98133', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>
                    ✅ Aprobación requerida
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}` }}>
              <SectionLabel label="Descripción" />
              {editingDesc ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={description} onChange={e => setDescription(e.target.value)}
                    autoFocus rows={3}
                    placeholder="Describí de qué trata este grupo..."
                    style={{
                      width: '100%', background: C.panel2, border: `1px solid ${C.green}`,
                      borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13,
                      resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingDesc(false)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel2, color: C.textDim, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                    <button onClick={saveDesc} disabled={savingInfo} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: C.green, color: C.bg, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{savingInfo ? '...' : 'Guardar'}</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={isAdmin ? () => setEditingDesc(true) : undefined}
                  style={{
                    padding: '10px 12px', background: C.panel2, borderRadius: 10,
                    border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`,
                    cursor: isAdmin ? 'pointer' : 'default',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, color: description ? C.text2 : C.textDim, lineHeight: 1.4 }}>
                    {description || (isAdmin ? 'Tocá para agregar descripción...' : 'Sin descripción')}
                  </p>
                </div>
              )}
            </div>

            {/* Pinned message */}
            <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}` }}>
              <SectionLabel label="Mensaje fijado" />
              {editingPin ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={pinText} onChange={e => setPinText(e.target.value)}
                    autoFocus rows={3}
                    placeholder="Mensaje visible para todos en el chat..."
                    style={{
                      width: '100%', background: C.panel2, border: `1px solid ${C.green}`,
                      borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13,
                      resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingPin(false)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel2, color: C.textDim, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                    <button onClick={savePin} disabled={savingPin || !pinText.trim()} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: C.green, color: C.bg, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{savingPin ? '...' : 'Fijar'}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1, padding: '10px 12px', background: C.panel2,
                    borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`,
                  }}>
                    <p style={{ margin: 0, fontSize: 13, color: conversation?.pinned_message ? C.text2 : C.textDim, lineHeight: 1.4 }}>
                      {conversation?.pinned_message || 'Sin mensaje fijado'}
                    </p>
                  </div>
                  {isMod && (
                    <button onClick={() => setEditingPin(true)} style={{
                      background: `${C.green}15`, border: `1px solid ${C.green}33`,
                      borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                      color: C.green, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>📌 Editar</button>
                  )}
                </div>
              )}
            </div>

            {/* Invite link */}
            {isAdmin && (
              <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}` }}>
                <SectionLabel label="Enlace de invitación" />
                {inviteLink ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px',
                    }}>
                      <p style={{ margin: 0, flex: 1, fontSize: 12, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteLink}</p>
                      <button onClick={copyLink} style={{ background: linkCopied ? `${C.green}22` : `${C.green}15`, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: C.green, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {linkCopied ? '✓ Copiado' : '📋 Copiar'}
                      </button>
                    </div>
                    <button onClick={revokeLink} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', cursor: 'pointer', color: '#ef4444', fontSize: 12 }}>
                      🔄 Revocar enlace
                    </button>
                  </div>
                ) : (
                  <button onClick={generateInviteLink} disabled={generatingLink} style={{
                    width: '100%', padding: '10px', borderRadius: 10,
                    background: `${C.green}15`, border: `1px solid ${C.green}33`,
                    color: C.green, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {generatingLink ? '...' : '🔗 Generar enlace de invitación'}
                  </button>
                )}
              </div>
            )}

            {/* Bot Settings PRO */}
            {isCommunity && isAdmin && (
              <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}` }}>
                {conversation?.plan === 'pro' ? (
                  <button onClick={() => setShowBotSettings(true)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    background: `linear-gradient(135deg, #f59e0b18, #f59e0b08)`,
                    border: `1px solid #f59e0b44`, textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 22 }}>🤖</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Bot Settings</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b33', borderRadius: 20, padding: '1px 7px' }}>PRO</span>
                      </div>
                      <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>Plantillas y alertas automáticas</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 12,
                    background: C.panel2, border: `1px solid ${C.border}`,
                  }}>
                    <span style={{ fontSize: 22 }}>🤖</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: C.textDim, fontWeight: 700, fontSize: 13 }}>Bot API & Plantillas</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b33', borderRadius: 20, padding: '1px 7px' }}>PRO</span>
                      </div>
                      <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>Solo disponible en comunidades PRO</div>
                    </div>
                    <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>Actualizar</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
              <Row icon="🚩" label={`Reportar ${isCommunity ? 'comunidad' : 'grupo'}`} onClick={() => alert('Reporte enviado. Gracias.')} />
              <Row icon="🚪" label={`Salir del ${isCommunity ? 'la comunidad' : 'grupo'}`} danger onClick={handleLeave} />
              {isOwner && (
                <Row icon="💣" label={`Eliminar ${isCommunity ? 'comunidad' : 'grupo'}`} danger onClick={handleDeleteGroup} />
              )}
            </div>
          </>
        )}

        {/* ════ TAB: MIEMBROS ════ */}
        {tab === 'members' && (
          <>
            {/* Search members */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 12px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
                <input
                  value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Buscar en miembros..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13, padding: '9px 0' }}
                />
              </div>
            </div>

            {/* Invite new member */}
            {(isAdmin || whoCanAdd === 'everyone') && (
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.panel2, border: `1px solid ${C.green}44`, borderRadius: 10, padding: '0 12px' }}>
                  <span style={{ fontSize: 15 }}>➕</span>
                  <input
                    value={inviteSearch} onChange={e => setInviteSearch(e.target.value)}
                    placeholder="Agregar miembro por nombre o @usuario..."
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13, padding: '9px 0' }}
                  />
                </div>
                {inviteResults.length > 0 && (
                  <div style={{ marginTop: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    {inviteResults.map(u => (
                      <div key={u.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        borderBottom: `1px solid ${C.border}11`,
                      }}>
                        <Avatar name={u.display_name} size={36} color={avatarColor(u.id)} url={u.avatar_url} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>{u.display_name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>@{u.username}</p>
                        </div>
                        <button
                          onClick={() => inviteMember(u)}
                          disabled={inviting === u.id}
                          style={{ background: C.green, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.bg, fontSize: 12, fontWeight: 700 }}
                        >{inviting === u.id ? '...' : 'Agregar'}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Members list */}
            <p style={{ margin: '12px 16px 6px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {filteredMembers.length} {memberSearch ? 'resultados' : 'participantes'}
            </p>
            {filteredMembers.map(m => {
              const mRole = roles[m.id] || (m.id === conversation?.created_by ? 'owner' : 'member')
              const rcfg = GROUP_ROLE_CFG[mRole] || GROUP_ROLE_CFG.member
              const mRank = playerRanks[m.id]
              const mCustomRoleIds = memberCustomRoles[m.id] || []
              const mCustomRoles = customRoles.filter(r => mCustomRoleIds.includes(r.id))
              return (
                <div key={m.id} style={{ position: 'relative' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', borderBottom: `1px solid ${C.border}11`,
                  }}>
                    <Avatar name={m.display_name} size={44} color={avatarColor(m.id)} url={m.avatar_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: m.isMe ? C.green : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.display_name}
                        </p>
                        {m.isMe && <span style={{ fontSize: 10, color: C.textDim }}>(Vos)</span>}
                        {mRole !== 'member' && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '1px 5px',
                            color: rcfg.color, background: `${rcfg.color}18`, border: `1px solid ${rcfg.color}33`,
                            textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
                          }}>{rcfg.icon} {rcfg.label}</span>
                        )}
                        {mCustomRoles.map(cr => (
                          <span key={cr.id} style={{
                            fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '1px 5px',
                            color: cr.color, background: `${cr.color}18`, border: `1px solid ${cr.color}33`,
                            whiteSpace: 'nowrap',
                          }}>{cr.icon} {cr.name}</span>
                        ))}
                        {mRank && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '1px 5px',
                            color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b33',
                            letterSpacing: '0.5px', whiteSpace: 'nowrap',
                          }}>⭐ {mRank}</span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>@{m.username}</p>
                    </div>
                    {isMod && !m.isMe && (
                      <button onClick={() => { setMemberMenu(memberMenu === m.id ? null : m.id); setRankMenuMember(null); setCustomRoleMenuMember(null) }} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 6, borderRadius: 8, display: 'flex',
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </button>
                    )}
                  </div>

                  {/* Member action menu */}
                  {memberMenu === m.id && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', right: 12, top: '100%', zIndex: 50,
                        background: C.panel, border: `1px solid ${C.border}`,
                        borderRadius: 12, overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 210,
                      }}
                    >
                      {isAdmin && mRole !== 'owner' && (
                        <>
                          <div style={{ padding: '7px 14px 4px', fontSize: 10, color: C.textDim, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Asignar rol</div>
                          {mRole !== 'admin'       && <ModeBtn label="🛡️ Hacer Admin"       onClick={() => setRole(m.id, 'admin')} />}
                          {mRole !== 'moderador'   && <ModeBtn label="🔰 Hacer Moderador"   onClick={() => setRole(m.id, 'moderador')} />}
                          {mRole !== 'organizador' && <ModeBtn label="🎖️ Hacer Organizador" onClick={() => setRole(m.id, 'organizador')} />}
                          {mRole !== 'member'      && <ModeBtn label="👤 Quitar rol"         onClick={() => setRole(m.id, 'member')} />}
                          <div style={{ height: 1, background: C.border }} />
                        </>
                      )}
                      {isCommunity && isAdmin && (
                        <>
                          <div style={{ padding: '7px 14px 4px', fontSize: 10, color: C.textDim, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Rango de jugador</div>
                          {rankMenuMember === m.id ? (
                            <div style={{ padding: '6px 14px 10px' }}>
                              {['Bronce','Plata','Oro','Platino','Diamante','Élite','Leyenda'].map(rank => (
                                <button key={rank} onClick={() => setPlayerRank(m.id, rank)} style={{
                                  display: 'block', width: '100%', textAlign: 'left',
                                  padding: '6px 8px', borderRadius: 6, border: 'none',
                                  background: mRank === rank ? '#f59e0b22' : 'transparent',
                                  color: mRank === rank ? '#f59e0b' : C.text2,
                                  fontSize: 13, cursor: 'pointer', fontWeight: mRank === rank ? 700 : 400,
                                }}>⭐ {rank}</button>
                              ))}
                              {mRank && <button onClick={() => setPlayerRank(m.id, null)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>✕ Quitar rango</button>}
                            </div>
                          ) : (
                            <ModeBtn label={mRank ? `⭐ Rango: ${mRank}` : '⭐ Asignar rango'} onClick={() => setRankMenuMember(m.id)} />
                          )}
                          <div style={{ height: 1, background: C.border }} />
                        </>
                      )}
                      {isCommunity && isAdmin && customRoles.length > 0 && (
                        <>
                          <div style={{ padding: '7px 14px 4px', fontSize: 10, color: C.textDim, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Roles personalizados</div>
                          {customRoleMenuMember === m.id ? (
                            <div style={{ padding: '6px 14px 10px' }}>
                              {customRoles.map(cr => {
                                const hasRole = mCustomRoleIds.includes(cr.id)
                                return (
                                  <button key={cr.id} onClick={() => hasRole ? removeCustomRole(m.id, cr.id) : assignCustomRole(m.id, cr.id)} style={{
                                    display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                    padding: '6px 8px', borderRadius: 6, border: 'none',
                                    background: hasRole ? `${cr.color}18` : 'transparent',
                                    cursor: 'pointer', textAlign: 'left',
                                  }}>
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 6px',
                                      color: cr.color, background: `${cr.color}18`, border: `1px solid ${cr.color}33`,
                                    }}>{cr.icon} {cr.name}</span>
                                    {hasRole && <span style={{ fontSize: 11, color: '#22c55e', marginLeft: 'auto' }}>✓</span>}
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <ModeBtn
                              label={mCustomRoles.length > 0 ? `🎭 Roles: ${mCustomRoles.map(r => r.name).join(', ')}` : '🎭 Asignar rol personalizado'}
                              onClick={() => setCustomRoleMenuMember(m.id)}
                            />
                          )}
                          <div style={{ height: 1, background: C.border }} />
                        </>
                      )}
                      <div style={{ padding: '7px 14px 4px', fontSize: 10, color: C.textDim, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Silenciar</div>
                      <ModeBtn label="🔇 Silenciar 1h"   onClick={() => silenceMember(m.id, 1)} />
                      <ModeBtn label="🔇 Silenciar 6h"   onClick={() => silenceMember(m.id, 6)} />
                      <ModeBtn label="🔇 Silenciar 24h"  onClick={() => silenceMember(m.id, 24)} />
                      <ModeBtn label="🔊 Quitar silencio" onClick={() => unsilenceMember(m.id)} />
                      <div style={{ height: 1, background: C.border }} />
                      <ModeBtn label="🚫 Expulsar" danger onClick={() => kickMember(m.id)} />
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ════ TAB: PERMISOS ════ */}
        {tab === 'perms' && (
          <>
            {!isAdmin && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>
                🔐 Solo los admins pueden cambiar los permisos.
              </div>
            )}
            {isAdmin && (
              <>
                {/* Visibilidad */}
                <div style={{ padding: '16px 0 0' }}>
                  <SectionLabel label="Visibilidad y acceso" />
                  <PrivacyRow
                    icon={isPublic ? '🌐' : '🔒'}
                    label={isPublic ? 'Público' : 'Privado'}
                    desc={isPublic ? 'Aparece en Explorar. Cualquiera puede unirse.' : 'Solo por invitación directa.'}
                    value={isPublic}
                    onChange={togglePublic}
                  />
                  <PrivacyRow
                    icon="🔒"
                    label="Bloquear grupo"
                    desc="Nadie puede enviar mensajes, ni admins."
                    value={isLocked}
                    onChange={toggleLocked}
                  />
                  <PrivacyRow
                    icon="✅"
                    label="Aprobar nuevos miembros"
                    desc="Los nuevos miembros deben ser aprobados por un admin antes de entrar."
                    value={requireApproval}
                    onChange={v => setRequireApproval(v)}
                  />
                </div>

                {/* Privacidad avanzada */}
                <div style={{ padding: '16px 0 0', borderTop: `1px solid ${C.border}` }}>
                  <SectionLabel label="Privacidad avanzada" />
                  <PrivacyRow
                    icon="📤"
                    label="Permitir exportar chats"
                    desc="Si está desactivado, los miembros no pueden exportar el historial de mensajes."
                    value={allowExport}
                    onChange={v => setAllowExport(v)}
                  />
                  <PrivacyRow
                    icon="💾"
                    label="Permitir guardar archivos"
                    desc="Si está desactivado, los archivos no se guardan automáticamente en el dispositivo."
                    value={allowAutoSave}
                    onChange={v => setAllowAutoSave(v)}
                  />
                  <PrivacyRow
                    icon="📢"
                    label="Solo avisos (announcement only)"
                    desc="Solo admins y moderadores pueden enviar mensajes. Ideal para canales de comunicación oficial."
                    value={announcementOnly}
                    onChange={v => setAnnouncementOnly(v)}
                  />
                </div>

                {/* ¿Quién puede... */}
                <RadioGroup
                  label="¿Quién puede enviar mensajes?"
                  value={whoCanSend}
                  onChange={setWhoCanSend}
                  options={[
                    ['everyone',   'Todos los miembros',               null],
                    ['members',    'Miembros verificados',              'Excluye invitados recientes'],
                    ['moderators', 'Moderadores y Admins',             null],
                    ['admins',     'Solo Admins',                      null],
                  ]}
                />

                <RadioGroup
                  label="¿Quién puede agregar miembros?"
                  value={whoCanAdd}
                  onChange={setWhoCanAdd}
                  options={[
                    ['everyone', 'Todos los miembros', null],
                    ['admins',   'Solo Admins',         null],
                    ['owner',    'Solo el Dueño',       null],
                  ]}
                />

                <RadioGroup
                  label="¿Quién puede editar info del grupo?"
                  value={whoCanEdit}
                  onChange={setWhoCanEdit}
                  options={[
                    ['everyone', 'Todos los miembros',        null],
                    ['admins',   'Admins y Moderadores',      null],
                    ['owner',    'Solo el Dueño',             null],
                  ]}
                />

                {/* Modo lento */}
                <div style={{ padding: '16px 0 0', borderTop: `1px solid ${C.border}` }}>
                  <SectionLabel label="Modo lento (entre mensajes)" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 16px' }}>
                    {[[null,'Off'],[10,'10s'],[30,'30s'],[60,'1min'],[300,'5min'],[600,'10min']].map(([v, label]) => (
                      <button key={label} onClick={() => setSlowMode(v)} style={{
                        padding: '6px 14px', borderRadius: 20, border: `1px solid ${slowMode === v ? C.green : C.border}`,
                        background: slowMode === v ? `${C.green}18` : C.panel2,
                        color: slowMode === v ? C.green : C.textDim, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Auto-delete */}
                <div style={{ padding: '16px 0 0', borderTop: `1px solid ${C.border}` }}>
                  <SectionLabel label="Mensajes temporales (auto-borrado)" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 16px' }}>
                    {[[null,'Off'],[0.083,'5min'],[1,'1h'],[12,'12h'],[24,'24h'],[168,'7d']].map(([v, label]) => (
                      <button key={label} onClick={() => setAutoDelete(v)} style={{
                        padding: '6px 14px', borderRadius: 20, border: `1px solid ${autoDelete === v ? C.green : C.border}`,
                        background: autoDelete === v ? `${C.green}18` : C.panel2,
                        color: autoDelete === v ? C.green : C.textDim, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>{label}</button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '12px 16px 20px', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={savePerms} disabled={savingPerms} style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: C.green, color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    opacity: savingPerms ? 0.6 : 1,
                  }}>{savingPerms ? 'Guardando...' : '💾 Guardar configuración'}</button>
                </div>
              </>
            )}
          </>
        )}

        {/* ════ TAB: SOLICITUDES ════ */}
        {tab === 'requests' && isAdmin && (
          <>
            <div style={{ padding: '16px 16px 8px' }}>
              <SectionLabel label="Solicitudes pendientes de ingreso" />
              {loadingRequests ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                </div>
              ) : joinRequests.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                  <p style={{ margin: 0, fontSize: 14, color: C.text2 }}>No hay solicitudes pendientes</p>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: C.textDim }}>Cuando alguien solicite unirse aparecerá aquí</p>
                </div>
              ) : joinRequests.map(req => {
                const u = req.users || {}
                const processing = processingReq === req.id
                return (
                  <div key={req.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 0', borderBottom: `1px solid ${C.border}11`,
                  }}>
                    <Avatar name={u.display_name} size={46} color={avatarColor(u.id)} url={u.avatar_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{u.display_name || 'Usuario'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>
                        @{u.username} · {new Date(req.requested_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => approveRequest(req.id)}
                        disabled={processing}
                        style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: C.green, color: C.bg, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: processing ? 0.6 : 1 }}
                      >{processing ? '...' : '✓ Aceptar'}</button>
                      <button
                        onClick={() => rejectRequest(req.id)}
                        disabled={processing}
                        style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel2, color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: processing ? 0.6 : 1 }}
                      >{processing ? '...' : '✗ Rechazar'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ════ TAB: ESTADÍSTICAS ════ */}
        {tab === 'stats' && isCommunity && isAdmin && (
          <>
            {statsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              </div>
            ) : !stats ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <p style={{ margin: 0, color: C.text2 }}>No hay estadísticas disponibles aún.</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: C.textDim }}>Requiere ejecutar migración 035.</p>
              </div>
            ) : (
              <div style={{ padding: '16px' }}>
                {/* Tarjetas de stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Miembros totales', value: stats.total_members, icon: '👥', color: C.green },
                    { label: 'Nuevos (7 días)',  value: stats.new_members_7d,  icon: '📈', color: '#3b82f6' },
                    { label: 'Nuevos (30 días)', value: stats.new_members_30d, icon: '📅', color: '#8b5cf6' },
                    { label: 'Mensajes (7 días)',value: stats.messages_7d,     icon: '💬', color: '#f59e0b' },
                    { label: 'Torneos',          value: stats.total_tournaments,icon: '🏆',color: '#ef4444' },
                    { label: 'Eventos',          value: stats.total_events,    icon: '📅', color: '#06b6d4' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
                      padding: '14px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <span style={{ fontSize: 24 }}>{s.icon}</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value ?? 0}</span>
                      <span style={{ fontSize: 11, color: C.textDim, lineHeight: 1.3 }}>{s.label}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Mensajes totales
                  </p>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: C.text }}>
                    {(stats.total_messages ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════ TAB: ROLES PERSONALIZADOS ════ */}
        {tab === 'roles' && isCommunity && isAdmin && (
          <>
            {/* Header con botón crear */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 14 }}>Roles de la comunidad</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>
                  Roles personalizados para organizar a tus miembros.
                </p>
              </div>
              <button onClick={() => showRoleForm ? closeRoleForm() : openRoleForm()} style={{
                background: C.green, border: 'none', borderRadius: 10, padding: '8px 14px',
                color: C.bg, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 2px 8px ${C.green}33`,
              }}>
                {showRoleForm ? 'Cancelar' : '+ Nuevo rol'}
              </button>
            </div>

            {/* Formulario crear/editar rol */}
            {showRoleForm && (
              <div style={{ padding: '16px', background: `${C.green}08`, borderBottom: `1px solid ${C.border}` }}>
                {/* Nombre + emoji + color */}
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {editingRole ? `Editando: ${editingRole.name}` : 'Nuevo rol'}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <input
                    placeholder="Nombre del rol"
                    value={roleForm.name}
                    onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
                    maxLength={30}
                    style={{
                      flex: 1, minWidth: 120, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
                      color: C.text, fontSize: 13, padding: '8px 12px', outline: 'none',
                    }}
                  />
                  <input
                    placeholder="🏆"
                    value={roleForm.icon}
                    onChange={e => setRoleForm(f => ({ ...f, icon: e.target.value }))}
                    maxLength={4}
                    style={{
                      width: 52, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
                      color: C.text, fontSize: 18, padding: '6px 8px', outline: 'none', textAlign: 'center',
                    }}
                  />
                  <input
                    type="color" value={roleForm.color}
                    onChange={e => setRoleForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width: 42, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none', padding: 0 }}
                  />
                </div>

                {/* Preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>Vista previa:</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px',
                    color: roleForm.color, background: `${roleForm.color}18`,
                    border: `1px solid ${roleForm.color}44`,
                  }}>
                    {roleForm.icon} {roleForm.name || 'Nombre del rol'}
                  </span>
                </div>

                {/* Permisos */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: C.text }}>🔐 Permisos del rol</p>
                  {PERM_GROUPS.map(group => (
                    <div key={group.label} style={{ marginBottom: 14 }}>
                      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {group.label}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {group.items.map(({ key, label, desc }) => (
                          <label key={key} style={{
                            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                            background: roleForm[key] ? `${roleForm.color}12` : C.panel2,
                            border: `1px solid ${roleForm[key] ? roleForm.color + '44' : C.border}`,
                            borderRadius: 8, padding: '8px 10px', transition: 'all .15s',
                          }}>
                            <input
                              type="checkbox"
                              checked={!!roleForm[key]}
                              onChange={e => setRoleForm(f => ({ ...f, [key]: e.target.checked }))}
                              style={{ width: 16, height: 16, accentColor: roleForm.color, flexShrink: 0, cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: roleForm[key] ? 700 : 500, color: roleForm[key] ? C.text : C.textDim }}>{label}</div>
                              <div style={{ fontSize: 10, color: C.textDim, marginTop: 1, lineHeight: 1.3 }}>{desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={saveCustomRole}
                  disabled={savingRole || !roleForm.name.trim()}
                  style={{
                    marginTop: 4, background: savingRole || !roleForm.name.trim() ? C.panel2 : C.green,
                    border: 'none', borderRadius: 8, padding: '10px 24px',
                    color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%',
                  }}
                >
                  {savingRole ? 'Guardando...' : editingRole ? '✓ Actualizar rol' : '✓ Guardar rol'}
                </button>
              </div>
            )}

            {/* Lista de roles */}
            {rolesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              </div>
            ) : customRoles.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎭</div>
                <p style={{ margin: 0, color: C.text2, fontWeight: 600 }}>Sin roles personalizados</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textDim }}>
                  Creá roles para organizar mejor a los miembros de la comunidad.
                </p>
              </div>
            ) : (
              customRoles.map(role => {
                const activePerms = PERM_GROUPS.flatMap(g => g.items).filter(({ key }) => role[key])
                return (
                  <div key={role.id} style={{
                    padding: '12px 16px', borderBottom: `1px solid ${C.border}11`,
                  }}>
                    {/* Row: badge + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: activePerms.length ? 8 : 0 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '3px 10px',
                        color: role.color, background: `${role.color}18`,
                        border: `1px solid ${role.color}44`, flexShrink: 0, whiteSpace: 'nowrap',
                      }}>
                        {role.icon} {role.name}
                      </span>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => openRoleForm(role)}
                        style={{
                          background: `${role.color}18`, border: `1px solid ${role.color}44`,
                          borderRadius: 6, padding: '5px 10px', color: role.color,
                          fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                        }}
                      >✏️ Editar</button>
                      <button
                        onClick={() => deleteCustomRole(role.id)}
                        disabled={deletingRole === role.id}
                        style={{
                          background: '#ef444412', border: 'none', borderRadius: 6, padding: '5px 9px',
                          color: '#ef4444', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                          opacity: deletingRole === role.id ? 0.5 : 1,
                        }}
                      >
                        {deletingRole === role.id ? '...' : '🗑'}
                      </button>
                    </div>
                    {/* Permisos activos */}
                    {activePerms.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {activePerms.map(({ key, label }) => (
                          <span key={key} style={{
                            fontSize: 10, color: role.color, background: `${role.color}12`,
                            border: `1px solid ${role.color}30`, borderRadius: 4, padding: '1px 7px',
                          }}>{label}</span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: C.textDim }}>Sin permisos especiales — solo puede leer</span>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {/* ════ TAB: TORNEOS ════ */}
        {tab === 'torneos' && (() => {
          const GAMES = [
            { id: 'efootball',   icon: '⚽', label: 'eFootball' },
            { id: 'fc26',        icon: '⚽', label: 'FC 26' },
            { id: 'fc27',        icon: '⚽', label: 'FC 27' },
          ]
          function toggleGame(id) {
            setCommunityGames(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
          }
          return (
            <div style={{ padding: '0 0 40px' }}>
              {/* Header info */}
              <div style={{ padding: '16px', background: `${C.green}08`, borderBottom: `1px solid ${C.border}` }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>🏆 Torneos & Ligas</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textDim, lineHeight: 1.4 }}>
                  Configurá qué tipo de competencias se pueden organizar dentro de esta comunidad.
                </p>
              </div>

              {/* Enable / disable sections */}
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <p style={{ margin: '16px 16px 8px', fontSize: 10, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  Tipos de competencia
                </p>
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['torneosEnabled', torneosEnabled, setTorneosEnabled, '🏆', 'Torneos', 'Eliminación directa, grupos, bracket'],
                    ['ligasEnabled',   ligasEnabled,   setLigasEnabled,   '🥇', 'Ligas',   'Todos vs todos, tabla de posiciones'],
                    ['clanesEnabled',  clanesEnabled,  setClanesEnabled,  '⚔️', 'Torneos de Clanes', 'Equipos o clanes compiten entre sí'],
                  ].map(([key, val, setter, icon, lbl, desc]) => (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: val ? `${C.green}08` : C.panel2,
                      border: `1px solid ${val ? C.green + '44' : C.border}`,
                      borderRadius: 12, padding: '12px 14px',
                    }}>
                      <span style={{ fontSize: 22 }}>{icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{lbl}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>{desc}</p>
                      </div>
                      {isAdmin && <Toggle value={val} onChange={setter} />}
                      {!isAdmin && (
                        <span style={{ fontSize: 11, color: val ? C.green : C.textDim, fontWeight: 700 }}>{val ? 'ON' : 'OFF'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Games */}
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <p style={{ margin: '16px 16px 8px', fontSize: 10, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  Juegos de la comunidad
                </p>
                <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {GAMES.map(g => {
                    const selected = communityGames.includes(g.id)
                    return (
                      <button key={g.id} onClick={() => isAdmin && toggleGame(g.id)} style={{
                        padding: '7px 14px', borderRadius: 20, border: 'none',
                        cursor: isAdmin ? 'pointer' : 'default', fontSize: 13,
                        background: selected ? C.green : C.panel2,
                        color: selected ? C.bg : C.text2,
                        fontWeight: selected ? 700 : 400,
                        opacity: !isAdmin && !selected ? 0.5 : 1,
                      }}>
                        {g.icon} {g.label}
                      </button>
                    )
                  })}
                </div>
                {communityGames.length > 0 && (
                  <p style={{ margin: '0 16px 12px', fontSize: 11, color: C.textDim }}>
                    {communityGames.length} juego{communityGames.length !== 1 ? 's' : ''} seleccionado{communityGames.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Reglamento de sala editable por juego */}
              {(() => {
                const soccerGames = [
                  communityGames.includes('efootball') && { id: 'efootball', label: 'eFootball', icon: '⚽' },
                  (communityGames.includes('fc26') || communityGames.includes('fc27')) && { id: 'fc', label: 'FC 26/27', icon: '⚽' },
                ].filter(Boolean)
                if (!soccerGames.length) return null

                // Which rules tab is valid
                const validTab = soccerGames.find(g => g.id === rulesTab) ? rulesTab : soccerGames[0].id

                const EFOOTBALL_RULES = [
                  { key: 'sin_handicap',       icon: '⚖️', label: 'Sin handicap / igualador de equipo' },
                  { key: 'sin_cartas_op',       icon: '🚫', label: 'Sin cartas OP/TOTY/Evolutions' },
                  { key: 'envio_mazo',          icon: '📋', label: 'Mazo/equipo enviado antes del partido' },
                  { key: 'tacticas_libres',     icon: '🎯', label: 'Tácticas libres' },
                  { key: 'restriccion_division',icon: '🏅', label: 'Restricción de división mínima' },
                  { key: 'sin_manager_legend',  icon: '👤', label: 'Sin Manager/Leyenda' },
                  { key: 'penales_5',           icon: '🥅', label: 'Penales máx. 5 en empate' },
                ]
                const FC_RULES = [
                  { key: 'sin_handicap',        icon: '⚖️', label: 'Sin handicap / asistencia de puntería' },
                  { key: 'sin_cartas_op',        icon: '🚫', label: 'Sin cartas TOTY/TOTS/Héroe' },
                  { key: 'envio_equipo',         icon: '📋', label: 'Equipo enviado antes del partido' },
                  { key: 'sin_icon',             icon: '⭐', label: 'Sin íconos/leyendas' },
                  { key: 'restriccion_overall',  icon: '🏅', label: 'Restricción de overall máximo' },
                  { key: 'tacticas_libres',      icon: '🎯', label: 'Tácticas libres' },
                  { key: 'prohibido_press',      icon: '🛡️', label: 'Prohibido pressing constante' },
                ]

                const rules = validTab === 'efootball' ? EFOOTBALL_RULES : FC_RULES

                return (
                  <div style={{ borderBottom: `1px solid ${C.border}` }}>
                    <p style={{ margin: '16px 16px 8px', fontSize: 10, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                      Reglamento de sala
                    </p>

                    {/* Game tabs */}
                    {soccerGames.length > 1 && (
                      <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px' }}>
                        {soccerGames.map(g => (
                          <button key={g.id} onClick={() => setRulesTab(g.id)} style={{
                            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            background: validTab === g.id ? C.green : C.panel2,
                            color: validTab === g.id ? C.bg : C.text2,
                          }}>{g.icon} {g.label}</button>
                        ))}
                      </div>
                    )}

                    {/* Toggleable rules */}
                    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {rules.map(r => {
                        const on = getRule(validTab, r.key, false)
                        return (
                          <div key={r.key} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 10,
                            background: on ? `${C.green}10` : C.panel2,
                            border: `1px solid ${on ? C.green + '44' : C.border + '44'}`,
                            cursor: isAdmin ? 'pointer' : 'default',
                            transition: 'background .15s',
                          }}
                          onClick={() => isAdmin && setRule(validTab, r.key, !on)}
                          >
                            <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{r.icon}</span>
                            <span style={{ flex: 1, fontSize: 13, color: on ? C.text : C.text2 }}>{r.label}</span>
                            {isAdmin
                              ? <Toggle value={on} onChange={v => setRule(validTab, r.key, v)} />
                              : <span style={{ fontSize: 11, fontWeight: 700, color: on ? C.green : C.textDim }}>{on ? 'ON' : '—'}</span>
                            }
                          </div>
                        )
                      })}
                    </div>

                    {/* División mínima (texto) — solo si está activada */}
                    {validTab === 'efootball' && getRule('efootball', 'restriccion_division', false) && (
                      <div style={{ padding: '8px 16px' }}>
                        <input
                          value={getRule('efootball', 'division_minima_texto', '')}
                          onChange={e => setRule('efootball', 'division_minima_texto', e.target.value)}
                          placeholder="Ej: División 1 o superior"
                          disabled={!isAdmin}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
                            color: C.text, fontSize: 13, padding: '8px 12px', outline: 'none',
                            opacity: isAdmin ? 1 : 0.6,
                          }}
                        />
                      </div>
                    )}
                    {validTab === 'fc' && getRule('fc', 'restriccion_overall', false) && (
                      <div style={{ padding: '8px 16px' }}>
                        <input
                          value={getRule('fc', 'overall_max_texto', '')}
                          onChange={e => setRule('fc', 'overall_max_texto', e.target.value)}
                          placeholder="Ej: Overall máximo 85"
                          disabled={!isAdmin}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
                            color: C.text, fontSize: 13, padding: '8px 12px', outline: 'none',
                            opacity: isAdmin ? 1 : 0.6,
                          }}
                        />
                      </div>
                    )}

                    {/* Reglas adicionales / texto libre */}
                    <div style={{ padding: '8px 16px 16px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim, fontWeight: 600 }}>Reglas adicionales (texto libre)</p>
                      <textarea
                        value={getRule(validTab, 'custom', '')}
                        onChange={e => setRule(validTab, 'custom', e.target.value)}
                        placeholder={isAdmin ? 'Escribí reglas específicas de tu comunidad...' : 'Sin reglas adicionales'}
                        disabled={!isAdmin}
                        rows={3}
                        style={{
                          width: '100%', boxSizing: 'border-box', resize: 'vertical',
                          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
                          color: C.text, fontSize: 13, padding: '8px 12px', outline: 'none', fontFamily: 'inherit',
                          opacity: isAdmin ? 1 : 0.6,
                        }}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Save button — only for admins */}
              {isAdmin && (
                <div style={{ padding: '16px' }}>
                  <button onClick={saveTorneosConfig} disabled={savingTorneos} style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: savingTorneos ? C.panel2 : C.green,
                    color: savingTorneos ? C.textDim : C.bg,
                    fontWeight: 700, fontSize: 14, cursor: savingTorneos ? 'default' : 'pointer',
                  }}>
                    {savingTorneos ? 'Guardando…' : '💾 Guardar configuración'}
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* ════ TAB: MEDIOS ════ */}
        {tab === 'media' && (
          <>
            <p style={{ margin: '12px 16px 8px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              Imágenes compartidas
            </p>
            {mediaLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              </div>
            ) : media.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textDim }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🖼</div>
                <p style={{ margin: 0, fontSize: 14, color: C.text2 }}>Sin imágenes compartidas aún</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: '0 0 16px' }}>
                {media.map(msg => (
                  <div key={msg.id} style={{ aspectRatio: '1', overflow: 'hidden', background: C.panel2 }}>
                    <img src={msg.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Close member menu on outside click */}
      {memberMenu && (
        <div
          onClick={() => setMemberMenu(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 49 }}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ModeBtn({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '10px 14px',
      background: 'none', border: 'none',
      color: danger ? '#ef4444' : C.text, fontSize: 13, cursor: 'pointer',
      transition: 'background .1s', display: 'block',
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? '#ef444418' : C.panel2}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >{label}</button>
  )
}
