import { Children, type CSSProperties, type ReactNode } from 'react';
import { DR_MEHR_POSES, artUrl, type DrMehrPose } from './art';
import styles from './DrMehr.module.css';

export interface DrMehrProps {
  /** Pose name: wave, curious, clipboard, point, camera, calendar, concerned, proud, open-palms, avatar. */
  pose: DrMehrPose;
  /** CSS width in px (height follows the crop). Default: 44 for the avatar, the art's 1x size otherwise. */
  size?: number;
  /**
   * Speech bubble text. Passing it renders the "doctor bubble" row: Dr. Mehr, then a white bubble with
   * a squared tail corner. Pass an array for one-line-at-a-time reveals (no typewriter effect).
   */
  say?: ReactNode | ReactNode[];
  /** Alt text. Omit for the pose default; "" when the text beside her already says it. The avatar in a bubble is decorative by default. */
  alt?: string;
  /** Position her yourself (absolute overlaps of the grid are her signature), e.g. { position: 'absolute', right: -6, top: 64 }. */
  style?: CSSProperties;
  className?: string;
  loading?: 'eager' | 'lazy';
}

/** Dr. Mehr, the lead of the cast, by pose; optionally with her speech bubble. */
export function DrMehr({ pose, size, say, alt, style, className, loading }: DrMehrProps) {
  const p = DR_MEHR_POSES[pose];
  const isAvatar = pose === 'avatar';
  const width = size ?? (isAvatar ? 44 : p.w);
  const height = Math.round((width * p.h) / p.w);
  const hasSay = say !== undefined && say !== null && say !== false;
  const altText = alt ?? (hasSay && isAvatar ? '' : p.alt);
  const img = (
    <img
      className={[styles.img, isAvatar ? styles.avatar : '', width >= 90 ? styles.big : '', !hasSay ? (className ?? '') : ''].filter(Boolean).join(' ')}
      src={artUrl(`${p.file}@1x.webp`)}
      srcSet={`${artUrl(`${p.file}@1x.webp`)} 1x, ${artUrl(`${p.file}@2x.webp`)} 2x`}
      width={width}
      height={height}
      alt={altText}
      loading={loading}
      decoding="async"
      draggable={false}
      style={{ ...(hasSay ? undefined : style), '--art-w': `${width}px` } as CSSProperties}
    />
  );
  if (!hasSay) return img;

  const lines = Array.isArray(say) ? say : Children.toArray(say);
  return (
    <div className={[styles.row, className ?? ''].filter(Boolean).join(' ')} style={style} data-testid="doctor-bubble">
      {img}
      <div className={styles.bubble}>
        {lines.map((line, i) => (
          <span key={i} className={styles.line} style={{ animationDelay: `${120 + i * 160}ms` }}>
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
