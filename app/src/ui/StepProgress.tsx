import styles from './StepProgress.module.css';

export interface StepProgressProps {
  /** 1-based current step. */
  current: number;
  total: number;
  /** Also print the text ("2 of 5") next to the dots. The header usually prints it in the running head instead. */
  showText?: boolean;
  className?: string;
}

/** Step dots (done = blue dot, current = blue pill, to do = lilac dot) with an "n of N" text alternative. */
export function StepProgress({ current, total, showText, className }: StepProgressProps) {
  const text = `${current} of ${total}`;
  return (
    <span className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')} data-testid="step-progress">
      {showText ? <span className={styles.text}>{text}</span> : null}
      <span className={styles.dots} role="img" aria-label={`Step ${text}`}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const cls = n < current ? styles.done : n === current ? styles.on : '';
          return <i key={n} className={cls} />;
        })}
      </span>
    </span>
  );
}
