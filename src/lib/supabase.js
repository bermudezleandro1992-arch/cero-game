import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gxberqtxbnrnudawwyzd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_1mTv3rNHRXRghw07oBxYhQ_65oG5uNB'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
