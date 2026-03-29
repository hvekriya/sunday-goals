/**
 * Curated DiceBear presets only — no arbitrary image URLs. Keep in sync between client and server.
 * @see https://www.dicebear.com/
 *
 * Use SVG (9.x): higher rate limits than PNG. PNG is capped at ~10 req/s; a full grid of PNGs often 429s.
 */

const DICEBEAR_VERSION = '9.x';

const STYLES = [
  'avataaars',
  'adventurer',
  'big-smile',
  'fun-emoji',
  'notionists',
  'bottts',
  'lorelei',
  'micah',
];

function buildPresets() {
  const presets = [];
  const target = 48;
  for (let i = 0; i < target; i += 1) {
    const style = STYLES[i % STYLES.length];
    const seed = `tb-${i}-${((i * 1103515245 + 12345) >>> 0).toString(36)}`;
    presets.push({ style, seed });
  }
  return presets;
}

export const CARTOON_AVATAR_PRESETS = buildPresets();

export const CARTOON_AVATAR_PRESET_COUNT = CARTOON_AVATAR_PRESETS.length;

function lockFromPlayerId(id) {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Index used when avatar_pick is null in the database. */
export function defaultAvatarPickForPlayerId(playerId) {
  return lockFromPlayerId(playerId) % CARTOON_AVATAR_PRESET_COUNT;
}

export function isValidAvatarPick(pick) {
  return Number.isInteger(pick) && pick >= 0 && pick < CARTOON_AVATAR_PRESET_COUNT;
}

/** Coerce JSON/API values (e.g. string "3") to an integer pick, or null/undefined for auto. */
function normalizeAvatarPick(pick) {
  if (pick === null || pick === undefined) return pick;
  const n = typeof pick === 'number' ? pick : Number(pick);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.trunc(n);
  if (i !== n) return undefined;
  return i;
}

function resolveCartoonPreset(playerId, avatarPick) {
  const coerced = normalizeAvatarPick(avatarPick);
  const pick =
    coerced != null && isValidAvatarPick(coerced) ? coerced : defaultAvatarPickForPlayerId(playerId);
  return CARTOON_AVATAR_PRESETS[pick];
}

function effectiveCartoonSeed(playerId, avatarPick, avatarSeed) {
  const preset = resolveCartoonPreset(playerId, avatarPick);
  const custom = avatarSeed != null ? String(avatarSeed).trim() : '';
  return custom || preset.seed;
}

/**
 * DiceBear HTTP API — SVG (recommended).
 * @see https://www.dicebear.com/how-to-use/http-api/
 */
export function diceBearCartoonSvgUrl(style, seed, size = 128) {
  const params = new URLSearchParams();
  params.set('seed', seed);
  if (size) params.set('size', String(size));
  return `https://api.dicebear.com/${DICEBEAR_VERSION}/${style}/svg?${params.toString()}`;
}

const SEED_MAX = 64;
const SEED_RE = /^[\p{L}\p{N}\s\-_.',!?*+()#&%]{1,64}$/u;

/**
 * Normalize optional avatar seed for storage (DiceBear `seed` option).
 * @returns {string|null}
 */
export function normalizeAvatarSeedForSave(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > SEED_MAX) {
    throw new Error(`Seed must be at most ${SEED_MAX} characters`);
  }
  if (!SEED_RE.test(s)) {
    throw new Error('Seed may only contain letters, numbers, spaces, and common punctuation');
  }
  return s;
}

/**
 * @param {string} playerId
 * @param {number | null | undefined} avatarPick — null/undefined = auto index from player id
 * @param {string | null | undefined} avatarSeed — optional DiceBear seed (face variation)
 * @param {number} [size]
 */
export function cartoonUrlForPlayer(playerId, avatarPick, avatarSeed, size = 128) {
  const coerced = normalizeAvatarPick(avatarPick);
  const preset = resolveCartoonPreset(playerId, coerced);
  const seed = effectiveCartoonSeed(playerId, coerced, avatarSeed);
  return diceBearCartoonSvgUrl(preset.style, seed, size);
}
