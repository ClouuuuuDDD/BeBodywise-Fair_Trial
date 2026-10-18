import styles from './TimelineBar.module.css';

export interface TimelineBarProps {
  /** Use-day the trial is on (1 to total). Dots up to here are filled. */
  day: number;
  /** Trial length in use-days. Default 56 (TRIAL_USE_DAYS). */
  total?: number;
  /** Use-days that were paused (small grey dots), e.g. 10-12 after a reaction on day 9. */
  paused?: number[];
  /** Use-days with a reaction (amber ring). */
  reaction?: number[];
  /** Print the Used / Paused / Reaction legend under the dots. */
  legend?: boolean;
  /** Dots per row. Default 28, so 56 days is two rows on a phone. */
  columns?: number;
}

/**
 * Day N of 56 as 56 small dots: used filled blue, paused small grey, reaction ringed amber, the rest
 * pale lilac. Never a streak count. Has a text alternative that reads the totals.
 */
export function TimelineBar({ day, total = 56, paused = [], reaction = [], legend, columns = 28 }: TimelineBarProps) {
  const pausedSet = new Set(paused);
  const reactionSet = new Set(reaction);
  const usedCount = Array.from({ length: Math.min(day, total) }, (_, i) => i + 1).filter((n) => !pausedSet.has(n)).length;
  const pausedCount = paused.filter((n) => n <= day).length;
  const reactionCount = reaction.filter((n) => n <= day).length;
  const aria =
    `Day ${day} of ${total}. Used ${usedCount} of ${Math.min(day, total)} days` +
    (pausedCount ? `, ${pausedCount} paused` : '') +
    (reactionCount ? `, ${reactionCount} with a reaction` : '') +
    '.';

  return (
    <div className={styles.wrap} data-testid="timeline">
      <div className={styles.dots} role="img" aria-label={aria} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          let cls = styles.future;
          if (reactionSet.has(n) && n <= day) cls = styles.reaction;
          else if (pausedSet.has(n) && n <= day) cls = styles.paused;
          else if (n <= day) cls = styles.used;
          return <span key={n} className={[styles.d, cls].join(' ')} />;
        })}
      </div>
      {legend ? (
        <div className={styles.legend} aria-hidden="true">
          <span>
            <i className={styles.keyUsed} />
            Used
          </span>
          <span>
            <i className={styles.keyPaused} />
            Paused
          </span>
          <span>
            <i className={styles.keyReaction} />
            Reaction
          </span>
        </div>
      ) : null}
    </div>
  );
}
