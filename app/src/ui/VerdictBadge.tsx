import type { CSSProperties, ReactNode } from 'react';
import { DrMehr } from './DrMehr';
import { Icon } from './Icon';
import { Mascot } from './Mascot';
import { VERDICT_HEADLINES, type VerdictOutcome } from './verdictCopy';
import styles from './VerdictBadge.module.css';

export interface VerdictBadgeProps {
  outcome: VerdictOutcome;
  /** Override the big word (copy.md v.*.title). Defaults to VERDICT_HEADLINES[outcome]. */
  headline?: string;
  /** The one plain line under the headline, e.g. "Keep going. Check again in 8 weeks." */
  sub?: ReactNode;
  /** The reasons: a few <VerdictReason> rows. */
  children?: ReactNode;
}

/**
 * The verdict scene and headline. Working: teal rosette behind the celebrating roll-on. Not yet: sky
 * rosette, sleepy roll-on. Can't call it: lilac rosette, Dr. Mehr with a phone. Not for you: the
 * roll-on retires in grayscale (over 600ms), Dr. Mehr with open palms, no rosette, no sparkles. See a
 * doctor: plain rose stage, calm Dr. Mehr. Bleeds to the screen edges; use AppShell `overlayHeader`
 * and `ground="plain"` so the header sits on the stage.
 */
export function VerdictBadge({ outcome, headline, sub, children }: VerdictBadgeProps) {
  const rosette = outcome === 'working' || outcome === 'not-yet' || outcome === 'cant-call';
  const centred = rosette;
  return (
    <section className={[styles.verdict, styles[outcome]].join(' ')} data-testid="verdict-badge" data-outcome={outcome}>
      <div className={[styles.hero, rosette ? styles.heroRosette : styles.heroPlain].join(' ')}>
        {rosette ? (
          <>
            <span className={styles.tailL} aria-hidden="true" />
            <span className={styles.tailR} aria-hidden="true" />
            <span className={styles.ros} aria-hidden="true" />
          </>
        ) : null}
        {outcome === 'working' ? (
          <Mascot id="rollon-celebrate" size={170} alt="Roll-on celebrating" className={styles.artMascot} loading="eager" />
        ) : null}
        {outcome === 'not-yet' ? (
          <Mascot id="rollon-sleepy" size={140} alt="Roll-on, sleepy" className={styles.artMascot} loading="eager" />
        ) : null}
        {outcome === 'cant-call' ? (
          <DrMehr pose="camera" size={112} className={styles.artMascot} loading="eager" />
        ) : null}
        {outcome === 'not-for-you' ? (
          <>
            <Mascot id="rollon-goodbye" size={170} retired alt="Roll-on, retired, waving goodbye" className={styles.retire} loading="eager" />
            <DrMehr pose="open-palms" size={170} className={styles.mehrRight} loading="eager" />
          </>
        ) : null}
        {outcome === 'see-doctor' ? <DrMehr pose="concerned" size={140} className={styles.mehrCentre} loading="eager" /> : null}
      </div>
      <h1 data-fit="keep" className={[styles.headline, centred ? styles.headCentred : styles.headLeft].join(' ')}>
        {headline ?? VERDICT_HEADLINES[outcome]}
      </h1>
      {sub ? <p className={[styles.sub, centred ? styles.subCentred : ''].filter(Boolean).join(' ')}>{sub}</p> : null}
      {children ? <div className={styles.reasons}>{children}</div> : null}
    </section>
  );
}

export interface VerdictReasonProps {
  children: ReactNode;
  /** "tick" for Working (a mint disc with a check), "dash" for the other outcomes (a grey dash, not a cross: nobody failed). */
  mark?: 'tick' | 'dash';
  style?: CSSProperties;
}

/** One reason under the verdict: icon, then a plain line. */
export function VerdictReason({ children, mark = 'tick', style }: VerdictReasonProps) {
  return (
    <div className={styles.why} style={style}>
      {mark === 'tick' ? (
        <span className={styles.tick}>
          <Icon name="check" size={14} strokeWidth={3.2} />
        </span>
      ) : (
        <span className={styles.dash} aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}
