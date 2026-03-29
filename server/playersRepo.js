import { getClient, assertSupabaseConfigured, hasSupabaseConfig } from './supabaseClient.js';

const RANKINGS = new Set(['S', 'A', 'B', 'C', 'Unranked']);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s) {
  return typeof s === 'string' && UUID_RE.test(s.trim());
}

function normalizeRanking(r) {
  const x = (r || 'Unranked').trim();
  return RANKINGS.has(x) ? x : 'Unranked';
}

export function slugifyName(name) {
  const s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return s || 'player';
}

async function allocateUniqueSlug(name, excludePlayerId) {
  const client = getClient();
  const base = slugifyName(name);
  let candidate = base;
  for (let n = 2; n < 5000; n += 1) {
    const { data } = await client.from('players').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    if (excludePlayerId && data.id === excludePlayerId) return candidate;
    candidate = `${base}-${n}`;
  }
  throw new Error('Could not allocate unique slug');
}

function rowToPlayer(row) {
  return {
    id: row.id,
    slug: row.slug || undefined,
    name: row.name,
    ranking: row.ranking,
    image: row.image_url || undefined,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const PLAYER_SELECT = 'id, slug, name, ranking, image_url, notes, created_at, updated_at';

async function backfillMissingSlugs(rows) {
  const client = getClient();
  const missing = (rows || []).filter((r) => !r.slug);
  for (const r of missing) {
    try {
      const slug = await allocateUniqueSlug(r.name, r.id);
      await client.from('players').update({ slug }).eq('id', r.id);
      r.slug = slug;
    } catch (e) {
      console.error('[players] slug backfill failed for', r.id, e.message);
    }
  }
}

export async function listRosterPlayers() {
  if (!hasSupabaseConfig()) return [];
  const client = getClient();
  let { data, error } = await client.from('players').select(PLAYER_SELECT).order('name', { ascending: true });
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.error('[players] Table `players` missing — run supabase/migrations/001_players.sql');
      return [];
    }
    if (error.message?.includes('slug')) {
      console.error('[players] Column `slug` missing — run supabase/migrations/002_players_slug.sql');
      throw new Error('Database schema out of date: add players.slug (see supabase/migrations/002_players_slug.sql)');
    }
    throw new Error(`Failed to load roster: ${error.message}`);
  }
  data = data || [];
  await backfillMissingSlugs(data);
  return data.map(rowToPlayer);
}

/** Lookup by UUID or by url slug (never passes invalid uuid to Postgres). */
export async function getRosterPlayerBySlugOrId(raw) {
  assertSupabaseConfigured();
  const key = decodeURIComponent(String(raw || '').trim());
  if (!key) return null;

  const client = getClient();
  if (isUuid(key)) {
    const { data, error } = await client.from('players').select(PLAYER_SELECT).eq('id', key).maybeSingle();
    if (error) throw new Error(`Failed to load player: ${error.message}`);
    return data ? rowToPlayer(data) : null;
  }

  const slug = key.toLowerCase();
  const { data, error } = await client.from('players').select(PLAYER_SELECT).eq('slug', slug).maybeSingle();
  if (error) throw new Error(`Failed to load player: ${error.message}`);
  return data ? rowToPlayer(data) : null;
}

/** @deprecated use getRosterPlayerBySlugOrId — kept for sessions history (always uuid). */
export async function getRosterPlayer(id) {
  if (!isUuid(String(id))) return null;
  return getRosterPlayerBySlugOrId(id);
}

export async function createRosterPlayer({ name, ranking, image, notes }) {
  assertSupabaseConfigured();
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('name is required');
  const slug = await allocateUniqueSlug(trimmed, null);
  const { data, error } = await getClient()
    .from('players')
    .insert({
      name: trimmed,
      slug,
      ranking: normalizeRanking(ranking),
      image_url: image?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select(PLAYER_SELECT)
    .single();
  if (error) throw new Error(`Failed to create player: ${error.message}`);
  return rowToPlayer(data);
}

export async function updateRosterPlayer(id, { name, ranking, image, notes }) {
  assertSupabaseConfigured();
  if (!isUuid(String(id))) throw new Error('Player not found');
  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) {
    const t = name.trim();
    if (!t) throw new Error('name cannot be empty');
    patch.name = t;
    patch.slug = await allocateUniqueSlug(t, id);
  }
  if (ranking !== undefined) patch.ranking = normalizeRanking(ranking);
  if (image !== undefined) patch.image_url = image?.trim() || null;
  if (notes !== undefined) patch.notes = notes?.trim() || null;

  const { data, error } = await getClient()
    .from('players')
    .update(patch)
    .eq('id', id)
    .select(PLAYER_SELECT)
    .maybeSingle();
  if (error) throw new Error(`Failed to update player: ${error.message}`);
  if (!data) throw new Error('Player not found');
  return rowToPlayer(data);
}

export async function deleteRosterPlayer(id) {
  assertSupabaseConfigured();
  if (!isUuid(String(id))) throw new Error('Player not found');
  const { error } = await getClient().from('players').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete player: ${error.message}`);
}
