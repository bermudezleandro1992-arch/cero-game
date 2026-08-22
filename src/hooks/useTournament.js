/**
 * useTournament(tournamentId) — datos completos de un torneo desde Supabase.
 * Devuelve: tournament, groups, matches, participants, standings, loading, error, refresh
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function buildStandings(matches, participants) {
  const stats = {}
  participants.forEach(p => {
    stats[p.user_id] = { profile: p.profile, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0 }
  })
  matches.filter(m => m.status === 'finalizado').forEach(m => {
    const s1 = m.score_player1 ?? 0
    const s2 = m.score_player2 ?? 0
    if (m.player1_id && stats[m.player1_id]) {
      stats[m.player1_id].pj++; stats[m.player1_id].gf += s1; stats[m.player1_id].gc += s2
      if (s1 > s2) stats[m.player1_id].pg++
      else if (s1 === s2) stats[m.player1_id].pe++
      else stats[m.player1_id].pp++
    }
    if (m.player2_id && stats[m.player2_id]) {
      stats[m.player2_id].pj++; stats[m.player2_id].gf += s2; stats[m.player2_id].gc += s1
      if (s2 > s1) stats[m.player2_id].pg++
      else if (s2 === s1) stats[m.player2_id].pe++
      else stats[m.player2_id].pp++
    }
  })
  return Object.entries(stats).map(([uid, s]) => ({
    user_id: uid, profile: s.profile,
    pj: s.pj, pg: s.pg, pe: s.pe, pp: s.pp,
    gf: s.gf, gc: s.gc, dif: s.gf - s.gc,
    pts: s.pg * 3 + s.pe,
  })).sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf)
}

export function useTournament(tournamentId) {
  const [tournament,    setTournament]    = useState(null)
  const [groups,        setGroups]        = useState([])
  const [matches,       setMatches]       = useState([])
  const [participants,  setParticipants]  = useState([])
  const [standings,     setStandings]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)

  const load = useCallback(async () => {
    if (!tournamentId) return
    setLoading(true); setError(null)
    try {
      // 1. Torneo base
      const { data: t, error: tErr } = await supabase
        .from('conversations')
        .select('id, name, tournament_status, tournament_format, tournament_mode, group_type, game, max_participants, liga_tipo, liga_fase, temporada, division, description, banner_url, is_public, created_by, created_at, community_id')
        .eq('id', tournamentId).single()
      if (tErr) throw tErr

      // 2. Grupos
      const { data: groupRows } = await supabase
        .from('tournament_groups')
        .select('id, name, color, position, classifies')
        .eq('tournament_id', tournamentId)
        .order('position')

      // 3. Participantes + perfiles
      const { data: memberRows } = await supabase
        .from('conversation_members')
        .select('user_id, role, joined_at')
        .eq('conversation_id', tournamentId)

      const userIds = (memberRows || []).map(m => m.user_id)
      let profileMap = {}
      if (userIds.length) {
        const { data: profileRows } = await supabase
          .from('users').select('id, display_name, username, avatar_url').in('id', userIds)
        profileMap = Object.fromEntries((profileRows || []).map(p => [p.id, p]))
      }
      const enrichedMembers = (memberRows || []).map(m => ({ ...m, profile: profileMap[m.user_id] || null }))

      // 4. Partidos
      const { data: matchRows } = await supabase
        .from('tournament_matches')
        .select('id, round_number, round_label, phase, status, score_player1, score_player2, winner_id, screenshot_url, player1_id, player2_id, group_id, created_at')
        .eq('tournament_id', tournamentId)
        .order('round_number').order('created_at')

      const enrichedMatches = (matchRows || []).map(m => ({
        ...m,
        player1: profileMap[m.player1_id] || null,
        player2: profileMap[m.player2_id] || null,
      }))

      // 5. Tabla de posiciones (solo si es liga o hay partidos finalizados)
      const table = buildStandings(enrichedMatches, enrichedMembers)

      setTournament({ ...t, status: t.tournament_status })
      setGroups(groupRows || [])
      setParticipants(enrichedMembers)
      setMatches(enrichedMatches)
      setStandings(table)
    } catch (e) {
      setError(e?.message || 'Error al cargar torneo')
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => { load() }, [load])

  // Suscripción a cambios en partidos en tiempo real
  useEffect(() => {
    if (!tournamentId) return
    const ch = supabase.channel(`tournament-matches-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${tournamentId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [tournamentId, load])

  return { tournament, groups, matches, participants, standings, loading, error, refresh: load }
}
