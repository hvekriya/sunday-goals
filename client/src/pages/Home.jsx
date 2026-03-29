import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './Home.module.css';
import { adminHeaders } from '../lib/adminHeaders';
import { profilePathForSessionPlayer } from '../lib/playerProfilePath';

const API = '/api';

export default function Home() {
  const [numTeams, setNumTeams] = useState(2);
  const [players, setPlayers] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [todayLoading, setTodayLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [teams, setTeams] = useState(null);
  const [playerPool, setPlayerPool] = useState([]);
  const teamsRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [todaySession, setTodaySession] = useState(null);
  // when true, show the generate form even if today's session exists
  const [showGenerate, setShowGenerate] = useState(false);
  // drag: { playerId, fromTeamId }
  const drag = useRef(null);
  const [dragOverTeam, setDragOverTeam] = useState(null);
  const [dragOverPlayer, setDragOverPlayer] = useState(null);

  // Replace modal: { teamId, player }
  const [replaceTarget, setReplaceTarget] = useState(null);
  // Add player modal: teamId (append roster player not on any team)
  const [addToTeamId, setAddToTeamId] = useState(null);

  // Admin auth
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('isAdmin') === 'true');
  const [showUnlock, setShowUnlock] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  async function loadRoster() {
    setRosterLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/roster`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load roster');
      setPlayers(data);
      setSelectedIds(new Set((data || []).map((p) => p.id)));
    } catch (e) {
      setError(e.message);
      setPlayers([]);
      setSelectedIds(new Set());
    } finally {
      setRosterLoading(false);
    }
  }

  useEffect(() => {
    if (sessionStorage.getItem('isAdmin') === 'true' && !sessionStorage.getItem('adminPassword')) {
      sessionStorage.removeItem('isAdmin');
      setIsAdmin(false);
    }
    loadHistory();
    loadTodaySession();
    loadRoster();
  }, []);

  async function loadTodaySession() {
    setTodayLoading(true);
    try {
      const res = await fetch(`${API}/sessions/today`);
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setTodaySession(data);
        setResult({ slug: data.slug });
        applyTeams(data.teams.map((t) => ({ ...t, players: [...t.players] })));
        setPlayerPool(Array.isArray(data.player_pool) ? data.player_pool : []);
      }
    } catch {
      // non-critical
    } finally {
      setTodayLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch(`${API}/sessions`);
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data);
    } catch {
      // history is non-critical, fail silently
    }
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
      setError('Add players in the database first (Players page).');
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
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({
          players: selectedPlayers,
          numTeams: n,
          playerPool: players.filter((p) => !selectedIds.has(p.id)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      setResult(data);
      applyTeams(data.teams.map((t) => ({ ...t, players: [...t.players] })));
      setPlayerPool(Array.isArray(data.playerPool) ? data.playerPool : []);
      setTodaySession({
        slug: data.slug,
        date: new Date().toISOString().slice(0, 10),
        teams: data.teams,
        player_pool: data.playerPool || [],
      });
      setShowGenerate(false);
      loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function togglePaid(slug, teamId, playerId, currentPaid) {
    const paid = !currentPaid;
    // optimistic update
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        return { ...t, players: t.players.map((p) => p.id === playerId ? { ...p, paid } : p) };
      })
    );
    try {
      await fetch(`${API}/teams/${slug}/paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ teamId, playerId, paid }),
      });
    } catch {
      // revert on failure
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== teamId) return t;
          return { ...t, players: t.players.map((p) => p.id === playerId ? { ...p, paid: currentPaid } : p) };
        })
      );
    }
  }

  function handleDragStart(playerId, fromTeamId) {
    drag.current = { playerId, fromTeamId };
  }

  function handleDragEnd() {
    drag.current = null;
    setDragOverTeam(null);
    setDragOverPlayer(null);
  }

  function applyTeams(next) {
    teamsRef.current = next;
    setTeams(next);
  }

  const RANK_POINTS = { S: 4, A: 3, B: 2, C: 1, Unranked: 0 };

  async function persistTeams(slug, updatedTeams, updatedPool) {
    if (!slug) {
      console.warn('[persistTeams] no slug — skipping save');
      return;
    }
    const body = { teams: updatedTeams };
    if (updatedPool !== undefined) body.playerPool = updatedPool;
    try {
      const res = await fetch(`${API}/teams/${slug}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[persistTeams] server error:', res.status, err);
      } else {
        console.log('[persistTeams] saved OK for slug:', slug);
      }
    } catch (e) {
      console.error('[persistTeams] fetch failed:', e);
    }
  }

  function handleDropOnPlayer(targetPlayerId, targetTeamId) {
    if (!drag.current) return;
    const { playerId: srcId, fromTeamId: srcTeamId } = drag.current;
    if (srcId === targetPlayerId) return;

    const prev = teamsRef.current;
    const next = prev.map((t) => ({ ...t, players: [...t.players] }));
    const srcTeam = next.find((t) => t.id === srcTeamId);
    const tgtTeam = next.find((t) => t.id === targetTeamId);

    const srcIdx = srcTeam.players.findIndex((p) => p.id === srcId);
    const tgtIdx = tgtTeam.players.findIndex((p) => p.id === targetPlayerId);

    const srcPlayer = srcTeam.players[srcIdx];
    const tgtPlayer = tgtTeam.players[tgtIdx];

    if (srcTeamId === targetTeamId) {
      srcTeam.players.splice(srcIdx, 1);
      const insertAt = srcTeam.players.findIndex((p) => p.id === targetPlayerId);
      srcTeam.players.splice(insertAt, 0, srcPlayer);
    } else {
      srcTeam.players[srcIdx] = tgtPlayer;
      tgtTeam.players[tgtIdx] = srcPlayer;
    }

    applyTeams(next);
    persistTeams(result?.slug, next);

    drag.current = null;
    setDragOverTeam(null);
    setDragOverPlayer(null);
  }

  function rosterPlayersNotOnAnyTeam() {
    if (!players?.length || !teams?.length) return [];
    const onTeam = new Set();
    for (const t of teams) {
      for (const p of t.players) onTeam.add(p.id);
    }
    return players.filter((p) => !onTeam.has(p.id));
  }

  function handleAddPlayerToTeam(teamId, rosterPlayer) {
    const nextTeams = teamsRef.current.map((t) => ({ ...t, players: [...t.players] }));
    const team = nextTeams.find((t) => t.id === teamId);
    if (!team) return;

    const newPlayer = {
      id: rosterPlayer.id,
      name: rosterPlayer.name,
      ranking: rosterPlayer.ranking,
      image: rosterPlayer.image,
      points: RANK_POINTS[rosterPlayer.ranking] ?? 0,
      paid: false,
    };
    team.players.push(newPlayer);
    const nextPool = playerPool.filter((p) => p.id !== rosterPlayer.id);

    applyTeams(nextTeams);
    setPlayerPool(nextPool);
    persistTeams(result?.slug, nextTeams, nextPool);
    setAddToTeamId(null);
  }

  function handleReplaceWith(teamId, outPlayer, inPlayer) {
    const nextTeams = teamsRef.current.map((t) => ({ ...t, players: [...t.players] }));
    const team = nextTeams.find((t) => t.id === teamId);
    const idx = team.players.findIndex((p) => p.id === outPlayer.id);
    if (idx === -1) return;

    const newPlayer = {
      ...inPlayer,
      points: RANK_POINTS[inPlayer.ranking] ?? 0,
      paid: outPlayer.paid ?? false,
    };
    const backToPool = { ...outPlayer };
    delete backToPool.paid;
    delete backToPool.points;

    team.players[idx] = newPlayer;
    const nextPool = [...playerPool.filter((p) => p.id !== inPlayer.id), backToPool];

    applyTeams(nextTeams);
    setPlayerPool(nextPool);
    persistTeams(result?.slug, nextTeams, nextPool);
    setReplaceTarget(null);
  }

  function handleDropOnTeam(targetTeamId) {
    if (!drag.current) return;
    const { playerId: srcId, fromTeamId: srcTeamId } = drag.current;
    if (srcTeamId === targetTeamId) return;

    const prev = teamsRef.current;
    const next = prev.map((t) => ({ ...t, players: [...t.players] }));
    const srcTeam = next.find((t) => t.id === srcTeamId);
    const tgtTeam = next.find((t) => t.id === targetTeamId);
    const srcIdx = srcTeam.players.findIndex((p) => p.id === srcId);
    const [moved] = srcTeam.players.splice(srcIdx, 1);
    tgtTeam.players.push(moved);

    applyTeams(next);
    persistTeams(result?.slug, next);

    drag.current = null;
    setDragOverTeam(null);
    setDragOverPlayer(null);
  }

  async function handleUnlock(e) {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError('');
    try {
      const res = await fetch(`${API}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        sessionStorage.setItem('isAdmin', 'true');
        sessionStorage.setItem('adminPassword', adminPassword);
        setIsAdmin(true);
        setShowUnlock(false);
        setAdminPassword('');
      } else {
        setAdminError('Wrong password. Try again.');
      }
    } catch {
      setAdminError('Could not reach server.');
    } finally {
      setAdminLoading(false);
    }
  }

  function handleLockout() {
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminPassword');
    setIsAdmin(false);
  }

  const shareUrl = result?.slug
    ? `${window.location.origin}/t/${result.slug}`
    : '';

  // Only show the generate form if admin, no active session today (or explicitly regenerating)
  const showGenerateForm = isAdmin && !todayLoading && !rosterLoading && (!todaySession || showGenerate);

  const playersAvailableToAdd = addToTeamId ? rosterPlayersNotOnAnyTeam() : [];

  return (
    <div className={styles.page}>

      {/* Replace player modal */}
      {replaceTarget && (
        <div className={styles.modalOverlay} onClick={() => setReplaceTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Replace {replaceTarget.player.name}</h2>
            <p className={styles.hint}>Pick a player from the pool to swap in:</p>
            <ul className={styles.poolList}>
              {playerPool.map((poolPlayer) => (
                <li key={poolPlayer.id} className={styles.poolItem}>
                  <button
                    type="button"
                    className={styles.poolBtn}
                    data-rank={poolPlayer.ranking}
                    onClick={() => handleReplaceWith(replaceTarget.teamId, replaceTarget.player, poolPlayer)}
                  >
                    {poolPlayer.image ? (
                      <img src={poolPlayer.image} alt="" className={styles.avatar} />
                    ) : (
                      <span className={styles.avatarPlaceholder} />
                    )}
                    <span>{poolPlayer.name}</span>
                    <em>{poolPlayer.ranking}</em>
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setReplaceTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {addToTeamId && (
        <div className={styles.modalOverlay} onClick={() => setAddToTeamId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              Add player to {teams?.find((t) => t.id === addToTeamId)?.name ?? 'team'}
            </h2>
            <p className={styles.hint}>
              Choose someone from the roster who is not on a team yet (including the pool). They are appended to this team.
            </p>
            <ul className={styles.poolList}>
              {playersAvailableToAdd.length === 0 ? (
                <li className={styles.hint}>Everyone on the roster is already on a team.</li>
              ) : (
                playersAvailableToAdd.map((rp) => (
                  <li key={rp.id} className={styles.poolItem}>
                    <button
                      type="button"
                      className={styles.poolBtn}
                      data-rank={rp.ranking}
                      onClick={() => handleAddPlayerToTeam(addToTeamId, rp)}
                    >
                      {rp.image ? (
                        <img src={rp.image} alt="" className={styles.avatar} />
                      ) : (
                        <span className={styles.avatarPlaceholder} />
                      )}
                      <span>{rp.name}</span>
                      <em>{rp.ranking}</em>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setAddToTeamId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin unlock modal */}
      {showUnlock && (
        <div className={styles.modalOverlay} onClick={() => setShowUnlock(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Admin login</h2>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className={styles.input}
                autoFocus
              />
              {adminError && <p className={styles.modalError}>{adminError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btn} onClick={() => setShowUnlock(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={adminLoading}>
                  {adminLoading ? 'Checking…' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>SKSST Woolwich - Sunday Goals Team Balancer</h1>
        <p className={styles.subtitle}>Roster in the database → balanced teams → share a link. Guests can browse sessions, profiles, and pay via Monzo.</p>
        <div className={styles.adminBar}>
          {isAdmin ? (
            <button type="button" className={styles.adminBtn} onClick={handleLockout}>
              Admin mode — lock
            </button>
          ) : (
            <button type="button" className={styles.adminBtn} onClick={() => setShowUnlock(true)}>
              Admin login
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>

        {(todayLoading || rosterLoading) && (
          <div className={styles.todayLoading}>Loading…</div>
        )}

        {showGenerateForm && (
          <>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>1. Roster</h2>
              <p className={styles.hint}>
                Players live in the database (<Link to="/players">Players</Link>).{' '}
                <button type="button" className={styles.inlineLink} onClick={() => loadRoster()} disabled={rosterLoading}>
                  Refresh roster
                </button>
              </p>
              {players && players.length === 0 && (
                <p className={styles.warn}>No players yet. Add them on the Players page.</p>
              )}
              {showGenerate && todaySession && (
                <button
                  type="button"
                  className={styles.cancelRegenBtn}
                  onClick={() => setShowGenerate(false)}
                >
                  ← Cancel, keep today&apos;s teams
                </button>
              )}
            </section>

            {players && players.length > 0 && (
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
                    {loading ? 'Generating…' : showGenerate && todaySession ? 'Regenerate teams' : 'Generate teams'}
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {result && teams && (
          <section className={styles.card}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>Today&apos;s teams</h2>
              {todaySession && (
                <span className={styles.todayBadge}>Active · {todaySession.date}</span>
              )}
              {isAdmin && todaySession && !showGenerate && (
                <button
                  type="button"
                  className={styles.regenBtn}
                  onClick={() => { setShowGenerate(true); loadRoster(); }}
                >
                  Regenerate
                </button>
              )}
            </div>
            {isAdmin && (
              <p className={styles.hint}>
                Drag a player onto another player to swap them, or drag to an empty area of a team to move them.
                {playerPool.length > 0 && ' Use Replace to swap a player with someone from the pool.'}
                {' Use Add player on a team to bring in someone who is not on any team yet (from the roster or pool).'}
              </p>
            )}
            <div className={styles.shareBox}>
              <label className={styles.label}>Share this link</label>
              <div className={styles.shareRow}>
                <input readOnly value={shareUrl} className={styles.input} />
                <button
                  className={styles.btn}
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                >
                  Copy
                </button>
              </div>
              <p className={styles.meta}>Link generated on {new Date().toLocaleDateString()} — unique URL for this session.</p>
            </div>
            <div className={styles.teamsGrid}>
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={[
                    styles.teamCard,
                    isAdmin && dragOverTeam === team.id && drag.current?.fromTeamId !== team.id
                      ? styles.teamCardOver
                      : '',
                  ].join(' ')}
                  onDragOver={isAdmin ? (e) => { e.preventDefault(); setDragOverTeam(team.id); } : undefined}
                  onDragLeave={isAdmin ? (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTeam(null); } : undefined}
                  onDrop={isAdmin ? (e) => { e.preventDefault(); handleDropOnTeam(team.id); } : undefined}
                >
                  <div className={styles.teamCardHeader}>
                    <h3 className={styles.teamName}>{team.name}</h3>
                    {isAdmin && (
                      <button
                        type="button"
                        className={styles.addTeamBtn}
                        onClick={() => setAddToTeamId(team.id)}
                      >
                        Add player
                      </button>
                    )}
                  </div>
                  <p className={styles.teamPoints}>
                    {team.players.reduce((s, p) => s + (p.points ?? 0), 0)} pts
                  </p>
                  <ul className={styles.teamList}>
                    {team.players.map((p) => (
                      <li
                        key={p.id}
                        className={[
                          styles.teamPlayer,
                          isAdmin && dragOverPlayer === p.id ? styles.teamPlayerOver : '',
                          p.paid ? styles.teamPlayerPaid : '',
                        ].join(' ')}
                        data-rank={p.ranking}
                        draggable={isAdmin}
                        onDragStart={isAdmin ? () => handleDragStart(p.id, team.id) : undefined}
                        onDragEnd={isAdmin ? handleDragEnd : undefined}
                        onDragOver={isAdmin ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOverPlayer(p.id); setDragOverTeam(null); } : undefined}
                        onDragLeave={isAdmin ? () => setDragOverPlayer(null) : undefined}
                        onDrop={isAdmin ? (e) => { e.preventDefault(); e.stopPropagation(); handleDropOnPlayer(p.id, team.id); } : undefined}
                      >
                        {isAdmin && <span className={styles.dragHandle} aria-hidden>⠿</span>}
                        {p.image ? <img src={p.image} alt="" className={styles.avatar} /> : <span className={styles.avatarPlaceholder} />}
                        <Link to={profilePathForSessionPlayer(p, players)} className={styles.playerNameCell}>{p.name}</Link>
                        <span className={styles.rank}>{p.ranking}</span>
                        {isAdmin ? (
                          <span className={styles.playerActions}>
                            {playerPool.length > 0 && (
                              <button
                                type="button"
                                className={styles.replaceBtn}
                                onClick={() => setReplaceTarget({ teamId: team.id, player: p })}
                                title="Replace with someone from the pool"
                              >
                                Replace
                              </button>
                            )}
                            <button
                              type="button"
                              className={p.paid ? styles.paidBtn : styles.unpaidBtn}
                              onClick={() => togglePaid(result.slug, team.id, p.id, !!p.paid)}
                              title={p.paid ? 'Mark as unpaid' : 'Mark as paid'}
                            >
                              {p.paid ? '✓ Paid' : 'Unpaid'}
                            </button>
                          </span>
                        ) : (
                          p.paid && <span className={styles.paidBadge}>Paid</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <a href={shareUrl} className={styles.viewLink}>Open shareable view →</a>
          </section>
        )}
        {history.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Past sessions</h2>
            <p className={styles.hint}>Open a session to mark players as paid.</p>
            <ul className={styles.historyList}>
              {history.map((s) => {
                const url = `/t/${s.slug}`;
                const playerCount = s.teams.reduce((n, t) => n + t.players.length, 0);
                const paidCount = s.teams.reduce((n, t) => n + t.players.filter((p) => p.paid).length, 0);
                return (
                  <li key={s.slug} className={styles.historyItem}>
                    <div className={styles.historyMeta}>
                      <span className={styles.historyDate}>{s.date}</span>
                      <span className={styles.historyStats}>
                        {s.teams.length} teams · {playerCount} players
                        {paidCount > 0
                          ? <span className={styles.historyPaid}> · {paidCount}/{playerCount} paid</span>
                          : <span className={styles.historyUnpaid}> · none paid</span>
                        }
                      </span>
                    </div>
                    <a href={url} className={styles.historyOpenBtn}>
                      Open session →
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
