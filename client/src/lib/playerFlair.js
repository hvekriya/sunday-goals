/** Fun placeholder labels — stable per player id, unrelated to real rank. */
const LABELS = [
  'Dribbler',
  'Playmaker',
  'Finisher',
  'Wall',
  'Engine',
  'Poacher',
  'Sniper',
  'Creator',
  'Enforcer',
  'Magician',
  'Workhorse',
  'Showstopper',
  'Anchor',
  'Wildcard',
  'Cannon',
  'Silk',
  'Thunder',
  'Fox',
  'Bulldog',
  'Maestro',
  'Tactician',
  'Speedster',
  'Rock',
  'Spark',
];

/**
 * @param {string} playerId
 * @returns {string}
 */
export function playerFlairLabel(playerId) {
  const id = String(playerId || '');
  if (!id) return LABELS[0];
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % LABELS.length;
  return LABELS[idx];
}
