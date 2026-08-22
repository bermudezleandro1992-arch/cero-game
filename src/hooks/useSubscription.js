import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const LIMITS = {
  free: { comunidades: 1, miembros: 50,  torneos_dia: 1, torneos_activos: 1, jugadores: 8   },
  vip:  { comunidades: 3, miembros: 200, torneos_dia: 99, torneos_activos: 3, jugadores: 16  },
  pro:  { comunidades: 99,miembros: 9999,torneos_dia: 999,torneos_activos: 99,jugadores: 9999},
}

export function useSubscription(userId) {
  const [plan,           setPlan]           = useState('free')
  const [loading,        setLoading]        = useState(true)
  const [torneos_hoy,    setTorneosHoy]     = useState(0)
  const [torneos_activos,setTorneosActivos] = useState(0)

  const loadUsage = useCallback(async (uid) => {
    if (!uid) return
    const today = new Date(); today.setHours(0,0,0,0)
    const [{ count: hoy }, { count: activos }] = await Promise.all([
      supabase.from('conversations')
        .select('id', { count: 'exact', head: true })
        .in('group_type', ['tournament', 'liga'])
        .eq('created_by', uid)
        .gte('created_at', today.toISOString()),
      supabase.from('conversations')
        .select('id', { count: 'exact', head: true })
        .in('group_type', ['tournament', 'liga'])
        .eq('created_by', uid)
        .in('tournament_status', ['inscripcion', 'draw', 'en_curso']),
    ])
    setTorneosHoy(hoy || 0)
    setTorneosActivos(activos || 0)
  }, [])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    Promise.all([
      supabase.rpc('get_user_plan', { p_user_id: userId }).then(({ data }) => { if (data) setPlan(data) }),
      loadUsage(userId),
    ]).finally(() => setLoading(false))
  }, [userId, loadUsage])

  const refresh = useCallback(() => loadUsage(userId), [userId, loadUsage])

  const hasFeature = useCallback(async (feature) => {
    if (!userId) return false
    const { data } = await supabase.rpc('has_premium_feature', { p_user_id: userId, p_feature: feature })
    return !!data
  }, [userId])

  const isPro  = plan === 'pro'
  const isVip  = plan === 'vip' || plan === 'pro'
  const isFree = plan === 'free'
  const limits = LIMITS[plan] || LIMITS.free

  function canCreateTournament(participants) {
    if (torneos_hoy >= limits.torneos_dia)
      return { allowed: false, reason: `Límite de ${limits.torneos_dia} torneo${limits.torneos_dia > 1 ? 's' : ''}/día alcanzado` }
    if (torneos_activos >= limits.torneos_activos)
      return { allowed: false, reason: `Tenés ${torneos_activos} torneo${torneos_activos > 1 ? 's' : ''} activo${torneos_activos > 1 ? 's' : ''} (máx. ${limits.torneos_activos})` }
    if (participants > limits.jugadores)
      return { allowed: false, reason: `Tu plan permite hasta ${limits.jugadores} jugadores por torneo` }
    return { allowed: true, reason: null }
  }

  return {
    plan, loading, isPro, isVip, isFree, limits,
    torneos_hoy, torneos_activos,
    canCreateTournament, refresh, hasFeature,
  }
}
