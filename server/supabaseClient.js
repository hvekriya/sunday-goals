import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env (project root).',
  );
}

const supabaseIpv4Agent = new Agent({ connect: { family: 4 } });

function supabaseFetch(input, init) {
  const opts = init && typeof init === 'object' ? { ...init } : {};
  opts.dispatcher = supabaseIpv4Agent;
  return undiciFetch(input, opts);
}

const useNodeBuiltinFetch =
  process.env.SUPABASE_USE_NODE_FETCH === '1' || process.env.VERCEL === '1';

function clientOptions() {
  return useNodeBuiltinFetch ? {} : { global: { fetch: supabaseFetch } };
}

let anonClient = null;

export function assertSupabaseConfigured() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY in .env at the project root.',
    );
  }
}

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Public reads (RLS: anon policies where applicable). */
export function getAnonClient() {
  assertSupabaseConfigured();
  if (!anonClient) {
    anonClient = createClient(supabaseUrl, supabaseAnonKey, clientOptions());
    if (process.env.SUPABASE_USE_NODE_FETCH === '1') {
      console.warn('[supabase] Using Node built-in fetch (SUPABASE_USE_NODE_FETCH=1).');
    }
  }
  return anonClient;
}

/**
 * User-scoped client: PostgREST runs as that user; RLS + is_app_admin() apply.
 * @param {string} accessToken — Supabase Auth access_token (JWT)
 */
export function createUserClient(accessToken) {
  assertSupabaseConfigured();
  const base = clientOptions();
  return createClient(supabaseUrl, supabaseAnonKey, {
    ...base,
    global: {
      ...(base.global || {}),
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/** @deprecated use getAnonClient */
export function getClient() {
  return getAnonClient();
}
