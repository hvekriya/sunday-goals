import { getClient, assertSupabaseConfigured } from './supabaseClient.js';
import {
  isValidAvatarPick,
  CARTOON_AVATAR_PRESET_COUNT,
  normalizeAvatarSeedForSave,
} from '../shared/cartoonPresets.js';

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
  const rawSeed = row.avatar_seed != null ? String(row.avatar_seed).trim() : '';
  return {
    id: row.id,
    slug: row.slug || undefined,
    name: row.name,
    ranking: row.ranking,
    notes: row.notes || undefined,
    avatar_pick:
      row.avatar_pick != null && Number.isInteger(Number(row.avatar_pick))
        ? Number(row.avatar_pick)
        : null,
    avatar_seed: rawSeed || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const PLAYER_SELECT = 'id, slug, name, ranking, notes, avatar_pick, avatar_seed, created_at, updated_at';

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
  assertSupabaseConfigured();
  const client = getClient();
  let { data, error } = await client.from('players').select(PLAYER_SELECT).order('name', { ascending: true });
  if (error) {
    const msg = String(error.message || '');
    const details = String(error.details || '');
    const blob = `${msg} ${details}`;

    // Must run before any broad "does not exist" check: missing column errors also contain that phrase.
    if (
      error.code === '42703' &&
      /avatar_pick/i.test(blob) &&
      (/does not exist/i.test(blob) || /not found/i.test(blob))
    ) {
      const hint =
        'Add column `avatar_pick` on `public.players` (integer). Run supabase/migrations/003_players_avatar_pick.sql in the Supabase SQL editor.';
      console.error('[players]', hint);
      throw new Error(hint);
    }

    if (
      error.code === '42703' &&
      /avatar_seed/i.test(blob) &&
      (/does not exist/i.test(blob) || /not found/i.test(blob))
    ) {
      const hint =
        'Add column `avatar_seed` on `public.players` (text). Run supabase/migrations/004_players_avatar_seed.sql in the Supabase SQL editor.';
      console.error('[players]', hint);
      throw new Error(hint);
    }

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

export async function createRosterPlayer({ name, ranking, notes }) {
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
      notes: notes?.trim() || null,
    })
    .select(PLAYER_SELECT)
    .single();
  if (error) throw new Error(`Failed to create player: ${error.message}`);
  return rowToPlayer(data);
}

export async function updateRosterPlayer(id, { name, ranking, notes }) {
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

/**
 * Public: anyone can set curated cartoon pick and/or DiceBear seed (no auth).
 * @param {{ pick?: number | null, seed?: string | null }} body — include only fields to change
 */
export async function updateRosterPlayerCartoon(id, body) {
  assertSupabaseConfigured();
  if (!isUuid(String(id))) throw new Error('Player not found');
  const hasPick = Object.prototype.hasOwnProperty.call(body, 'pick');
  const hasSeed = Object.prototype.hasOwnProperty.call(body, 'seed');
  if (!hasPick && !hasSeed) throw new Error('Request must include pick and/or seed');

  const patch = { updated_at: new Date().toISOString() };

  if (hasPick) {
    const { pick } = body;
    if (pick === null) {
      patch.avatar_pick = null;
    } else {
      const n = Number(pick);
      if (!Number.isInteger(n) || !isValidAvatarPick(n)) {
        throw new Error(`pick must be null or an integer 0..${CARTOON_AVATAR_PRESET_COUNT - 1}`);
      }
      patch.avatar_pick = n;
    }
  }

  if (hasSeed) {
    try {
      patch.avatar_seed = normalizeAvatarSeedForSave(body.seed);
    } catch (e) {
      throw new Error(e.message || 'Invalid seed');
    }
  }

  const { data, error } = await getClient()
    .from('players')
    .update(patch)
    .eq('id', id)
    .select(PLAYER_SELECT)
    .maybeSingle();
  if (error) throw new Error(`Failed to update avatar: ${error.message}`);
  if (!data) throw new Error('Player not found');
  return rowToPlayer(data);
}
