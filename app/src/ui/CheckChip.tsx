import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Mascot } from './Mascot';
import type { MascotId } from './art';
import styles from './CheckChip.module.css';

export interface CheckChipProps {
  /** Visible label. */
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * "pill" (default): symptom-style chip, 44 px, blue when on.
   * "card": shelf chip, a white card with the product's mascot thumbnail (40 px): grayscale when off,
   * hops and gains colour when on.
   */
  variant?: 'pill' | 'card';
  /** Mascot for the card variant. */
  mascot?: MascotId;
  /** Stored value for tests: data-testid="chip-<value>". */
  value?: string;
  disabled?: boolean;
  /** Compact pill (40 px) for inline asks. Still above 40 px; the row keeps a 44 px hit area through padding. */
  compact?: boolean;
}

/** One multi-select choice. Has a check mark when on, so colour is never the only cue. */
export function CheckChip({ label, checked, onChange, variant = 'pill', mascot, value, disabled, compact }: CheckChipProps) {
  const cls = [styles.chip, variant === 'card' ? styles.card : styles.pill, compact ? styles.compact : '', checked ? styles.on : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cls}
      disabled={disabled}
      data-testid={value ? `chip-${value}` : undefined}
      onClick={() => onChange(!checked)}
    >
      {variant === 'card' && mascot ? <Mascot id={mascot} size={40} alt="" muted={!checked} bounce={checked} /> : null}
      <span className={styles.text}>{label}</span>
      {checked ? <Icon name="check" size={16} className={styles.tick} /> : null}
    </button>
  );
}
