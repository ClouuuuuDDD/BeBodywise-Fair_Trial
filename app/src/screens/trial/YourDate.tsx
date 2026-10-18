import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BodywiseProductId, ISODate } from '../../contracts';
import { productPrice, trialClock, weeksInBucket } from '../../engine';
import { isKit } from '../../engine/products';
import { productOf, setEventDate, startDay0 } from '../../state/trial';
import { track } from '../../state/vault';
import { AppShell, BottomBar, DrMehr, Icon, PrimaryButton, ResultCard, Sheet, Sparkle, TextLink } from '../../ui';
import { CalendarSheet } from './components/CalendarSheet';
import { shortDate } from './components/format';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

const money = (n: number) => `Rs ${n.toLocaleString('en-IN')}`;

/** Screen 10: the judge-by date, bottles and cost, before she commits. Day 0 is set when she leaves. */
export default function YourDate() {
  const s = useTrialScreen();
  const navigate = useNavigate();
  const [calOpen, setCalOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const plan = s.plan;
  const product: BodywiseProductId = plan ? productOf(plan) : 'bw-rollon-4';
  const day0: ISODate = plan?.day0 ?? s.today;
  const clock = trialClock({
    productId: product,
    startDate: day0,
    dayLog: plan?.dayLog ?? [],
    today: plan?.day0 ? s.today : day0,
    ...(plan?.eventDate ? { eventDate: plan.eventDate } : {}),
  });

  useEffect(() => {
    if (plan) track('judge_date_set', '10', { use_day_target: clock.targetUseDays, bottles: clock.bottles, cost_inr: clock.costInr, product_id: product });
    // once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!plan]);

  if (s.gate !== undefined) return s.gate;
  if (!plan) return null;

  const kit = isKit(product);
  const unit = kit ? 'kits' : 'bottles';
  const eventLine = clock.eventDate
    ? `By ${shortDate(clock.eventDate)} you'll be about ${clock.weeksByEvent ?? 0} weeks in. Some change is possible, a full result is not.`
    : null;

  function leave() {
    startDay0();
    void navigate('/trial');
  }

  return (
    <AppShell screen="10" banner={s.banner} header={{ back: true, title: 'Day 0 · 3 of 3', planCode: plan.planCode }}>
      <div className={styles.dateHero}>
        <div>
          <p className={styles.dateLabel}>Judge it on</p>
          <p className={styles.dateNumeral} data-testid="judge-date">{shortDate(clock.judgeByDate)}</p>
          <Sparkle size={30} />
        </div>
        <DrMehr pose="calendar" size={150} alt="" className={styles.dateMehr} />
      </div>

      <div className={styles.stats}>
        <ResultCard size="sm" padding="sm" className={styles.stat}>
          <b>{clock.targetUseDays}</b> <span>days of use</span>
        </ResultCard>
        <ResultCard size="sm" padding="sm" className={styles.stat}>
          <b>{clock.bottles}</b> <span>{unit}</span>
        </ResultCard>
        <ResultCard size="sm" padding="sm" className={styles.stat}>
          <b>{money(clock.costInr)}</b> <span>to know{clock.costIsEstimate ? ', an estimate' : ''}</span>
        </ResultCard>
      </div>
      <p className={styles.listPrice}>At the Bodywise list price of {money(productPrice(product))}.</p>
      <p className={styles.body}>
        One bottle lasts about 40 days, so the second one is part of the plan. Skipped days move the date back. That&apos;s fair to you and to the product.
      </p>

      <ResultCard size="sm" padding="none" className={styles.linkCard}>
        <button type="button" className={styles.linkRow} data-testid="event-row" onClick={() => setEventOpen(true)}>
          <span>I have an event before then</span>
          <Icon name="chevron" size={20} />
        </button>
      </ResultCard>
      {eventLine ? (
        <p className={styles.eventAnswer} data-testid="event-answer">
          {eventLine}
        </p>
      ) : null}

      <BottomBar>
        <PrimaryButton icon={<Icon name="calendar" size={22} />} onClick={() => setCalOpen(true)}>
          Add to my calendar
        </PrimaryButton>
        <TextLink onClick={leave} data-testid="secondary">
          Not now, start my trial
        </TextLink>
      </BottomBar>

      <Sheet open={eventOpen} onClose={() => setEventOpen(false)} title="Your event" footer={<PrimaryButton size="md" onClick={() => setEventOpen(false)}>Done</PrimaryButton>}>
        <label className={styles.field}>
          <span>Event date</span>
          <input
            type="date"
            data-testid="event-date"
            min={day0}
            value={plan.eventDate ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setEventDate(v || undefined);
              if (v) {
                const weeks = Math.max(0, Math.round((Date.parse(v) - Date.parse(day0)) / (7 * 86_400_000)));
                track('event_mode_used', '10', { weeks_in_bucket: weeksInBucket(weeks) });
              }
            }}
          />
        </label>
        {eventLine ? <p className={styles.eventAnswer}>{eventLine}</p> : null}
      </Sheet>

      <CalendarSheet open={calOpen} onClose={() => setCalOpen(false)} date={clock.judgeByDate} onDone={leave} />
    </AppShell>
  );
}
