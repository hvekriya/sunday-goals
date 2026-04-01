/**
 * Derive display initials from a display name.
 * - Two or more words: first letter of first word + first letter of last word ("Haresh V" → "HV").
 * - One word: first two letters ("Alex" → "AL").
 */
export function initialsFromName(name) {
  const s = String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return '?';
  const parts = s.split(' ').filter(Boolean);
  if (parts.length === 1) {
    const w = parts[0];
    if (w.length <= 1) return w.toUpperCase();
    return (w[0] + w[1]).toUpperCase();
  }
  const first = parts[0][0] || '';
  const last = parts[parts.length - 1][0] || '';
  return (first + last).toUpperCase();
}

/** Stable hue 0–359 for avatar background from id or name. */
export function hueForString(key) {
  let h = 0;
  const str = String(key || 'x');
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
