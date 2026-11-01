import { PLACEHOLDER_RULES_LABEL } from '../engine/config';
import styles from './PlaceholderRulesNote.module.css';

/**
 * "Placeholder rules, to be signed by a dermatologist." The exact binding line (engine/config.ts).
 * Every screen that shows rule output (05, 05b, 07, 13, 17, 18) carries it.
 */
export function PlaceholderRulesNote({ align = 'left', text = PLACEHOLDER_RULES_LABEL }: { align?: 'left' | 'center'; text?: string }) {
  return (
    <p className={[styles.note, align === 'center' ? styles.center : ''].filter(Boolean).join(' ')} data-testid="placeholder-rules">
      {text}
    </p>
  );
}
