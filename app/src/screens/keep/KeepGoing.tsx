import { useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import type { MascotId } from '../../ui';
import { MASCOTS } from '../../ui';
import type { ShelfAnswerKind, ShelfItem } from '../../contracts';
import { makeShelfItem, nextCheckDate, pairRules, productUrl } from '../../engine';
import { track } from '../../state/vault';
import { AppShell, BottomBar, DrMehr, Mascot, PrimaryButton, ResultCard, TextLink } from '../../ui';
import { shortDate } from '../trial/components/format';
import { useTrialScreen } from '../trial/components/useTrialScreen';
import styles from './keep.module.css';

const ANSWER_LABEL: Record<ShelfAnswerKind, string> = {
  fine: 'Fine together',
  'split-time': 'Different times',
  'pick-one': 'Pick one here',
  wait: 'Wait before applying',
  'stop-ask': 'Stop and ask',
};

const asMascot = (key: string | undefined, fallback: MascotId): MascotId =>
  key && Object.prototype.hasOwnProperty.call(MASCOTS, key) ? (key as MascotId) : fallback;

/** A serum with niacinamide, used in the morning on her underarms: the canvas example for "Adding to your shelf?". */
function demoSerum(): ShelfItem {
  return makeShelfItem({
    id: 'keep-serum',
    product: 'Niacinamide serum',
    source: 'typed',
    inci: 'Aqua, Niacinamide, Glycerin',
    areas: ['underarm'],
    times: 'morning',
    mascot: 'serum',
  });
}

/** Screen 20: Keep Going. Her plan carries forward after Working; new products are checked first. */
export default function KeepGoing() {
  const s = useTrialScreen({ needDay0: true });
  const [params] = useSearchParams();
  const plan = s.plan;
  const trial = s.trial;

  // A product added from the add flow comes back as ?added=<shelf item id>; the example shows the canvas serum.
  const added = plan?.shelf.find((i) => i.id === params.get('added'));
  const item = useMemo(() => added ?? (s.isExample ? demoSerum() : undefined), [added, s.isExample]);
  const answer = useMemo(() => (item && plan ? pairRules([item], s.product)[0] : undefined), [item, plan, s.product]);

  useEffect(() => {
    if (trial) track('keep_going_viewed', '20', { days_since_day0: trial.calendarDay });
    if (answer) track('shelf_check_in_place', '20', { answer: answer.answer });
    // once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!trial, answer?.answer]);

  if (s.gate !== undefined) return s.gate;
  if (!plan || !trial) return null;
  // After Not for you (or no Working verdict) there is no Keep Going and no product push (FR-M11-03).
  if (plan.verdict?.outcome !== 'working') return <Navigate to="/trial" replace />;

  const weekNo = Math.max(1, Math.ceil(trial.calendarDay / 7));
  const checkDate = nextCheckDate(trial.judgeByDate);
  const apart = new Map(plan.startPlan?.keepApart.map((k) => [k.ref, k]) ?? []);
  const deodorant = plan.shelf.find((i) => i.classes.includes('antiperspirant') || i.classes.includes('drying-alcohol'));
  const faceOnly = plan.shelf.find((i) => apart.has(i.id) && i.areas.includes('face'));
  const rollon: MascotId = s.product === 'bw-rollon-6' ? 'rollon-strong' : 'rollon';
  const checkDue = trial.calendarDay >= (Date.parse(checkDate) - Date.parse(trial.startDate)) / 86_400_000;

  const serumLine = answer
    ? answer.answer === 'fine'
      ? 'Serum in the morning, roll-on at night.'
      : answer.reason
    : undefined;

  return (
    <AppShell screen="20" banner={s.banner} header={{ title: `Keep Going · week ${weekNo}`, planCode: plan.planCode, titleColor: 'var(--teal-deep)' }}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>Your shelf, steady.</h1>
          <p className={styles.lead}>It worked. Now it&apos;s just a habit, with a check now and then.</p>
        </div>
        <DrMehr pose="calendar" size={92} alt="" className={styles.mehr} />
      </div>

      <ResultCard className={styles.roster} data-testid="roster">
        <div className={styles.rosterCell}>
          <Mascot id={rollon} size={74} alt="" />
          <span className={`${styles.plate} ${styles.plateWorking}`} data-testid="working-plate">Working</span>
        </div>
        {deodorant ? (
          <div className={styles.rosterCell}>
            <Mascot id={asMascot(deodorant.mascot, 'deodorant')} size={66} alt="" />
            <span className={styles.plate}>Deodorant</span>
          </div>
        ) : null}
        {faceOnly ? (
          <div className={styles.rosterCell}>
            <Mascot id={asMascot(faceOnly.mascot, 'toner')} size={60} alt="" />
            <span className={styles.plate}>Face only</span>
          </div>
        ) : null}
      </ResultCard>

      {checkDue ? (
        <div className={styles.checkDue}>
          <DrMehr pose="avatar" say="Your next check is due. Same photo guide as before." />
          <PrimaryButton variant="secondary" size="sm" to="/verdict/photo">
            Take my check photos
          </PrimaryButton>
        </div>
      ) : null}

      <div className={styles.stats}>
        <ResultCard size="sm" padding="sm">
          <p className={styles.statLabel}>Next check, every 8 weeks</p>
          <p className={styles.statValue} data-testid="next-check">{shortDate(checkDate)}</p>
        </ResultCard>
        <ResultCard size="sm" padding="sm">
          <p className={styles.statLabel}>Next bottle</p>
          <p className={styles.statValue} data-testid="next-bottle">around {shortDate(trial.bottleRunsOutOn)}</p>
          <p className={styles.statSub}>At your pace</p>
        </ResultCard>
      </div>

      <ResultCard size="sm" padding="sm" className={styles.add} data-testid="adding">
        {item && answer ? (
          <>
            <Mascot id={asMascot(item.mascot, 'serum')} size={58} alt="" />
            <div>
              <p className={styles.statLabel}>Adding to your shelf?</p>
              <p className={styles.answerTitle} data-testid="shelf-answer">{ANSWER_LABEL[answer.answer]}</p>
              <p className={styles.answerLine}>{serumLine}</p>
            </div>
            <span className={styles.heart} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5 6.4 5c2 0 3.4 1.1 4 2.4h3.2C14.2 6.1 15.6 5 17.6 5 21 5 22.8 8.6 21.5 11.8 19.5 16.4 12 21 12 21z" /></svg>
            </span>
          </>
        ) : (
          <div className={styles.addEmpty}>
            <p className={styles.statLabel}>Adding to your shelf?</p>
            <TextLink layout="inline" to="/check/shelf/add?return=keep" data-testid="add-product">
              Check a new product first
            </TextLink>
          </div>
        )}
      </ResultCard>

      <BottomBar feelsOff>
        <PrimaryButton to="/start/routine?from=home">Update my routine</PrimaryButton>
        <TextLink
          href={productUrl(s.product)}
          external
          data-testid="reorder"
          onClick={() => track('reorder_clicked', '20', { product_id: s.product, days_since_day0: trial.calendarDay })}
        >
          Order another bottle on Be Bodywise
        </TextLink>
      </BottomBar>
    </AppShell>
  );
}
