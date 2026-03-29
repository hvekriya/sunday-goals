import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './PlayersPage.module.css';
import { adminHeaders } from '../lib/adminHeaders';
import { profilePathForRosterPlayer } from '../lib/playerProfilePath';
import { playerFlairLabel } from '../lib/playerFlair';
import PlayerAvatar from '../components/PlayerAvatar';
import CartoonPickerModal from '../components/CartoonPickerModal';

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
  const [pickerPlayer, setPickerPlayer] = useState(null);

  async function load() {
    setError('');
    try {
      const res = await fetch(`${API}/roster`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      if (!Array.isArray(data)) throw new Error('Unexpected roster response from server');
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
    setEditor({ id: null, name: '', ranking: 'Unranked', notes: '' });
  }

  function openEdit(p) {
    setEditor({
      id: p.id,
      name: p.name,
      ranking: p.ranking,
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
        <p className={styles.sub}>
          Cartoon faces use{' '}
          <a href="https://www.dicebear.com/" target="_blank" rel="noopener noreferrer">
            DiceBear
          </a>
          {' '}
          (SVG, curated styles). Anyone can pick a style or set optional <strong>face text</strong> to vary the look — no uploads. Admins edit name/rank with <strong>Edit</strong>.
        </p>
      </header>

      {pickerPlayer && (
        <CartoonPickerModal
          player={pickerPlayer}
          onClose={() => setPickerPlayer(null)}
          onSaved={() => {
            load();
          }}
        />
      )}

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
        <div className={styles.emptyRoster}>
          <p className={styles.muted}>
            No players returned for this app&apos;s Supabase project. The roster is empty in the database this server is using.
          </p>
          <p className={styles.muted}>
            If you already imported rows elsewhere, the usual causes are: the project root <code className={styles.code}>.env</code> points at a different Supabase project than the one you imported into; <code className={styles.code}>SUPABASE_SERVICE_ROLE_KEY</code> is missing or wrong; or the import never ran against <code className={styles.code}>public.players</code>. Check the Supabase Table Editor for <code className={styles.code}>players</code> in the same project as <code className={styles.code}>SUPABASE_URL</code>, and run <code className={styles.code}>npm run check:supabase</code> from the repo root to verify connectivity.
          </p>
          <p className={styles.muted}>Admins can add players with <strong>Add player</strong> above after logging in.</p>
        </div>
      )}

      {players && players.length > 0 && (
        <ul className={styles.grid}>
          {players.map((p) => (
            <li key={p.id} className={styles.card}>
              <Link to={profilePathForRosterPlayer(p)} className={styles.cardLink}>
                <PlayerAvatar
                  playerId={p.id}
                  avatarPick={p.avatar_pick}
                  avatarSeed={p.avatar_seed}
                  alt={p.name}
                  className={styles.avatar}
                />
                <div className={styles.cardBody}>
                  <span className={styles.pname}>{p.name}</span>
                  {isAdmin ? (
                    <span className={styles.prank} data-rank={p.ranking}>{p.ranking}</span>
                  ) : (
                    <span className={styles.playerFlair}>{playerFlairLabel(p.id)}</span>
                  )}
                </div>
              </Link>
              <button type="button" className={styles.cartoonPickBtn} onClick={() => setPickerPlayer(p)}>
                Change cartoon
              </button>
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
