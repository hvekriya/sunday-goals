import styles from './PlayerAvatar.module.css';
import { hueForString, initialsFromName } from '../lib/playerInitials';

/**
 * Initials badge derived from player name (e.g. "Haresh V" → HV).
 * @param {string} props.name — display name (falls back to alt)
 * @param {string} [props.playerId] — used for stable background hue
 * @param {string} props.className — often page `styles.avatar` / `styles.hero` for size
 * @param {string} [props.alt]
 * @param {'list' | 'hero'} [props.variant]
 */
export default function PlayerAvatar({
  name,
  playerId,
  className = '',
  alt = '',
  variant = 'list',
}) {
  const label = String(name || alt || '').trim();
  const initials = initialsFromName(label);
  const hue = hueForString(playerId || label || alt);
  const sizeMod = variant === 'hero' ? styles.hero : styles.list;

  return (
    <span
      className={`${styles.root} ${sizeMod} ${className}`.trim()}
      style={{ '--avatar-hue': String(hue) }}
      role="img"
      aria-label={label || initials}
    >
      {initials}
    </span>
  );
}
