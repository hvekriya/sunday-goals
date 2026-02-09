/**
 * Fetch players from a public Google Sheet.
 * Sheet must be shared as "Anyone with the link can view".
 * Expected columns (any case): image/picture/photo, name, ranking
 * Ranking values: S, A, B, C, Unranked (or blank)
 */

const OPENSHEET_BASE = 'https://opensheet.elk.sh';

export async function fetchPlayersFromSheet(spreadsheetId, sheetName = 'Sheet1') {
  const url = `${OPENSHEET_BASE}/${spreadsheetId}/${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const normalized = normalizeHeaders(rows[0]);
  const players = [];
  const isHeaderLabel = (name) => {
    const n = String(name).trim().toLowerCase();
    return ['name', 'rank', 'ranking', 'tier', 'image', 'picture', 'photo', 'avatar', 'player', 'playername'].includes(n);
  };

  // Only treat row 0 as header if it actually looks like one; otherwise include it as data (fixes missing first player)
  const firstRowName = String(getCell(rows[0], normalized.name)).trim();
  const startIndex = rows.length > 0 && isHeaderLabel(firstRowName) ? 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const rawName = getCell(row, normalized.name);
    const name = String(rawName).trim();
    if (!name) continue;
    if (isHeaderLabel(name)) continue;

    const ranking = normalizeRanking(getCell(row, normalized.ranking));
    const image = normalized.image ? getCell(row, normalized.image) : '';

    players.push({
      id: `p-${players.length + 1}`,
      name,
      ranking,
      image: String(image || '').trim() || null,
    });
  }

  return players;
}

function normalizeHeaders(firstRow) {
  const keys = Object.keys(firstRow || {});
  const lower = (s) => (s == null ? '' : String(s).toLowerCase());
  const find = (...variants) => {
    for (const v of variants) {
      const k = keys.find((key) => lower(key).replace(/\s+/g, '') === v.replace(/\s+/g, ''));
      if (k) return k;
    }
    return null;
  };
  return {
    name: find('name', 'player', 'playername') || keys[0],
    ranking: find('ranking', 'rank', 'tier') || keys[1] || keys[0],
    image: find('image', 'picture', 'photo', 'avatar', 'img'),
  };
}

function getCell(row, key) {
  if (!key) return undefined;
  const v = row[key];
  return v === undefined || v === null ? '' : v;
}

function normalizeRanking(value) {
  const v = String(value ?? '').trim().toUpperCase();
  if (['S', 'A', 'B', 'C'].includes(v)) return v;
  if (v === '' || v === 'UNRANKED') return 'Unranked';
  return 'Unranked';
}
