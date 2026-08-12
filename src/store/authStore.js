import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
    set({ profile: data })
  },

  updateProfile: async (userId, updates) => {
    const { error } = await supabase.from('users').update(updates).eq('id', userId)
    if (error) return error.message
    set(state => ({ profile: { ...state.profile, ...updates } }))
    return null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },
}))
