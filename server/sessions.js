import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function saveSession(teams) {
  const slug = nanoid(10);
  const { error } = await supabase.from('team_sessions').insert({
    slug,
    date: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    teams,
  });
  if (error) throw new Error(`Failed to save session: ${error.message}`);
  return slug;
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
