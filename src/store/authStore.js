import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { applyTheme } from '../lib/theme'
import { loadSoundSettingsFromProfile } from '../lib/sounds'

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  loading: true,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (data?.theme) applyTheme(data.theme)
    loadSoundSettingsFromProfile(data)
    set({ profile: data })
  },

  updateProfile: async (userId, updates) => {
    const ALLOWED = ['display_name','avatar_url','bio','theme','sound_settings','platform','birthdate','username','status_emoji','status_text','notification_settings','privacy_settings']
    const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => ALLOWED.includes(k)))
    const { error } = await supabase.from('users').update(safe).eq('id', userId)
    if (error) return error.message
    set(state => ({ profile: { ...state.profile, ...updates } }))
    return null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },
}))
