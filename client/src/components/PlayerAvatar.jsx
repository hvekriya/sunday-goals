import { useEffect, useMemo, useState } from 'react';
import { cartoonUrlForPlayer } from '../lib/cartoonAvatarUrl';

const BLANK_IMG =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * DiceBear cartoon from roster avatar_pick / avatar_seed or auto pick from player id.
 * @param {string} props.playerId
 * @param {number | null | undefined} props.avatarPick
 * @param {string | null | undefined} props.avatarSeed
 * @param {string} props.className
 * @param {string} [props.alt]
 * @param {'list' | 'hero'} [props.variant]
 */
export default function PlayerAvatar({
  playerId,
  avatarPick,
  avatarSeed,
  className = '',
  alt = '',
  variant = 'list',
}) {
  const key = playerId ?? 'unknown';
  const sizePx = variant === 'hero' ? 200 : 96;

  const primary = useMemo(
    () => cartoonUrlForPlayer(key, avatarPick, avatarSeed, sizePx),
    [key, avatarPick, avatarSeed, sizePx],
  );

  const fallback = useMemo(
    () => cartoonUrlForPlayer(`${key}-fb`, null, null, sizePx),
    [key, sizePx],
  );

  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [primary]);

  const effectiveSrc = useFallback ? fallback : primary;

  return (
    <img
      key={effectiveSrc}
      src={effectiveSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        if (!useFallback) {
          setUseFallback(true);
          return;
        }
        e.currentTarget.onerror = null;
        e.currentTarget.src = BLANK_IMG;
      }}
    />
  );
}
