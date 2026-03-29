import { nanoid } from 'nanoid';
import { getClient, assertSupabaseConfigured, hasSupabaseConfig } from './supabaseClient.js';
import { getRosterPlayerBySlugOrId } from './playersRepo.js';

let lastUnreachableLogAt = 0;

function isSupabaseUnreachable(err) {
  const msg = err?.message || String(err);
  return /fetch failed|network|ECONNREFUSED|ENOTFOUND|certificate|ETIMEDOUT/i.test(msg);
}

function supabaseNetworkHint(err) {
  if (!isSupabaseUnreachable(err)) return '';
  return ' Node could not reach Supabase. Confirm SUPABASE_URL in .env, VPN off, project not paused.';
}

function formatErrorChain(err) {
  if (!err) return '(no error object)';
  const lines = [];
  let e = err;
  for (let i = 0; e && i < 8; i += 1) {
    const msg = e.message || String(e);
    const meta = [e.code && `code=${e.code}`, e.errno != null && `errno=${e.errno}`, e.syscall && `syscall=${e.syscall}`]
      .filter(Boolean)
      .join(' ');
    lines.push(i === 0 ? `${msg}${meta ? ` (${meta})` : ''}` : `  caused by: ${msg}${meta ? ` (${meta})` : ''}`);
    e = e.cause;
  }
  return lines.join('\n');
}

function logUnreachableOnce(label, err) {
  const now = Date.now();
  if (now - lastUnreachableLogAt < 15000) return;
  lastUnreachableLogAt = now;
  console.error(`[sessions] Supabase unreachable (${label}):\n${formatErrorChain(err)}`);
  console.error('[sessions] Run: npm run check:supabase');
}

export async function saveSession(teams, playerPool = []) {
  assertSupabaseConfigured();
  const today = new Date().toISOString().slice(0, 10);
  const db = getClient();

  const { data: existing, error: existingErr } = await db
    .from('team_sessions')
    .select('slug')
    .eq('date', today)
    .maybeSingle();
  if (existingErr) {
    throw new Error(`Failed to read session: ${existingErr.message}${supabaseNetworkHint(existingErr)}`);
  }

  const payload = { teams, player_pool: Array.isArray(playerPool) ? playerPool : [] };

  if (existing) {
    const { error } = await db
      .from('team_sessions')
      .update({ ...payload, created_at: new Date().toISOString() })
      .eq('slug', existing.slug);
    if (error) throw new Error(`Failed to update session: ${error.message}${supabaseNetworkHint(error)}`);
    return { slug: existing.slug, replaced: true };
  }

  const slug = nanoid(10);
  const { error } = await db.from('team_sessions').insert({
    slug,
    date: today,
    created_at: new Date().toISOString(),
    ...payload,
  });
  if (error) throw new Error(`Failed to save session: ${error.message}${supabaseNetworkHint(error)}`);
  return { slug, replaced: false };
}

export async function getSessionForToday() {
  if (!hasSupabaseConfig()) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getClient()
    .from('team_sessions')
    .select('*')
    .eq('date', today)
    .maybeSingle();
  if (error && isSupabaseUnreachable(error)) {
    logUnreachableOnce('today', error);
    return null;
  }
  if (error) console.error('[sessions] getSessionForToday:', error.message);
  return data || null;
}

export async function getSessionBySlug(slug) {
  if (!hasSupabaseConfig()) return null;
  const { data, error } = await getClient()
    .from('team_sessions')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getRecentSessions(limit = 20) {
  if (!hasSupabaseConfig()) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getClient()
    .from('team_sessions')
    .select('slug, date, created_at, teams')
    .neq('date', today)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isSupabaseUnreachable(error)) {
      logUnreachableOnce('history', error);
      return [];
    }
    throw new Error(`Failed to load sessions: ${error.message}${supabaseNetworkHint(error)}`);
  }
  return data || [];
}

/** All sessions (newest first), including today — for public sessions browser. */
export async function listAllSessions(limit = 50) {
  if (!hasSupabaseConfig()) return [];
  const { data, error } = await getClient()
    .from('team_sessions')
    .select('slug, date, created_at, teams')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isSupabaseUnreachable(error)) {
      logUnreachableOnce('listAll', error);
      return [];
    }
    throw new Error(`Failed to load sessions: ${error.message}${supabaseNetworkHint(error)}`);
  }
  return data || [];
}

export async function updateTeams(slug, teams, playerPool) {
  assertSupabaseConfigured();
  const payload = { teams };
  if (playerPool !== undefined) payload.player_pool = Array.isArray(playerPool) ? playerPool : [];
  const { error } = await getClient()
    .from('team_sessions')
    .update(payload)
    .eq('slug', slug);
  if (error) throw new Error(`Failed to update teams: ${error.message}${supabaseNetworkHint(error)}`);
}

export async function updatePaidStatus(slug, teamId, playerId, paid) {
  assertSupabaseConfigured();
  const db = getClient();
  const { data: row, error: fetchErr } = await db
    .from('team_sessions')
    .select('teams')
    .eq('slug', slug)
    .single();
  if (fetchErr || !row) throw new Error('Session not found');

  const teams = row.teams.map((t) => {
    if (t.id !== teamId) return t;
    return {
      ...t,
      players: t.players.map((p) =>
        p.id === playerId ? { ...p, paid } : p
      ),
    };
  });

  const { error: updateErr } = await db
    .from('team_sessions')
    .update({ teams })
    .eq('slug', slug);
  if (updateErr) throw new Error(`Failed to update: ${updateErr.message}${supabaseNetworkHint(updateErr)}`);
}

function normalizeHistoryName(n) {
  return String(n || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Session appearances for a roster player: match current UUID on teams, or the same display name
 * (case-insensitive) for older sessions that used sheet ids like p-1, p-2.
 */
export async function getAppearancesForPlayer(playerId) {
  if (!hasSupabaseConfig()) return [];
  const roster = await getRosterPlayerBySlugOrId(playerId);
  const nameKey = roster?.name ? normalizeHistoryName(roster.name) : '';

  const { data: rows, error } = await getClient()
    .from('team_sessions')
    .select('slug, date, teams')
    .order('date', { ascending: false });
  if (error) {
    if (isSupabaseUnreachable(error)) return [];
    throw new Error(`Failed to load history: ${error.message}`);
  }

  const appearances = [];
  const seen = new Set();

  for (const row of rows || []) {
    for (const team of row.teams || []) {
      for (const p of team.players || []) {
        const byId = String(p.id) === String(playerId);
        const byName = Boolean(nameKey) && normalizeHistoryName(p.name) === nameKey;
        if (!byId && !byName) continue;

        const dedupeKey = `${row.slug}\0${team.id}\0${p.id}\0${p.name}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        appearances.push({
          slug: row.slug,
          date: row.date,
          teamId: team.id,
          teamName: team.name,
          paid: !!p.paid,
          legacyNameMatch: byName && !byId,
        });
      }
    }
  }

  return appearances;
}
