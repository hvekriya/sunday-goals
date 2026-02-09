import { useState, useEffect } from 'react';
import styles from './Home.module.css';

const API = '/api';

// Default: Sunday Goals Players spreadsheet
const DEFAULT_SPREADSHEET_ID = '1SnJ9yGvpjgtSF5GbsauyU_OE2v2zClkDeIcoIeDAqck';
const DEFAULT_SHEET_NAME = 'Sheet1';

export default function Home() {
  const [spreadsheetId, setSpreadsheetId] = useState(DEFAULT_SPREADSHEET_ID);
  const [sheetName, setSheetName] = useState(DEFAULT_SHEET_NAME);
  const [numTeams, setNumTeams] = useState(2);
  const [players, setPlayers] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function extractIdFromUrl(url) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : url.trim();
  }

  async function loadPlayers(id, sheet) {
    const effectiveId = extractIdFromUrl(id || spreadsheetId);
    if (!effectiveId) return;
    setLoading(true);
    setError('');
    setPlayers(null);
    try {
      const res = await fetch(`${API}/players?spreadsheetId=${encodeURIComponent(effectiveId)}&sheetName=${encodeURIComponent(sheet || sheetName)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setPlayers(data);
      setSelectedIds(new Set((data || []).map((p) => p.id)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlayers(DEFAULT_SPREADSHEET_ID, DEFAULT_SHEET_NAME);
  }, []);

  async function handleLoad() {
    if (!extractIdFromUrl(spreadsheetId)) {
      setError('Enter a spreadsheet ID or full Google Sheet URL.');
      return;
    }
    await loadPlayers(spreadsheetId, sheetName);
  }

  function togglePlayer(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (players) setSelectedIds(new Set(players.map((p) => p.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleGenerate() {
    if (!players || players.length === 0) {
      setError('Load players from the sheet first.');
      return;
    }
    const selectedPlayers = players.filter((p) => selectedIds.has(p.id));
    if (selectedPlayers.length === 0) {
      setError('Select at least one player to generate teams.');
      return;
    }
    const n = Math.max(1, Math.min(20, parseInt(numTeams, 10) || 2));
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: selectedPlayers, numTeams: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const shareUrl = result?.slug
    ? `${window.location.origin}/t/${result.slug}`
    : '';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>SKSST Woolwich - Sunday Goals Team Balancer</h1>
        <p className={styles.subtitle}>Load players from Google Sheets → balance into equal teams → share a link</p>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>1. Google Sheet</h2>
          <p className={styles.hint}>Share the sheet as &quot;Anyone with the link can view&quot;. Use columns: <strong>Name</strong>, <strong>Rank</strong> (S highest, then A, B, C, Unranked), <strong>Image</strong> (optional URL).</p>
          <div className={styles.row}>
            <input
              type="text"
              placeholder="Spreadsheet ID or full Google Sheet URL"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Sheet name"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className={styles.inputShort}
            />
            <button onClick={handleLoad} disabled={loading} className={styles.btn}>
              {loading && !players ? 'Loading…' : 'Load players'}
            </button>
          </div>
        </section>

        {players && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>2. Select who&apos;s playing ({selectedIds.size} of {players.length} selected)</h2>
            <p className={styles.hint}>Click a player to include or exclude them. Only selected players are used when generating teams.</p>
            <div className={styles.playerSelectRow}>
              <button type="button" onClick={selectAll} className={styles.btnSmall}>Select all</button>
              <button type="button" onClick={deselectAll} className={styles.btnSmall}>Deselect all</button>
            </div>
            <div className={styles.playersPreview}>
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={selectedIds.has(p.id) ? styles.playerChip : styles.playerChipInactive}
                  data-rank={p.ranking}
                  onClick={() => togglePlayer(p.id)}
                  title={selectedIds.has(p.id) ? 'Click to exclude' : 'Click to include'}
                >
                  {selectedIds.has(p.id) && <span className={styles.chipTick} aria-hidden>✓</span>}
                  {p.name} <em>{p.ranking}</em>
                </button>
              ))}
            </div>
            <div className={styles.row}>
              <label className={styles.label}>
                Number of teams
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numTeams}
                  onChange={(e) => setNumTeams(parseInt(e.target.value, 10) || 2)}
                  className={styles.inputNum}
                />
              </label>
              <button onClick={handleGenerate} disabled={loading} className={styles.btnPrimary}>
                {loading && result === null ? 'Generating…' : 'Generate teams'}
              </button>
            </div>
          </section>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {result && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Today&apos;s teams</h2>
            <div className={styles.shareBox}>
              <label className={styles.label}>Share this link</label>
              <div className={styles.shareRow}>
                <input readOnly value={shareUrl} className={styles.input} />
                <button
                  className={styles.btn}
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                  }}
                >
                  Copy
                </button>
              </div>
              <p className={styles.meta}>Link generated on {new Date().toLocaleDateString()} — unique URL for this session.</p>
            </div>
            <div className={styles.teamsGrid}>
              {result.teams.map((team) => (
                <div key={team.id} className={styles.teamCard}>
                  <h3 className={styles.teamName}>{team.name}</h3>
                  <p className={styles.teamPoints}>Total: {team.totalPoints} pts</p>
                  <ul className={styles.teamList}>
                    {team.players.map((p) => (
                      <li key={p.id} className={styles.teamPlayer} data-rank={p.ranking}>
                        {p.image ? <img src={p.image} alt="" className={styles.avatar} /> : <span className={styles.avatarPlaceholder} />}
                        <span>{p.name}</span>
                        <span className={styles.rank}>{p.ranking}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <a href={shareUrl} className={styles.viewLink}>Open shareable view →</a>
          </section>
        )}
      </main>
    </div>
  );
}
