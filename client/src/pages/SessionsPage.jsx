import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './SessionsPage.module.css';

const API = '/api';

export default function SessionsPage() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/sessions/browse?limit=50`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setSessions(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sessions</h1>
        <p className={styles.sub}>Open any day&apos;s teams. Share links work for everyone.</p>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {!sessions && !error && <p className={styles.muted}>Loading…</p>}

      {sessions && sessions.length === 0 && (
        <p className={styles.muted}>No sessions yet. Generate teams from the Balancer (admin).</p>
      )}

      {sessions && sessions.length > 0 && (
        <ul className={styles.list}>
          {sessions.map((s) => {
            const n = s.teams?.reduce((a, t) => a + (t.players?.length || 0), 0) || 0;
            return (
              <li key={s.slug} className={styles.item}>
                <div>
                  <span className={styles.date}>{s.date}</span>
                  <span className={styles.meta}>
                    {s.teams?.length || 0} teams · {n} players
                  </span>
                </div>
                <Link to={`/t/${s.slug}`} className={styles.link}>
                  View teams →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
