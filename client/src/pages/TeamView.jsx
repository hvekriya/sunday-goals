import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from './TeamView.module.css';
import { adminHeaders } from '../lib/adminHeaders';
import { profilePathForSessionPlayer } from '../lib/playerProfilePath';

const API = '/api';

export default function TeamView() {
  const { slug } = useParams();
  const [teams, setTeams] = useState(null);
  const [playerPool, setPlayerPool] = useState([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [replaceTarget, setReplaceTarget] = useState(null);
  const [addToTeamId, setAddToTeamId] = useState(null);

  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('isAdmin') === 'true');
  const [showUnlock, setShowUnlock] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [roster, setRoster] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/roster`);
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data)) setRoster(data);
      } catch {
        // optional for profile links
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchSession() {
      try {
        const res = await fetch(`${API}/teams/${slug}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Not found');
          return;
        }
        setTeams(data.teams.map((t) => ({ ...t, players: [...t.players] })));
        setPlayerPool(Array.isArray(data.player_pool) ? data.player_pool : []);
        setDate(data.date);
        setError('');
      } catch (e) {
        if (!cancelled) setError('Failed to load teams');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSession();
    return () => { cancelled = true; };
  }, [slug]);

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

  async function togglePaid(teamId, playerId, currentPaid) {
    const paid = !currentPaid;
    // optimistic update
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        return { ...t, players: t.players.map((p) => p.id === playerId ? { ...p, paid } : p) };
      })
    );
    try {
      const res = await fetch(`${API}/teams/${slug}/paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ teamId, playerId, paid }),
      });
      if (!res.ok) throw new Error();
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

  const RANK_POINTS = { S: 4, A: 3, B: 2, C: 1, Unranked: 0 };

  function rosterPlayersNotOnAnyTeam() {
    if (!roster?.length || !teams?.length) return [];
    const onTeam = new Set();
    for (const t of teams) {
      for (const p of t.players) onTeam.add(p.id);
    }
    return roster.filter((p) => !onTeam.has(p.id));
  }

  async function handleAddPlayerToTeam(teamId, rosterPlayer) {
    const snapshotTeams = teams.map((t) => ({ ...t, players: [...t.players] }));
    const snapshotPool = [...playerPool];

    const nextTeams = teams.map((t) => ({ ...t, players: [...t.players] }));
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

    setTeams(nextTeams);
    setPlayerPool(nextPool);

    try {
      const res = await fetch(`${API}/teams/${slug}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ teams: nextTeams, playerPool: nextPool }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTeams(snapshotTeams);
      setPlayerPool(snapshotPool);
    }
    setAddToTeamId(null);
  }

  async function handleReplaceWith(teamId, outPlayer, inPlayer) {
    const nextTeams = teams.map((t) => ({ ...t, players: [...t.players] }));
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
    const nextPool = playerPool.filter((p) => p.id !== inPlayer.id);
    nextPool.push(backToPool);

    setTeams(nextTeams);
    setPlayerPool(nextPool);

    try {
      await fetch(`${API}/teams/${slug}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ teams: nextTeams, playerPool: nextPool }),
      });
    } catch {
      // revert on failure
      setTeams(teams);
      setPlayerPool(playerPool);
    }
    setReplaceTarget(null);
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}` : '';

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading teams…</div>
      </div>
    );
  }

  if (error || !teams) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <p>{error || 'Session not found'}</p>
          <Link to="/">← Back to Team Balancer</Link>
        </div>
      </div>
    );
  }

  const totalPlayers = teams.reduce((n, t) => n + t.players.length, 0);
  const paidCount = teams.reduce((n, t) => n + t.players.filter((p) => p.paid).length, 0);

  const playersAvailableToAdd = addToTeamId ? rosterPlayersNotOnAnyTeam() : [];

  return (
    <div className={styles.page}>

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
              Add player to {teams.find((t) => t.id === addToTeamId)?.name ?? 'team'}
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
        <div className={styles.topLinks}>
          <Link to="/" className={styles.back}>← Balancer</Link>
          <Link to="/sessions" className={styles.back}>Sessions</Link>
          <Link to="/pay" className={styles.back}>Pay</Link>
        </div>
        <h1 className={styles.title}>Teams — {date}</h1>
        <div className={styles.headerMeta}>
          <span className={styles.paidSummary}>{paidCount} / {totalPlayers} paid</span>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => navigator.clipboard.writeText(shareUrl)}
          >
            Copy link
          </button>
          {isAdmin ? (
            <button
              type="button"
              className={styles.adminBtn}
              onClick={() => {
                sessionStorage.removeItem('isAdmin');
                sessionStorage.removeItem('adminPassword');
                setIsAdmin(false);
              }}
            >
              Admin — lock
            </button>
          ) : (
            <button type="button" className={styles.adminBtn} onClick={() => setShowUnlock(true)}>
              Admin login
            </button>
          )}
        </div>
      </header>

      <div className={styles.teamsGrid}>
        {teams.map((team) => (
          <div key={team.id} className={styles.teamCard}>
            <div className={styles.teamCardHeader}>
              <h2 className={styles.teamName}>{team.name}</h2>
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
            <ul className={styles.teamList}>
              {team.players.map((p) => (
                <li
                  key={p.id}
                  className={[styles.teamPlayer, p.paid ? styles.teamPlayerPaid : ''].join(' ')}
                >
                  {p.image ? (
                    <img src={p.image} alt="" className={styles.avatar} />
                  ) : (
                    <span className={styles.avatarPlaceholder} />
                  )}
                  <Link to={profilePathForSessionPlayer(p, roster)} className={styles.playerName}>{p.name}</Link>
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
                        onClick={() => togglePaid(team.id, p.id, !!p.paid)}
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
    </div>
  );
}
