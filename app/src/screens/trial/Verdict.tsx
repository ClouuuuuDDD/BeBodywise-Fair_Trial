import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BodywiseProductId, ShadeLevel, Verdict as VerdictResult } from '../../contracts';
import { catalog, formatDayMonth, productName } from '../../engine';
import { shade } from '../../engine/shade';
import { clearVerdict, computeVerdict, hasDay0Photos, setVerdict, stopTrial, changeOf } from '../../state/trial';
import { track } from '../../state/vault';
import {
  AppShell,
  BottomBar,
  OptionGroup,
  OptionRow,
  PlaceholderRulesNote,
  PrimaryButton,
  ResultCard,
  TextLink,
  VerdictBadge,
  VerdictReason,
} from '../../ui';
import { CalendarSheet } from './components/CalendarSheet';
import { DOCTOR_URL } from './components/format';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

const SHADE_KEY = 'ft-shade-now';
const SHADES = Object.keys(catalog.severity_scale.answers) as ShadeLevel[];

function readShade(): ShadeLevel | undefined {
  try {
    const v = sessionStorage.getItem(SHADE_KEY);
    return SHADES.find((s) => s === v);
  } catch {
    return undefined;
  }
}

const PCT: Partial<Record<BodywiseProductId, string>> = { 'bw-rollon-4': '4%', 'bw-rollon-6': '6%' };

/** The reasons she reads. Measured path: measurement, pick, use-days. Blind-pick-led path (G1-1): pick first, measurement as support. */
function orderReasons(v: VerdictResult): string[] {
  const [use, ...rest] = v.reasons;
  if (v.outcome === 'working' || v.outcome === 'not-for-you') {
    if (v.rule === 'V3') return v.reasons;
    return use ? [...rest, use] : v.reasons;
  }
  return v.reasons;
}

