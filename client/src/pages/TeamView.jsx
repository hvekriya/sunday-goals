import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from './TeamView.module.css';

const API = '/api';

export default function TeamView() {
  const { slug } = useParams();
  const [teams, setTeams] = useState(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('isAdmin') === 'true');
  const [showUnlock, setShowUnlock] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

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
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className={styles.page}>

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
        <Link to="/" className={styles.back}>← Back to Balancer</Link>
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
              onClick={() => { sessionStorage.removeItem('isAdmin'); setIsAdmin(false); }}
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
            <h2 className={styles.teamName}>{team.name}</h2>
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
                  <span className={styles.playerName}>{p.name}</span>
                  {isAdmin ? (
                    <button
                      type="button"
                      className={p.paid ? styles.paidBtn : styles.unpaidBtn}
                      onClick={() => togglePaid(team.id, p.id, !!p.paid)}
                      title={p.paid ? 'Mark as unpaid' : 'Mark as paid'}
                    >
                      {p.paid ? '✓ Paid' : 'Unpaid'}
                    </button>
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
