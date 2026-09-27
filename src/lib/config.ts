// Built-in Community backend, so testers don't have to type anything into
// Settings. The anon key is meant to be public (it ships inside every
// Supabase app); the database's row level security protects the data.
export const BUILT_IN_SUPABASE_URL = 'https://swchqmwrhwcpgznjkhjv.supabase.co';
export const BUILT_IN_SUPABASE_ANON_KEY = 'sb_publishable_VvfazVSLyU1UxSiuO_o8_Q_1OvFxpQP';

/**
 * Stands in for a personal Claude API key when none has been entered: AI
 * requests then go through the `ai-proxy` Supabase Edge Function, which holds
 * the real key server-side so it's never inside the app.
 */
export const AI_PROXY_KEY = 'calorvault-ai-proxy';

export function hasBuiltInBackend(): boolean {
  return !!BUILT_IN_SUPABASE_URL && !!BUILT_IN_SUPABASE_ANON_KEY;
}
