import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when the Supabase env vars aren't set — the app still boots (landing + auth UI render)
 * and every network call site is guarded by this flag instead of crashing at import time. */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Shown wherever the user would otherwise hit a dead network call on an unconfigured deploy. */
export const SUPABASE_CONFIG_MESSAGE =
  "Raj's isn't connected to a database yet — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment, then redeploy."

// `null` is smuggled through the type so the rest of the app doesn't need null-checks on every
// call; every runtime use of `supabase` is behind `supabaseConfigured`, so it's never reached
// when unconfigured. The alternative — a module-load `throw` — white-screens the whole app on
// any deploy that forgets its env vars, which is the worst possible failure mode.
export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : (null as unknown as SupabaseClient)

export const vaultBucket = import.meta.env.VITE_SUPABASE_BUCKET || 'vault'
