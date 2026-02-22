import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function saveSession(teams) {
  const today = new Date().toISOString().slice(0, 10);

  // Check if a session already exists for today
  const { data: existing } = await supabase
    .from('team_sessions')
    .select('slug')
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    // Update the existing session for today instead of creating a new one
    const { error } = await supabase
      .from('team_sessions')
      .update({ teams, created_at: new Date().toISOString() })
      .eq('slug', existing.slug);
    if (error) throw new Error(`Failed to update session: ${error.message}`);
    return { slug: existing.slug, replaced: true };
  }

  const slug = nanoid(10);
  const { error } = await supabase.from('team_sessions').insert({
    slug,
    date: today,
    created_at: new Date().toISOString(),
    teams,
  });
  if (error) throw new Error(`Failed to save session: ${error.message}`);
  return { slug, replaced: false };
}

export async function getSessionForToday() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('team_sessions')
    .select('*')
    .eq('date', today)
    .maybeSingle();
  return data || null;
}

export async function getSessionBySlug(slug) {
  const { data, error } = await supabase
    .from('team_sessions')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getRecentSessions(limit = 20) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('team_sessions')
    .select('slug, date, created_at, teams')
    .neq('date', today)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load sessions: ${error.message}`);
  return data || [];
}

export async function updatePaidStatus(slug, teamId, playerId, paid) {
  const { data: row, error: fetchErr } = await supabase
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

  const { error: updateErr } = await supabase
    .from('team_sessions')
    .update({ teams })
    .eq('slug', slug);
  if (updateErr) throw new Error(`Failed to update: ${updateErr.message}`);
}
