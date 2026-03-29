import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env (project root).',
  );
}

const supabaseIpv4Agent = new Agent({ connect: { family: 4 } });

function supabaseFetch(input, init) {
  const opts = init && typeof init === 'object' ? { ...init } : {};
  opts.dispatcher = supabaseIpv4Agent;
  return undiciFetch(input, opts);
}

/**
 * Local macOS/DNS issues sometimes need IPv4-only undici (below). Vercel/Lambda networking
 * often hangs with that agent → 60s runtime timeout. Use default fetch on Vercel.
 */
const useNodeBuiltinFetch =
  process.env.SUPABASE_USE_NODE_FETCH === '1' || process.env.VERCEL === '1';

let supabaseClient = null;

export function assertSupabaseConfigured() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env at the project root.',
    );
  }
}

export function getSupabaseUrl() {
  return supabaseUrl || '';
}

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseKey);
}

export function getClient() {
  assertSupabaseConfigured();
  if (!supabaseClient) {
    const options = useNodeBuiltinFetch ? {} : { global: { fetch: supabaseFetch } };
    supabaseClient = createClient(supabaseUrl, supabaseKey, options);
    if (process.env.SUPABASE_USE_NODE_FETCH === '1') {
      console.warn('[supabase] Using Node built-in fetch (SUPABASE_USE_NODE_FETCH=1).');
    } else if (process.env.VERCEL === '1') {
      console.info('[supabase] Using default fetch on Vercel (avoid IPv4-only undici agent).');
    }
  }
  return supabaseClient;
}
