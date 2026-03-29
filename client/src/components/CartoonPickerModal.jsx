import { useEffect, useMemo, useState } from 'react';
import {
  CARTOON_AVATAR_PRESETS,
  CARTOON_AVATAR_PRESET_COUNT,
  cartoonUrlForPlayer,
  defaultAvatarPickForPlayerId,
  diceBearCartoonSvgUrl,
  normalizeAvatarSeedForSave,
} from '../../../shared/cartoonPresets.js';
import styles from './CartoonPickerModal.module.css';

const API = '/api';

function PresetThumb({ style, seed, size }) {
  const primary = diceBearCartoonSvgUrl(style, seed, size);
  const [src, setSrc] = useState(primary);
  useEffect(() => {
    setSrc(primary);
  }, [primary]);
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      onError={() => setSrc(diceBearCartoonSvgUrl('lorelei', `fallback-${style}`, size))}
    />
  );
}

export default function CartoonPickerModal({ player, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draftSeed, setDraftSeed] = useState('');

  useEffect(() => {
    setDraftSeed(player?.avatar_seed ?? '');
  }, [player?.id, player?.avatar_seed]);

  const previewUrl = useMemo(() => {
    if (!player?.id) return '';
    let seed = null;
    try {
      const t = draftSeed.trim();
      if (t) seed = normalizeAvatarSeedForSave(t);
    } catch {
      seed =
        player.avatar_seed != null && String(player.avatar_seed).trim()
          ? String(player.avatar_seed).trim()
          : null;
    }
    return cartoonUrlForPlayer(player.id, player.avatar_pick, seed, 112);
  }, [player, draftSeed]);

  if (!player) return null;

  const defaultIdx = defaultAvatarPickForPlayerId(player.id);

  function seedPayloadOrThrow() {
    const t = draftSeed.trim();
    if (!t) return null;
    return normalizeAvatarSeedForSave(t);
  }

  async function patchCartoon(body) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/roster/${player.id}/cartoon`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePick(pick) {
    let seedPayload;
    try {
      seedPayload = seedPayloadOrThrow();
    } catch (e) {
      setError(e.message);
      return;
    }
    await patchCartoon({ pick, seed: seedPayload });
  }

  async function randomPick() {
    setDraftSeed('');
    const r = Math.floor(Math.random() * CARTOON_AVATAR_PRESET_COUNT);
    await patchCartoon({ pick: r, seed: null });
  }

  async function applySeedOnly() {
    let seedPayload;
    try {
      seedPayload = seedPayloadOrThrow();
    } catch (e) {
      setError(e.message);
      return;
    }
    await patchCartoon({ seed: seedPayload });
  }

  function isCurrentCell(index) {
    const saved = player.avatar_pick;
    if (saved != null && Number.isInteger(saved)) {
      return index === saved;
    }
    return index === defaultIdx;
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="cartoon-picker-title"
      >
        <h2 id="cartoon-picker-title" className={styles.title}>
          Choose cartoon for {player.name}
        </h2>
        <p className={styles.hint}>
          Pick a style below (SVG, fast loading). Optionally set a <strong>face text</strong> — DiceBear uses it as a
          seed so you can tune the face while staying on the same art style. No image uploads.
        </p>

        <div className={styles.previewRow}>
          <img src={previewUrl} alt="" className={styles.previewImg} width={112} height={112} loading="eager" />
        </div>

        <label className={styles.seedLabel}>
          Face text (DiceBear seed, optional)
          <input
            type="text"
            className={styles.seedInput}
            value={draftSeed}
            onChange={(e) => setDraftSeed(e.target.value)}
            placeholder="e.g. your nickname or initials"
            maxLength={64}
            autoComplete="off"
          />
        </label>
        <div className={styles.seedActions}>
          <button type="button" className={styles.btn} onClick={applySeedOnly} disabled={saving}>
            Apply face text only
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setDraftSeed('')}
            disabled={saving}
          >
            Clear text
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.toolbar}>
          <button type="button" className={styles.btn} onClick={() => savePick(null)} disabled={saving}>
            Auto style (from id)
          </button>
          <button type="button" className={styles.btnPrimary} onClick={randomPick} disabled={saving}>
            Random style
          </button>
        </div>
        <div className={styles.grid}>
          {CARTOON_AVATAR_PRESETS.map((preset, index) => (
            <button
              key={`${preset.style}-${preset.seed}`}
              type="button"
              className={[styles.choice, isCurrentCell(index) ? styles.choiceCurrent : ''].join(' ')}
              onClick={() => savePick(index)}
              disabled={saving}
              title={`Style ${index + 1}`}
            >
              <PresetThumb style={preset.style} seed={preset.seed} size={72} />
            </button>
          ))}
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.btn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
