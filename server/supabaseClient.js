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

const useNodeBuiltinFetch = process.env.SUPABASE_USE_NODE_FETCH === '1';

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
    if (useNodeBuiltinFetch) {
      console.warn('[supabase] Using Node built-in fetch (SUPABASE_USE_NODE_FETCH=1).');
    }
  }
  return supabaseClient;
}
