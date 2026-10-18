import type { PhotoMoment, PhotoRegion } from '../../../contracts';
import styles from './examplePhoto.module.css';

/**
 * Example mode only: a flat, stylised stand-in for a skin photo (no real person, no real skin). A soft skin-tone
 * area in the oval guide, the white card in the corner, and an "Example photo" label. Drawn in code; it is never
 * stored in the vault and never used for her own trial.
 */
const INNER_ARM = '#C99A7C';
const DAY0_UNDERARM = '#A9715A';
// Slightly lighter than Day 0, only on the Working path. Otherwise the verdict-day underarm matches Day 0.
const LIGHTER_UNDERARM = '#BE8B72';

export interface ExamplePhotoProps {
  region: PhotoRegion;
  moment: PhotoMoment;
  /** True on the Working path: the verdict-day underarm is a little lighter than Day 0. */
  lighter?: boolean;
  /** Accessible name. Blind pick passes "Photo A" / "Photo B" so nothing says which is which. */
  alt?: string;
  /** Smaller label for thumbnails. */
  compact?: boolean;
  /** Fill the parent box (the staged camera) instead of the parent's own size. */
  fill?: boolean;
}

export function ExamplePhoto({ region, moment, lighter = false, alt = 'Example photo', compact = false, fill = false }: ExamplePhotoProps) {
  const tone = region === 'inner-arm' ? INNER_ARM : moment === 'verdict' && lighter ? LIGHTER_UNDERARM : DAY0_UNDERARM;
  return (
    <span className={`${styles.wrap} ${fill ? styles.fill : ''}`} data-testid="example-photo">
      <svg viewBox="0 0 300 400" className={styles.svg} role="img" aria-label={alt} preserveAspectRatio="xMidYMid slice">
        <rect width="300" height="400" fill="#E9D8CC" />
        <ellipse cx="150" cy="190" rx="112" ry="150" fill={tone} />
        {region === 'underarm' ? (
          <path d="M70 230 Q150 300 230 230" fill="none" stroke="#000" strokeOpacity="0.08" strokeWidth="10" strokeLinecap="round" />
        ) : (
          <path d="M60 150 Q150 120 240 150" fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="16" strokeLinecap="round" />
        )}
        <ellipse cx="150" cy="190" rx="112" ry="150" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="4" strokeDasharray="10 8" />
        <rect x="212" y="318" width="70" height="50" rx="6" fill="#fff" stroke="#d9d4e4" strokeWidth="2" />
      </svg>
      <span className={`${styles.label} ${compact ? styles.compact : ''}`} data-testid="example-photo-label">
        Example photo
      </span>
    </span>
  );
}
