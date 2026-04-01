import { getAnonClient, assertSupabaseConfigured } from './supabaseClient.js';

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

async function allocateUniqueSlug(name, excludePlayerId, client) {
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
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const PLAYER_SELECT = 'id, slug, name, ranking, notes, created_at, updated_at';

/** Old DB objects or stale API builds may still reference dropped avatar columns. */
function throwIfAvatarColumnError(error) {
  const msg = String(error.message || '');
  const details = String(error.details || '');
  const blob = `${msg} ${details}`;
  if (error.code !== '42703') return;
  if (!/avatar_pick/i.test(blob) && !/avatar_seed/i.test(blob)) return;
  const hint =
    'The app no longer uses `avatar_pick` or `avatar_seed`. Deploy the latest API (roster queries omit those columns). If this error persists, remove DB policies/views/triggers that reference those columns — run `supabase/migrations/006_remove_avatar_columns_and_cartoon_rls.sql`. Do not add those columns via legacy `003_players_avatar_pick.sql`.';
  console.error('[players]', hint);
  throw new Error(hint);
}

export async function listRosterPlayers() {
  assertSupabaseConfigured();
  const client = getAnonClient();
  let { data, error } = await client.from('players').select(PLAYER_SELECT).order('name', { ascending: true });
  if (error) {
    throwIfAvatarColumnError(error);
    const msg = String(error.message || '');
    const details = String(error.details || '');
    const blob = `${msg} ${details}`;

    if (
      error.code === '42703' ||
      (/slug/i.test(blob) && /does not exist/i.test(blob)) ||
      (/column/i.test(blob) && /slug/i.test(blob) && (/does not exist/i.test(blob) || /not found/i.test(blob)))
    ) {
      const hint =
        'Add column `slug` on `public.players` (text, unique). In Supabase SQL Editor: ALTER TABLE public.players ADD COLUMN IF NOT EXISTS slug text; then backfill and add a unique index if needed.';
      console.error('[players] Column `slug` missing or invalid —', hint);
      throw new Error(`Database schema out of date: ${hint}`);
    }

    if (
      error.code === '42P01' ||
      /relation\s+["']?public\.players["']?\s+does not exist/i.test(msg) ||
      /relation\s+["']?players["']?\s+does not exist/i.test(msg)
    ) {
      const errMsg =
        'Database table `players` is missing. Create `public.players` in the Supabase SQL editor (same project as your .env).';
      console.error('[players]', errMsg);
      throw new Error(errMsg);
    }

    throw new Error(`Failed to load roster: ${error.message}`);
  }
  data = data || [];
  return data.map(rowToPlayer);
}

/** Lookup by UUID or by url slug (never passes invalid uuid to Postgres). */
export async function getRosterPlayerBySlugOrId(raw) {
  assertSupabaseConfigured();
  const key = decodeURIComponent(String(raw || '').trim());
  if (!key) return null;

  const client = getAnonClient();
  if (isUuid(key)) {
    const { data, error } = await client.from('players').select(PLAYER_SELECT).eq('id', key).maybeSingle();
    if (error) {
      throwIfAvatarColumnError(error);
      throw new Error(`Failed to load player: ${error.message}`);
    }
    return data ? rowToPlayer(data) : null;
  }

  const slug = key.toLowerCase();
  const { data, error } = await client.from('players').select(PLAYER_SELECT).eq('slug', slug).maybeSingle();
  if (error) {
    throwIfAvatarColumnError(error);
    throw new Error(`Failed to load player: ${error.message}`);
  }
  return data ? rowToPlayer(data) : null;
}

export async function createRosterPlayer(db, { name, ranking, notes }) {
  assertSupabaseConfigured();
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('name is required');
  const slug = await allocateUniqueSlug(trimmed, null, db);
  const { data, error } = await db
    .from('players')
    .insert({
      name: trimmed,
      slug,
      ranking: normalizeRanking(ranking),
      notes: notes?.trim() || null,
    })
    .select(PLAYER_SELECT)
    .single();
  if (error) throw new Error(`Failed to create player: ${error.message}`);
  return rowToPlayer(data);
}

export async function updateRosterPlayer(db, id, { name, ranking, notes }) {
  assertSupabaseConfigured();
  if (!isUuid(String(id))) throw new Error('Player not found');
  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) {
    const t = name.trim();
    if (!t) throw new Error('name cannot be empty');
    patch.name = t;
    patch.slug = await allocateUniqueSlug(t, id, db);
  }
  if (ranking !== undefined) patch.ranking = normalizeRanking(ranking);
  if (notes !== undefined) patch.notes = notes?.trim() || null;

  const { data, error } = await db
    .from('players')
    .update(patch)
    .eq('id', id)
    .select(PLAYER_SELECT)
    .maybeSingle();
  if (error) throw new Error(`Failed to update player: ${error.message}`);
  if (!data) throw new Error('Player not found');
  return rowToPlayer(data);
}

export async function deleteRosterPlayer(db, id) {
  assertSupabaseConfigured();
  if (!isUuid(String(id))) throw new Error('Player not found');
  const { error } = await db.from('players').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete player: ${error.message}`);
}
