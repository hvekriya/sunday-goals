import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './PlayersPage.module.css';
import { adminHeaders } from '../lib/adminHeaders';
import { profilePathForRosterPlayer } from '../lib/playerProfilePath';

const API = '/api';
const RANKS = ['S', 'A', 'B', 'C', 'Unranked'];

export default function PlayersPage() {
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState('');
  const [isAdmin] = useState(() => sessionStorage.getItem('isAdmin') === 'true');
  const [showUnlock, setShowUnlock] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editor, setEditor] = useState(null);

  async function load() {
    setError('');
    try {
      const res = await fetch(`${API}/roster`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setPlayers(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUnlock(e) {
    e.preventDefault();
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
        setShowUnlock(false);
        setAdminPassword('');
        window.location.reload();
      } else {
        setAdminError('Wrong password.');
      }
    } catch {
      setAdminError('Could not reach server.');
    }
  }

  function openNew() {
    setEditor({ id: null, name: '', ranking: 'Unranked', image: '', notes: '' });
  }

  function openEdit(p) {
    setEditor({
      id: p.id,
      name: p.name,
      ranking: p.ranking,
      image: p.image || '',
      notes: p.notes || '',
    });
  }

  async function saveEditor() {
    if (!editor?.name?.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify({
        name: editor.name.trim(),
        ranking: editor.ranking,
        image: editor.image.trim() || null,
        notes: editor.notes.trim() || null,
      });
      const url = editor.id ? `${API}/roster/${editor.id}` : `${API}/roster`;
      const res = await fetch(url, {
        method: editor.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setEditor(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removePlayer(id) {
    if (!window.confirm('Remove this player from the roster? Past sessions still show their name in history.')) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/roster/${id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      {showUnlock && (
        <div className={styles.modalOverlay} onClick={() => setShowUnlock(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Admin login</h2>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                className={styles.input}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Admin password"
                autoFocus
              />
              {adminError && <p className={styles.modalError}>{adminError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btn} onClick={() => setShowUnlock(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Unlock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>Players</h1>
        <p className={styles.sub}>
          Player profiles. Anyone can browse; rank badges are only shown when you use admin login. Only admins can edit.
        </p>
        <div className={styles.toolbar}>
          {isAdmin ? (
            <>
              <button type="button" className={styles.btnPrimary} onClick={openNew}>
                Add player
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  sessionStorage.removeItem('isAdmin');
                  sessionStorage.removeItem('adminPassword');
                  window.location.reload();
                }}
              >
                Lock admin
              </button>
            </>
          ) : (
            <button type="button" className={styles.btn} onClick={() => setShowUnlock(true)}>
              Admin login
            </button>
          )}
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {editor && (
        <div className={styles.modalOverlay} onClick={() => !saving && setEditor(null)}>
          <div className={styles.editor} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editor.id ? 'Edit player' : 'New player'}</h2>
            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            <label className={styles.label}>
              Rank
              <select
                className={styles.input}
                value={editor.ranking}
                onChange={(e) => setEditor({ ...editor, ranking: e.target.value })}
              >
                {RANKS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              Avatar URL
              <input
                className={styles.input}
                value={editor.image}
                onChange={(e) => setEditor({ ...editor, image: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <label className={styles.label}>
              Notes (admin / bio)
              <textarea
                className={styles.textarea}
                value={editor.notes}
                onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
                rows={3}
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} disabled={saving} onClick={() => setEditor(null)}>Cancel</button>
              <button type="button" className={styles.btnPrimary} disabled={saving} onClick={saveEditor}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!players && !error && <p className={styles.muted}>Loading…</p>}

      {players && players.length === 0 && (
        <p className={styles.muted}>
          No players in the database yet. Admins can add players here. To bulk-import from a Google Sheet once, run <code className={styles.code}>npm run migrate:roster</code> from the project root, then delete <code className={styles.code}>scripts/migrate-players-from-sheet.mjs</code> and the <code className={styles.code}>migrate:roster</code> entry in <code className={styles.code}>package.json</code>.
        </p>
      )}

      {players && players.length > 0 && (
        <ul className={styles.grid}>
          {players.map((p) => (
            <li key={p.id} className={styles.card}>
              <Link to={profilePathForRosterPlayer(p)} className={styles.cardLink}>
                {p.image ? <img src={p.image} alt="" className={styles.avatar} /> : <span className={styles.avatarPh} />}
                <div className={styles.cardBody}>
                  <span className={styles.pname}>{p.name}</span>
                  {isAdmin && (
                    <span className={styles.prank} data-rank={p.ranking}>{p.ranking}</span>
                  )}
                </div>
              </Link>
              {isAdmin && (
                <div className={styles.cardActions}>
                  <button type="button" className={styles.linkBtn} onClick={() => openEdit(p)}>Edit</button>
                  <button type="button" className={styles.dangerBtn} onClick={() => removePlayer(p.id)}>Remove</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
