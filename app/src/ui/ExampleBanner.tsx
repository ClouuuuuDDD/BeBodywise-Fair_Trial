import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from './Sheet';
import styles from './ExampleBanner.module.css';

export interface JumpTarget {
  /** Jump key (copy of the example module's keys: check, day-0, day-9, day-23, day-40, day-56-working, ...). */
  key: string;
  /** Label, e.g. "Day 23". */
  label: string;
  /** Optional second line, e.g. "The quiet middle". */
  hint?: string;
}

export interface ExampleBannerProps {
  /** Moments to jump to. The "Jump to day" control opens a sheet listing them. */
  jumps?: JumpTarget[];
  /** Called with the chosen key. */
  onJump?: (key: string) => void;
  /** Without `jumps`, the button just calls this (the screen opens its own picker). */
  onJumpClick?: () => void;
  /** "Leave the example": route to leave to (default "/"). */
  leaveTo?: string;
  onLeave?: () => void;
}

/**
 * On every example screen: a butter "Example" tag, a "Jump to day" control and "Leave the example".
 * Sits above the header (AppShell `banner`). Keeps the real app and the example visibly apart.
 */
export function ExampleBanner({ jumps, onJump, onJumpClick, leaveTo = '/', onLeave }: ExampleBannerProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.bar} data-testid="example-banner">
      <span className={styles.tag} data-testid="example-tag">
        Example
      </span>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.jump}
          data-testid="example-jump"
          onClick={() => (jumps && jumps.length > 0 ? setOpen(true) : onJumpClick?.())}
        >
          Jump to day
        </button>
        <Link to={leaveTo} className={styles.leave} onClick={onLeave} data-testid="example-leave">
          Leave the example
        </Link>
      </div>
      {jumps && jumps.length > 0 ? (
        <Sheet open={open} onClose={() => setOpen(false)} title="Jump to day">
          <ul className={styles.list}>
            {jumps.map((j) => (
              <li key={j.key}>
                <button
                  type="button"
                  className={styles.item}
                  data-testid={`jump-${j.key}`}
                  onClick={() => {
                    setOpen(false);
                    onJump?.(j.key);
                  }}
                >
                  <span className={styles.itemLabel}>{j.label}</span>
                  {j.hint ? <span className={styles.itemHint}>{j.hint}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}
    </div>
  );
}
