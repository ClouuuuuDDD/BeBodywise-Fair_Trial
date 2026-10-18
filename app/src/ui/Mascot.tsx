import type { CSSProperties } from 'react';
import { MASCOTS, artUrl, type MascotId } from './art';
import styles from './Mascot.module.css';

export interface MascotProps {
  /** Which product character (art manifest id, e.g. "rollon", "toner", "rollon-worried"). */
  id: MascotId;
  /** CSS width in px. Height follows the art's crop aspect, so there is no layout shift. Default 82. */
  size?: number;
  /** Soft grayscale, as for unselected shelf chips or kept-apart products. */
  muted?: boolean;
  /** Retired: grayscale, slightly faded; the filter animates over 600ms (150ms with reduced motion). */
  retired?: boolean;
  /** Play the select bounce once (1 > 1.08 > 1, 250ms) each time this flips to true. */
  bounce?: boolean;
  /** Alt text. Omit for the art's default; pass "" when the text beside it already says the same. */
  alt?: string;
  /** Use the small thumbnail file (96 px wide); chosen automatically at sizes up to 48. */
  thumb?: boolean;
  className?: string;
  style?: CSSProperties;
  loading?: 'eager' | 'lazy';
}

/** Product character image by id, fixed width and height, 1x/2x WebP. */
export function Mascot({
  id,
  size = 82,
  muted,
  retired,
  bounce,
  alt,
  thumb,
  className,
  style,
  loading,
}: MascotProps) {
  const m = MASCOTS[id];
  const height = Math.round((size * m.h) / m.w);
  const useThumb = thumb ?? size <= 48;
  const src = useThumb ? artUrl(`thumb/${id}.webp`) : artUrl(`${id}@1x.webp`);
  const srcSet = useThumb ? undefined : `${artUrl(`${id}@1x.webp`)} 1x, ${artUrl(`${id}@2x.webp`)} 2x`;
  const cls = [
    styles.mascot,
    muted ? styles.muted : '',
    retired ? styles.retired : '',
    bounce ? styles.bounce : '',
    size >= 90 ? styles.big : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <img
      className={cls}
      src={src}
      srcSet={srcSet}
      width={size}
      height={height}
      alt={alt ?? m.alt}
      loading={loading}
      decoding="async"
      draggable={false}
      style={{ ...style, '--art-w': `${size}px` } as CSSProperties}
    />
  );
}
