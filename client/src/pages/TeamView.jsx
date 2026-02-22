import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from './TeamView.module.css';

const API = '/api';

export default function TeamView() {
  const { slug } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchSession() {
      try {
        const res = await fetch(`${API}/teams/${slug}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Not found');
          setSession(null);
          return;
        }
        setSession(data);
        setError('');
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load teams');
          setSession(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSession();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading teams…</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <p>{error || 'Session not found'}</p>
          <Link to="/">← Back to Team Balancer</Link>
        </div>
      </div>
    );
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}` : '';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Today&apos;s teams</h1>
        <p className={styles.date}>Generated {session.date} — share this link: <strong className={styles.url}>{shareUrl}</strong></p>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={() => navigator.clipboard.writeText(shareUrl)}
        >
          Copy link
        </button>
      </header>

      <div className={styles.teamsGrid}>
        {session.teams.map((team) => (
          <div key={team.id} className={styles.teamCard}>
            <h2 className={styles.teamName}>{team.name}</h2>
            <ul className={styles.teamList}>
              {team.players.map((p) => (
                <li key={p.id} className={styles.teamPlayer}>
                  {p.image ? (
                    <img src={p.image} alt="" className={styles.avatar} />
                  ) : (
                    <span className={styles.avatarPlaceholder} />
                  )}
                  <span className={styles.playerName}>{p.name}</span>
                  {p.paid && <span className={styles.paidBadge}>Paid</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
