import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * Supabase client singleton.
 *
 * Lazily constructed so the app boots even when VITE_SUPABASE_URL/
 * VITE_SUPABASE_ANON_KEY aren't set yet — useful during the early dev loop
 * where the dev cookie still gates the API. Components must handle a `null`
 * return (typically: render a "Supabase not configured" notice or fall back
 * to the dev cookie path).
 */
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!url || !anonKey) return null;
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'vitality.auth',
    },
  });
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
