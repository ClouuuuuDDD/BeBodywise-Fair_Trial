import { PLACEHOLDER_RULES_LABEL } from '../engine/config';
import styles from './PlaceholderRulesNote.module.css';

/**
 * "Placeholder rules, to be signed by a dermatologist." The exact binding line (engine/config.ts).
 * Every screen that shows rule output (05, 05b, 07, 13, 17, 18) carries it.
 */
export function PlaceholderRulesNote({ align = 'left' }: { align?: 'left' | 'center' }) {
  return (
    <p className={[styles.note, align === 'center' ? styles.center : ''].filter(Boolean).join(' ')} data-testid="placeholder-rules">
      {PLACEHOLDER_RULES_LABEL}
    </p>
  );
}
