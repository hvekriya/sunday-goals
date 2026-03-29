import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import styles from './PlayerProfilePage.module.css';

const API = '/api';

export default function PlayerProfilePage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin] = useState(() => sessionStorage.getItem('isAdmin') === 'true');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = encodeURIComponent(slug || '');
        const res = await fetch(`${API}/roster/${key}/history`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || 'Not found');
        setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (error || !data?.player) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{error || 'Player not found'}</div>
        <Link to="/players">← Players</Link>
      </div>
    );
  }

  const { player, appearances } = data;

  return (
    <div className={styles.page}>
      <Link to="/players" className={styles.back}>← Players</Link>

      <header className={styles.header}>
        {player.image ? (
          <img src={player.image} alt="" className={styles.hero} />
        ) : (
          <span className={styles.heroPh} />
        )}
        <div>
          <h1 className={styles.title}>{player.name}</h1>
          {isAdmin && (
            <span className={styles.rank} data-rank={player.ranking}>{player.ranking}</span>
          )}
          {player.notes && <p className={styles.notes}>{player.notes}</p>}
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.h2}>Session history</h2>
        <p className={styles.hint}>
          Includes games matched by roster id (UUID) and older sessions matched by the same name (e.g. sheet-era ids like p-1).
        </p>
        {!appearances?.length && (
          <p className={styles.muted}>No sessions yet, or no name/id overlap with saved teams.</p>
        )}
        {appearances?.length > 0 && (
          <ul className={styles.list}>
            {appearances.map((row, i) => (
              <li key={`${row.slug}-${row.teamId}-${i}`} className={styles.row}>
                <div>
                  <span className={styles.date}>{row.date}</span>
                  <span className={styles.team}>{row.teamName}</span>
                  {row.legacyNameMatch && (
                    <span className={styles.legacyTag} title="Matched by name on an older session">pre-roster</span>
                  )}
                </div>
                <div className={styles.rowMeta}>
                  {row.paid ? <span className={styles.paid}>Paid</span> : <span className={styles.unpaid}>Unpaid</span>}
                  <Link to={`/t/${row.slug}`} className={styles.slink}>View session →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
