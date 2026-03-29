const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeNameKey(n) {
  return String(n || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Player row from GET /api/roster (has slug when DB migrated). */
export function profilePathForRosterPlayer(p) {
  if (!p) return '/players';
  if (p.slug) return `/player/${encodeURIComponent(p.slug)}`;
  if (UUID_RE.test(String(p.id).trim())) return `/player/${encodeURIComponent(p.id)}`;
  return '/players';
}

/**
 * Row from session JSON (may use legacy ids like p-31). Resolve via roster list by id or name.
 */
export function profilePathForSessionPlayer(sessionPlayer, roster) {
  if (!sessionPlayer) return '/players';
  const list = roster || [];
  const sid = String(sessionPlayer.id || '').trim();
  if (UUID_RE.test(sid)) {
    const r = list.find((x) => x.id === sid);
    if (r?.slug) return `/player/${encodeURIComponent(r.slug)}`;
    return `/player/${encodeURIComponent(sid)}`;
  }
  const nk = normalizeNameKey(sessionPlayer.name);
  if (nk) {
    const r = list.find((x) => normalizeNameKey(x.name) === nk);
    if (r?.slug) return `/player/${encodeURIComponent(r.slug)}`;
  }
  return '/players';
}
