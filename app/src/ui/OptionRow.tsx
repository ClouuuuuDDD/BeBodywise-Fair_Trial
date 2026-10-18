import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from './useReducedMotion';
import styles from './OptionRow.module.css';

export interface OptionRowProps {
  /** The stored answer value. Also drives data-testid="option-<value>". */
  value: string;
  /** Visible label. */
  label: ReactNode;
  /** Controlled selected state (a returning user sees her stored answer selected). */
  selected?: boolean;
  /**
   * Called with `value` after the select bounce (250ms, 150ms with reduced motion). This is the
   * "advances on tap" hook: navigate or store the answer here.
   */
  onSelect: (value: string) => void;
  /** Row (default, 62 px, radio dot, label left) or segment (centred label, no radio, for short scales like Mild / Bothering me / Painful). */
  variant?: 'row' | 'segment';
  /** Optional art at the right edge, e.g. <Mascot id="razor" size={44} alt="" />. */
  right?: ReactNode;
  /** 0-3 filled dots at the right, the shade question's severity meter. */
  meter?: 0 | 1 | 2 | 3;
  /** Override the delay before onSelect fires (ms). Use 0 for no bounce wait. */
  advanceDelay?: number;
  disabled?: boolean;
}

/** One choice: full-width white card, advances on tap. Wrap a set in <OptionGroup>. */
export function OptionRow({
  value,
  label,
  selected = false,
  onSelect,
  variant = 'row',
  right,
  meter,
  advanceDelay,
  disabled,
}: OptionRowProps) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const delay = advanceDelay ?? (reduced ? 150 : 250);
  const on = selected || pressed;

  function handleClick() {
    if (disabled || pressed) return;
    setPressed(true);
    timer.current = window.setTimeout(() => {
      setPressed(false);
      onSelect(value);
    }, delay);
  }

  const cls = [styles.opt, variant === 'segment' ? styles.segment : '', on ? styles.on : '', pressed ? styles.pop : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      aria-pressed={on}
      disabled={disabled}
      data-testid={`option-${value}`}
      onClick={handleClick}
    >
      {variant === 'row' ? <span className={styles.rad} aria-hidden="true" /> : null}
      <span className={styles.label}>{label}</span>
      {meter !== undefined ? (
        <span className={styles.steps} aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <i key={n} className={n <= meter ? styles.f : ''} />
          ))}
        </span>
      ) : null}
      {right ? <span className={styles.right}>{right}</span> : null}
    </button>
  );
}

export interface OptionGroupProps {
  /** Accessible name of the question, e.g. the screen title text. */
  label: string;
  children: ReactNode;
  /** Segment layout: equal columns instead of a stack. */
  columns?: 2 | 3;
}

/** Stack (12 px gap) or grid of OptionRows, announced as one group. */
export function OptionGroup({ label, children, columns }: OptionGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={columns ? styles.grid : styles.stack}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {children}
    </div>
  );
}