/** Screens 17 and 18, and the other three outcomes as states (Not yet, Can't call it, See a doctor). */
export default function Verdict() {
  const s = useTrialScreen({ needDay0: true });
  const navigate = useNavigate();
  const [shadeNow, setShadeNow] = useState<ShadeLevel | undefined>(readShade);
  const [calOpen, setCalOpen] = useState(false);
  const [knows, setKnows] = useState<'yes' | 'no' | undefined>();
  const shown = useRef<string>('');
  const plan = s.plan;

  const verdict = useMemo<VerdictResult | undefined>(() => {
    if (!plan) return undefined;
    if (s.isExample && plan.verdict) return plan.verdict;
    return computeVerdict(plan, s.photos, s.today, shadeNow);
  }, [plan, s.photos, s.today, s.isExample, shadeNow]);

  const asksShade = !s.isExample && !!plan && !hasDay0Photos(s.photos) && !shadeNow && !!s.trial && s.trial.verdictDue && !plan.reactions.some((r) => r.result.light === 'red');

  // Keep the verdict she was shown, and log it once.
  useEffect(() => {
    if (!plan || !verdict || !s.trial || asksShade) return;
    if (!s.isExample && JSON.stringify(plan.verdict) !== JSON.stringify(verdict)) setVerdict(verdict);
    const key = `${verdict.outcome}|${verdict.rule}`;
    if (shown.current === key) return;
    shown.current = key;
    const change = s.isExample ? null : changeOf(plan, s.photos);
    track('verdict_shown', '17', {
      outcome: verdict.outcome,
      rule_id: verdict.rule,
      use_days: s.trial.useDaysSoFar,
      assumed_days: s.trial.assumedDays,
      measured: verdict.measured,
      change_bucket: change?.bucket ?? 'no-photos',
      blind_pick: plan.blindPick?.says ?? 'none',
      days_since_day0: s.trial.calendarDay,
      step_up: !!verdict.stepUp,
      hormone_note: plan.fitResult.hormoneNote,
    });
    if (verdict.stepUp) track('step_up_offered', '18', { from_product: s.product, to_product: verdict.stepUp });
  }, [plan, verdict, s.trial, s.isExample, s.photos, s.product, asksShade]);

  if (s.gate !== undefined) return s.gate;
  if (!plan || !s.trial) return null;
  const planCode = plan.planCode;

  if (asksShade) {
    return (
      <AppShell screen="17" banner={s.banner} header={{ back: true, title: 'Your verdict', planCode }}>
        <h1 className={styles.h1}>Next to your inner arm, your underarm looks…</h1>
        <p className={styles.lead}>No photos, so nothing was measured. This is your own eye.</p>
        <OptionGroup label="Next to your inner arm, your underarm looks…">
          {SHADES.map((lvl) => (
            <OptionRow
              key={lvl}
              value={lvl}
              label={shade(lvl).label}
              selected={false}
              onSelect={(v) => {
                try {
                  sessionStorage.setItem(SHADE_KEY, v);
                } catch {
                  /* ignore */
                }
                setShadeNow(v as ShadeLevel);
              }}
            />
          ))}
        </OptionGroup>
        <BottomBar />
      </AppShell>
    );
  }
  if (!verdict) return null;

  const { outcome } = verdict;
  const useDays = s.trial.useDaysSoFar;
  const header = {
    title: `Your verdict · ${useDays} days of use`,
    planCode,
    ...(outcome === 'working' ? { titleColor: 'var(--teal-deep)' } : {}),
  };
  const reasons = orderReasons(verdict);
  const mark = outcome === 'working' ? 'tick' : 'dash';

  const knowsRow = (
    <div className={styles.knows} role="group" aria-label="Do you know whether it worked?">
      <span>Do you know whether it worked?</span>
      {(['yes', 'no'] as const).map((a) => (
        <button
          key={a}
          type="button"
          className={`${styles.pill} ${knows === a ? styles.pillOn : ''}`}
          aria-pressed={knows === a}
          data-testid={`knows-${a}`}
          onClick={() => {
            setKnows(a);
            track('knows_where_she_stands', '17', { answer: a });
          }}
        >
          {a === 'yes' ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );

  function leaveToShare() {
    if (outcome === 'not-for-you' || outcome === 'see-doctor') stopTrial();
    void navigate('/verdict/share');
  }

  let sub: string;
  let body: React.ReactNode;
  let actions: React.ReactNode;

  switch (outcome) {
    case 'working':
      sub = 'Keep going. Check again in 8 weeks.';
      body = reasons.map((r) => <VerdictReason key={r}>{r}</VerdictReason>);
      actions = (
        <>
          <PrimaryButton onClick={leaveToShare}>Continue</PrimaryButton>
          <TextLink to="/file" data-testid="secondary">
            Open my skin file
          </TextLink>
        </>
      );
      break;
    case 'not-for-you': {
      sub = 'You gave it a fair trial. You can stop here.';
      const target = verdict.stepUp;
      const from = s.product;
      const lines = target ? [`No clear change on the ${PCT[from] ?? 'product'} at 8 weeks.`, ...reasons] : reasons;
      body = (
        <>
          {target ? (
            <p className={styles.stepUp} data-testid="step-up">
              {target === 'bw-kit-6'
                ? 'Your skin stayed calm. Some people see more on the stronger Advanced Underarm Pigmentation Kit. Trying it would be a new fair trial.'
                : 'Your skin stayed calm. Some people see more on the stronger 6%. Trying it would be a new fair trial.'}{' '}
              <TextLink
                layout="inline"
                to="/check/1"
                data-testid="step-up-link"
                onClick={() => track('step_up_clicked', '18', { from_product: from, to_product: target })}
              >
                {target === 'bw-kit-6' ? `See the Fair Trial check for the ${productName('bw-kit-6')}` : 'See the Fair Trial check for the 6% roll-on'}
              </TextLink>
            </p>
          ) : null}
          {lines.map((r) => (
            <VerdictReason key={r} mark={mark}>
              {r}
            </VerdictReason>
          ))}
          <ResultCard size="sm" padding="sm" className={styles.kind}>
            <p className={styles.kindTitle}>This is about the product and your skin, not you.</p>
            <p className={styles.kindBody}>Underarm darkness has other causes, like friction, hormones or genetics. A doctor can look at yours.</p>
          </ResultCard>
        </>
      );
      actions = (
        <>
          <PrimaryButton size="md" onClick={leaveToShare}>
            Continue
          </PrimaryButton>
          <PrimaryButton
            size="sm"
            variant="secondary"
            href={DOCTOR_URL}
            external
            data-testid="secondary"
            onClick={() => track('doctor_link_clicked', '18', { from: 'verdict' })}
          >
            Talk to the Bodywise in-app doctor
          </PrimaryButton>
        </>
      );
      break;
    }
    case 'not-yet': {
      const date = verdict.newDate ? formatDayMonth(verdict.newDate) : '';
      sub = verdict.rule === 'V2' ? `Not enough use-days yet. New date: ${date}.` : `Your eye and the measurement don't agree yet. Check again on ${date}.`;
      body = reasons.slice(1).map((r) => (
        <VerdictReason key={r} mark="dash">
          {r}
        </VerdictReason>
      ));
      actions = (
        <>
          <PrimaryButton size="md" onClick={() => setCalOpen(true)}>
            Add the new date to my calendar
          </PrimaryButton>
          <TextLink to="/trial" data-testid="secondary">
            Back to my trial
          </TextLink>
        </>
      );
      break;
    }
    case 'cant-call':
      sub = "The light was too different. Retake in daylight near a window.";
      body = reasons.slice(1).map((r) => (
        <VerdictReason key={r} mark="dash">
          {r}
        </VerdictReason>
      ));
      actions = (
        <>
          <PrimaryButton
            onClick={() => {
              clearVerdict();
              void navigate('/verdict/photo');
            }}
          >
            Retake photos
          </PrimaryButton>
          <TextLink to="/trial" data-testid="secondary">
            Back to my trial
          </TextLink>
        </>
      );
      break;
    default:
      sub = verdict.reasons[0] ?? '';
      body = verdict.reasons.slice(1).map((r) => (
        <VerdictReason key={r} mark="dash">
          {r}
        </VerdictReason>
      ));
      actions = (
        <>
          <PrimaryButton href={DOCTOR_URL} external onClick={() => track('doctor_link_clicked', '18', { from: 'verdict' })}>
            Talk to the Bodywise in-app doctor
          </PrimaryButton>
          <TextLink to="/file" data-testid="secondary">
            Open my skin file
          </TextLink>
          <TextLink onClick={leaveToShare} data-testid="continue">
            Continue
          </TextLink>
        </>
      );
  }

  return (
    <AppShell screen={outcome === 'working' ? '17' : '18'} ground="plain" overlayHeader banner={s.banner} header={header}>
      <VerdictBadge outcome={outcome} sub={sub}>
        {body}
      </VerdictBadge>
      {knowsRow}
      <PlaceholderRulesNote />
      <BottomBar>{actions}</BottomBar>
      {verdict.newDate ? <CalendarSheet open={calOpen} onClose={() => setCalOpen(false)} date={verdict.newDate} onDone={() => void navigate('/trial')} /> : null}
    </AppShell>
  );
}
