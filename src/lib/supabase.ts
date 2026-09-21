import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';

/** Lazily creates (and recreates, if the URL/key change) the Supabase client. */
export function getSupabaseClient(url: string, anonKey: string): SupabaseClient {
  const cacheKey = `${url}|${anonKey}`;
  if (cachedClient && cachedKey === cacheKey) return cachedClient;
  cachedClient = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  cachedKey = cacheKey;
  return cachedClient;
}
