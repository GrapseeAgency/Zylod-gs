import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Supabase configuration — set these env vars when connecting to a real Supabase project
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Check if Supabase is configured
export const isSupabaseConfigured = supabaseUrl !== '' && supabaseAnonKey !== ''

// Create a no-op Supabase client that won't throw on empty URLs
function createSafeClient(url: string, key: string): SupabaseClient {
  if (!url || !key) {
    // Return a dummy client that won't crash — operations will silently fail
    // Using a placeholder URL/key that Supabase accepts but won't connect to real data
    return createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return createClient(url, key)
}

// Client-side Supabase instance (uses anon key, limited by RLS)
export const supabase = createSafeClient(supabaseUrl, supabaseAnonKey)

// Server-side Supabase instance (uses service role key, bypasses RLS — NEVER expose to client)
export const supabaseAdmin = createSafeClient(supabaseUrl, supabaseServiceRoleKey)
