import type { ReactNode } from 'react';
import { Mascot } from './Mascot';
import { ResultCard, CornerRibbon } from './ResultCard';
import { TimelineBar } from './TimelineBar';
import type { MascotId } from './art';
import styles from './TrialCard.module.css';

export interface TrialCardProps {
  /** Use-day number, shown huge ("23"). */
  day: number;
  total?: number;
  /** Name plate text. Default "On trial". */
  plate?: string;
  /** Judge-by chip text, e.g. "Judge on 12 Dec". */
  judgeBy?: string;
  paused?: number[];
  reaction?: number[];
  /** Roll-on art: "rollon" (default) or "rollon-sleepy" for the refill state. */
  mascot?: MascotId;
  /** Replaces the "/ 56 days" suffix. */
  suffix?: ReactNode;
}

/** The roll-on's collectible card: ribbon, mascot, "On trial", huge Day numeral, judge-by chip, use-day dots. */
export function TrialCard({ day, total = 56, plate = 'On trial', judgeBy, paused, reaction, mascot = 'rollon', suffix }: TrialCardProps) {
  return (
    <ResultCard ribbon={<CornerRibbon offset={20}>{null}</CornerRibbon>} data-testid="trial-card">
      <div className={styles.top}>
        <Mascot id={mascot} size={104} alt="Roll-on" />
        <div className={styles.info}>
          <span className={styles.plate}>{plate}</span>
          <p className={styles.numeral}>
            {day}
            <span className={styles.suffix}>{suffix ?? ` / ${total} days`}</span>
          </p>
          {judgeBy ? <span className={styles.judge}>{judgeBy}</span> : null}
        </div>
      </div>
      <div className={styles.timeline}>
        <TimelineBar day={day} total={total} paused={paused} reaction={reaction} legend />
      </div>
    </ResultCard>
  );
}
