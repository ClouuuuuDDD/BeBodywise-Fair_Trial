import { useState } from 'react';
import type { ISODate, Plan, ShelfItem } from '../../../contracts';
import { formatDayMonth, needsTrialChoice, openVariables } from '../../../engine';
import { retryPlanReview, setTrialChoice } from '../../../state/trial';
import { CheckChip, TextLink } from '../../../ui';
import { ACTION_LABEL, REVIEW_COPY } from '../../rightstart/components/reviewCopy';
import styles from './trial.module.css';

/** True when every flagged product has a pause-or-keep answer (Got it waits for this, spec 3.7). */
export function allChosen(shelf: ShelfItem[]): boolean {
  return shelf.filter(needsTrialChoice).every((i) => i.trialChoice !== undefined);
}

/** Spec 3.7: what to pause during the trial, her choice per product, and anything not checked yet. */
export function CleanTrialCard({ plan, judgeBy }: { plan: Plan; judgeBy?: ISODate }) {
  const flagged = plan.shelf.filter(needsTrialChoice);
  const unchecked = openVariables(plan.shelf, plan.trialProduct).filter((v) => v.why === 'unchecked');
  const [busy, setBusy] = useState<string | undefined>();
  if (flagged.length === 0 && unchecked.length === 0) return null;
  const until = judgeBy ? `Paused until ${formatDayMonth(judgeBy)}.` : 'Paused until your judge-by date.';

  return (
    <section className={styles.clean} aria-label="Your clean trial" data-testid="clean-trial">
      <h2 className={styles.stageTitle}>Your clean trial</h2>
      <p className={styles.stageBody}>Pausing these makes it clear whether the roll-on is what changed. Your call.</p>
      <ul className={styles.cleanList}>
        {flagged.map((i) => (
          <li key={i.id} className={styles.cleanRow} data-testid="clean-row">
            <p className={styles.cleanName}>
              <b>{i.product}</b> · {ACTION_LABEL[i.review!.action!]}
            </p>
            {i.review?.actionWhy ? <p className={styles.cleanWhy}>{i.review.actionWhy}</p> : null}
            <div className={styles.cleanChoices} role="radiogroup" aria-label={`${i.product}: pause or keep`}>
              <CheckChip value="pause" label="I'll pause it" checked={i.trialChoice === 'pause'} onChange={() => setTrialChoice(i.id, 'pause')} />
              <CheckChip value="keep" label="I'll keep using it" checked={i.trialChoice === 'keep'} onChange={() => setTrialChoice(i.id, 'keep')} />
            </div>
            {i.trialChoice === 'pause' ? <p className={styles.cleanWhy}>{until}</p> : null}
            {i.trialChoice === 'keep' ? <p className={styles.cleanWhy}>Fine. Your verdict will say you kept it, so the result is less certain.</p> : null}
          </li>
        ))}
        {unchecked.map((v) => (
          <li key={v.id} className={styles.cleanRow} data-testid="unchecked-row">
            <p className={styles.cleanName}>
              <b>{v.name}</b> · {REVIEW_COPY.unchecked}
            </p>
            <TextLink
              onClick={async () => {
                if (busy) return;
                setBusy(v.id);
                await retryPlanReview(v.id);
                setBusy(undefined);
              }}
              data-testid="retry-review"
            >
              {REVIEW_COPY.retry}
            </TextLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
