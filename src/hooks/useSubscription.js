import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSubscription(userId) {
  const [plan, setPlan]       = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    supabase.rpc('get_user_plan', { p_user_id: userId })
      .then(({ data }) => { if (data) setPlan(data) })
      .finally(() => setLoading(false))
  }, [userId])

  const hasFeature = useCallback(async (feature) => {
    if (!userId) return false
    const { data } = await supabase.rpc('has_premium_feature', { p_user_id: userId, p_feature: feature })
    return !!data
  }, [userId])

  const isPro  = plan === 'pro'
  const isVip  = plan === 'vip' || plan === 'pro'
  const isFree = plan === 'free'

  const LIMITS = {
    free: { comunidades: 1, miembros: 50,  torneos: 1,   jugadores: 8   },
    vip:  { comunidades: 3, miembros: 200, torneos: 3,   jugadores: 16  },
    pro:  { comunidades: 99,miembros: 9999,torneos: 99,  jugadores: 9999},
  }
  const limits = LIMITS[plan] || LIMITS.free

  return { plan, loading, isPro, isVip, isFree, limits, hasFeature }
}
