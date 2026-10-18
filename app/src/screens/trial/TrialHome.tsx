import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOTTLE_DAYS } from '../../engine/config';
import { clearDay, dotsFor, hasDay0Photos, logDay, restartTrial, deleteEverything } from '../../state/trial';
import { leaveExample } from '../../state/example';
import { track } from '../../state/vault';
import { AppShell, BottomBar, DrMehr, FeelsOffPill, PrimaryButton, ResultCard, TextLink, TrialCard } from '../../ui';
import { halfwayKey, readFlag, refillKey, writeFlag } from './components/flags';
import { shortDate } from './components/format';
import { StopSheet } from './components/StopSheet';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

type HomeState = 'quiet' | 'halfway' | 'refill' | 'verdict-due' | 'paused-red';

/** Screen 11 (and 14, the refill state): where she is, one next step, one escape hatch. */
export default function TrialHome() {
  const s = useTrialScreen({ needDay0: true });
  const [stopOpen, setStopOpen] = useState(false);
  const [, bump] = useState(0);
  const plan = s.plan;
  const trial = s.trial;

  const redPaused = !!plan?.reactions.some((r) => r.result.light === 'red');
  const bottle = trial ? Math.floor(trial.useDaysSoFar / BOTTLE_DAYS) : 0;
  const refill = !!trial && trial.refillDue && !readFlag(refillKey(s.isExample, bottle));
  const halfwayTaken = s.photos.some((p) => p.moment === 'halfway') || readFlag(halfwayKey(s.isExample));
  const halfway = !!trial && trial.halfwayDue && !halfwayTaken;
  const stopped = !!plan?.stopped;

  let state: HomeState = 'quiet';
  if (redPaused) state = 'paused-red';
  else if (trial?.verdictDue) state = 'verdict-due';
  else if (refill) state = 'refill';
  else if (halfway) state = 'halfway';

  useEffect(() => {
    if (!trial || stopped) return;
    track('home_viewed', '11', { use_day: trial.useDaysSoFar, state });
    if (state === 'refill') track('refill_prompt_shown', '14', { use_day: trial.useDaysSoFar, days_to_verdict: trial.daysToVerdict });
    // once per state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, !!trial, stopped]);

  if (s.gate !== undefined) return s.gate;
  if (!plan || !trial) return null;

  const dots = dotsFor(plan, s.today);
  const todayLogged = plan.dayLog.find((e) => e.date === s.today);
  const used = todayLogged?.status === 'used';
  const hour = new Date().getHours();
  const toggleLabel = hour < 18 ? 'Used it last night' : 'Used it today';
  const moved = trial.pausedDays + trial.skippedDays;
  const header = { title: `Fair Trial · Day ${trial.useDaysSoFar} of 56`, planCode: plan.planCode };

  if (stopped) {
    return (
      <AppShell screen="11" banner={s.banner} header={header}>
        <h1 className={`${styles.h1} ${styles.stoppedTitle}`}>You&apos;ve stopped.</h1>
        <p className={styles.lead}>Your skin file stays on this phone. You can delete everything any time.</p>
        <div className={styles.linkPair}>
          <Link className={styles.linkTile} to="/file" data-testid="home-file">My skin file</Link>
          <button
            type="button"
            className={styles.linkTile}
            onClick={() => {
              restartTrial();
              bump((n) => n + 1);
            }}
          >
            Start again
          </button>
        </div>
        <TextLink
          onClick={() => {
            if (s.isExample) leaveExample();
            else void deleteEverything();
            window.location.assign('/');
          }}
        >
          Delete everything from this phone
        </TextLink>
        <BottomBar />
      </AppShell>
    );
  }

  const next =
    state === 'paused-red' ? (
      <p>{'Paused after a reaction. See a doctor before restarting.'}</p>
    ) : state === 'verdict-due' ? (
      <p>{"It's your judge-by date. Let's see if it worked."}</p>
    ) : state === 'halfway' ? (
      <p>{'Halfway. Want to take a check-in photo?'}</p>
    ) : (
      <p>
        <b>Nothing to do today.</b> Too early to judge. Most change shows after week 6.
      </p>
    );

  if (state === 'refill') {
    return (
      <AppShell screen="14" banner={s.banner} header={header}>
        <div className={styles.homeTop}>
          <TrialCard day={trial.useDaysSoFar} mascot="rollon-sleepy" judgeBy={`Judge on ${shortDate(trial.judgeByDate)}`} paused={dots.paused} reaction={dots.reaction} />
        </div>
        <ResultCard className={styles.refillCard} data-testid="refill-card">
          <div className={styles.refillHead}>
            <DrMehr pose="avatar" size={48} alt="" />
            <h2>Your bottle is almost empty.</h2>
          </div>
          <p>
            Your verdict is in {trial.daysToVerdict} days. For a fair answer you&apos;ll need one more bottle, as planned on day one.
          </p>
          <PrimaryButton
            onClick={() => {
              writeFlag(refillKey(s.isExample, bottle), s.isExample);
              track('refill_choice', '14', { choice: 'another-bottle' });
              bump((n) => n + 1);
            }}
          >
            I&apos;ll get another bottle
          </PrimaryButton>
          <TextLink
            data-testid="secondary"
            onClick={() => {
              track('refill_choice', '14', { choice: 'stop' });
              setStopOpen(true);
            }}
          >
            Stop here instead
          </TextLink>
        </ResultCard>
        <p className={styles.note}>This shows when your days of use say the bottle is nearly empty, never on a fixed schedule.</p>
        <BottomBar feelsOff />
        <StopSheet open={stopOpen} onClose={() => setStopOpen(false)} from="refill" />
      </AppShell>
    );
  }

  const cta =
    state === 'verdict-due' ? (
      <PrimaryButton to={plan.photosSkipped || (!s.isExample && !hasDay0Photos(s.photos)) ? '/verdict' : '/verdict/photo'} onClick={() => track('verdict_started', '11', { use_days: trial.useDaysSoFar })}>
        Take my verdict photos
      </PrimaryButton>
    ) : state === 'halfway' ? (
      <PrimaryButton to="/trial/halfway">Take a halfway photo</PrimaryButton>
    ) : null;

  return (
    <AppShell screen="11" banner={s.banner} header={header}>
      <div className={styles.homeTop}>
        <TrialCard day={trial.useDaysSoFar} judgeBy={`Judge on ${shortDate(trial.judgeByDate)}`} paused={dots.paused} reaction={dots.reaction} />
      </div>
      {moved > 0 ? <p className={styles.moved}>Moved {moved} days for your pause</p> : null}
      <div className={styles.bubbleRow} data-testid="next-step">
        <DrMehr pose="avatar" say={next} />
      </div>
      {cta}
      {trial.assumedDays >= 3 && state === 'quiet' ? <p className={styles.note}>Counting days you didn&apos;t log as used.</p> : null}

      {state !== 'paused-red' ? (
        <ResultCard size="sm" padding="none" className={styles.toggleCard}>
          <label className={styles.toggleRow}>
            <span>{toggleLabel}</span>
            <input
              type="checkbox"
              role="switch"
              className={styles.switch}
              data-testid="used-toggle"
              checked={used}
              onChange={(e) => (e.target.checked ? logDay(s.today, 'used') : clearDay(s.today))}
            />
          </label>
        </ResultCard>
      ) : null}

      <div className={styles.linkPair}>
        <Link className={styles.linkTile} to="/file" data-testid="home-file">My skin file</Link>
        <Link className={styles.linkTile} to="/start/routine?from=home" data-testid="home-routine">My routine</Link>
      </div>
      <TextLink onClick={() => setStopOpen(true)} data-testid="stopped">
        I&apos;ve stopped
      </TextLink>

      <BottomBar>
        <FeelsOffPill />
      </BottomBar>
      <StopSheet open={stopOpen} onClose={() => setStopOpen(false)} from="home" />
    </AppShell>
  );
}
