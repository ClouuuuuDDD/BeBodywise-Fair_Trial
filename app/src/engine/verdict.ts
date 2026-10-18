import type {
  BodywiseProductId,
  PhotoChange,
  ReactionRecord,
  Verdict,
  VerdictInput,
  VerdictOutcome,
  VerdictRuleId,
} from '../contracts';
import { KEEP_GOING_CHECK_WEEKS, RECHECK_DAYS, STEP_UP_TARGET, SUPPORTING_ONLY_NOTE } from './config';
import { addDays, formatDayMonth } from './dates';
import { shade } from './shade';

const NEXT_WORKING = `Keep going. Check again in ${KEEP_GOING_CHECK_WEEKS} weeks.`;
const NEXT_NOT_FOR_YOU = 'You gave it a fair trial. You can stop here.';
const NEXT_CANT_CALL = 'Retake in daylight near a window.';
const NEXT_DOCTOR = 'Open my skin file and talk to a Be Bodywise doctor.';

const LINE_REACTION = "You had a reaction that needs a doctor's eye. Show them your skin file.";
const LINE_PATTERN =
  "No change, and your neck and periods answers fit a pattern that can be linked to hormones. A doctor can check what's behind it.";
const LINE_DARKER = 'Your underarm looks darker than on Day 0. Stop using it and show a doctor.';

/**
 * Step-up target (decisions X1-03). "Calm" = no amber or red reaction and no "this has stung me" on the trial
 * product (use-days met is checked by the caller: V2 comes first). 4% -> 6% roll-on, 6% -> Advanced kit,
 * kits and the cream never step up. The caller applies it only to a Not for you (the "slow" half).
 */
export function stepUpTarget(
  productId: BodywiseProductId,
  reactions: ReactionRecord[],
  trialProductStung = false,
): BodywiseProductId | undefined {
  const target = STEP_UP_TARGET[productId];
  if (target === undefined || trialProductStung) return undefined;
  return reactions.some((r) => r.result.light !== 'green') ? undefined : target;
}

interface Draft {
  outcome: VerdictOutcome;
  rule: VerdictRuleId;
  reasons: string[];
  nextStep: string;
  newDate?: string;
  measured?: boolean;
  blindPickLed?: boolean;
  withoutPhotos?: boolean;
  stepUp?: BodywiseProductId;
  needsShadeAnswer?: boolean;
}

function make(d: Draft): Verdict {
  const v: Verdict = {
    outcome: d.outcome,
    rule: d.rule,
    reasons: d.reasons,
    nextStep: d.nextStep,
    measured: d.measured ?? false,
    blindPickLed: d.blindPickLed ?? false,
    withoutPhotos: d.withoutPhotos ?? false,
  };
  if (d.newDate !== undefined) v.newDate = d.newDate;
  if (d.stepUp !== undefined) v.stepUp = d.stepUp;
  if (d.needsShadeAnswer) v.needsShadeAnswer = true;
  return v;
}

function daysLine(input: VerdictInput): string {
  const { useDaysSoFar, assumedDays } = input.trial;
  return assumedDays > 0
    ? `${useDaysSoFar} days of use, ${assumedDays} of them not logged and counted as used.`
    : `${useDaysSoFar} days of use, enough to judge fairly.`;
}

type Direction = 'lighter' | 'darker' | 'within';

function direction(change: PhotoChange): Direction {
  const band = change.band.itaDeg;
  if (change.change > band) return 'lighter';
  if (change.change < -band) return 'darker';
  return 'within';
}

function measureLine(dir: Direction): string {
  switch (dir) {
    case 'lighter':
      return 'Your underarm moved closer to your inner-arm shade, more than normal photo difference.';
    case 'darker':
      return 'Your underarm looks darker next to your inner arm than on Day 0, more than normal photo difference.';
    default:
      return 'No change beyond normal photo difference.';
  }
}

function pickLine(says: VerdictInput['blindPick'], dir: Direction | null): string {
  if (!says) return 'You skipped the blind pick, so there is only one read.';
  switch (says.says) {
    case 'now-lighter':
      return dir === 'lighter' ? "Your blind pick agrees: you chose today's photo." : "You chose today's photo as lighter.";
    case 'same':
      if (dir === 'lighter') return 'Your blind pick saw no clear difference, and the measurement did.';
      if (dir === 'within') return 'Your blind pick agrees: they looked the same.';
      return 'They looked the same to you.';
    default:
      return 'You chose the Day 0 photo as lighter.';
  }
}

/** Not for you, unless the hormone note is on: then it is See a doctor by V1 (never suppressed otherwise, G4). */
function noChange(input: VerdictInput, rule: VerdictRuleId, evidence: string[], extra: Partial<Draft>): Verdict {
  if (input.hormonePattern) {
    return make({
      outcome: 'see-doctor',
      rule: 'V1',
      reasons: [LINE_PATTERN, ...evidence],
      nextStep: NEXT_DOCTOR,
      ...extra,
    });
  }
  const stepUp = stepUpTarget(input.trial.productId, input.reactions, input.trialProductStung);
  return make({
    outcome: 'not-for-you',
    rule,
    reasons: evidence,
    nextStep: NEXT_NOT_FOR_YOU,
    ...(stepUp ? { stepUp } : {}),
    ...extra,
  });
}

function recheck(input: VerdictInput, rule: VerdictRuleId, reasons: string[], extra: Partial<Draft>): Verdict {
  const newDate = addDays(input.today, RECHECK_DAYS);
  return make({
    outcome: 'not-yet',
    rule,
    reasons: ["Your eye and the measurement don't agree yet.", ...reasons],
    nextStep: `Check again on ${formatDayMonth(newDate)}.`,
    newDate,
    ...extra,
  });
}

/**
 * Verdict (PRD FR-M10-02), first match wins: V1 red reaction, or V7 with the hormone note -> see-doctor;
 * V2 use-days < 56 -> not-yet (today + remaining); V3 no Day 0 photos -> her own shade read
 * (lighter -> working, same -> not-for-you, darker -> see-doctor); V4 not comparable -> cant-call;
 * V5 lighter beyond band and pick today/same -> working; V6 darker beyond band -> see-doctor;
 * V7 within band and pick "same" -> not-for-you (never suppressed); V8 other disagreement -> not-yet
 * (+ RECHECK_DAYS). K: when killTestPassed is false, V5-V8 use the blind pick alone and the measurement
 * is shown as supporting only. A skipped blind pick leaves one read only, so it is Not yet (V8 or K), except a
 * darker-beyond-band measurement (V6) which still says See a doctor when the kill test has passed.
 * Step-up (X1-03): a Not for you with a calm trial (V3, V7 and K alike) carries stepUp; Not yet and Working never do. Placeholder rules, to be signed by a dermatologist.
 */
export function verdict(input: VerdictInput): Verdict {
  const { trial, reactions, change, blindPick } = input;
  const use = daysLine(input);

  // V1: a red reaction was logged.
  if (reactions.some((r) => r.result.light === 'red')) {
    return make({ outcome: 'see-doctor', rule: 'V1', reasons: [LINE_REACTION, use], nextStep: NEXT_DOCTOR });
  }

  // V2: too few use-days.
  if (trial.useDaysSoFar < trial.targetUseDays) {
    const newDate = addDays(input.today, trial.targetUseDays - trial.useDaysSoFar);
    return make({
      outcome: 'not-yet',
      rule: 'V2',
      reasons: ['Not enough use-days yet.', `${trial.useDaysSoFar} of ${trial.targetUseDays} use-days so far.`],
      nextStep: `Keep going. New date: ${formatDayMonth(newDate)}.`,
      newDate,
    });
  }

  // V3: no Day 0 photos, her own read of the shade question.
  if (change === null) {
    const noPhotos = 'No photos, so nothing was measured. This is your own eye.';
    if (!input.shadeDay0 || !input.shadeNow) {
      return make({
        outcome: 'cant-call',
        rule: 'V3',
        reasons: [noPhotos, 'Answer the shade question to see where you stand.', use],
        nextStep: 'Tell us how your underarm looks next to your inner arm today.',
        withoutPhotos: true,
        needsShadeAnswer: true,
      });
    }
    const then = shade(input.shadeDay0);
    const now = shade(input.shadeNow);
    const evidence = [noPhotos, use, `On Day 0 you said: ${then.label}. Today: ${now.label}.`];
    const extra: Partial<Draft> = { withoutPhotos: true };
    if (now.rank < then.rank) {
      return make({ outcome: 'working', rule: 'V3', reasons: evidence, nextStep: NEXT_WORKING, ...extra });
    }
    if (now.rank === then.rank) return noChange(input, 'V3', evidence, extra);
    return make({ outcome: 'see-doctor', rule: 'V3', reasons: [LINE_DARKER, ...evidence], nextStep: NEXT_DOCTOR, ...extra });
  }

  // V4: light or quality too different from Day 0.
  if (!change.comparable) {
    return make({
      outcome: 'cant-call',
      rule: 'V4',
      reasons: ['The light was too different between Day 0 and today.', use],
      nextStep: NEXT_CANT_CALL,
    });
  }

  const dir = direction(change);
  const says = blindPick?.says ?? null;

  // K: kill test not passed, the blind pick leads and the measurement supports.
  if (!input.killTestPassed) {
    const evidence = [use, pickLine(blindPick, dir), `${measureLine(dir)} ${SUPPORTING_ONLY_NOTE}`];
    const extra: Partial<Draft> = { blindPickLed: true };
    if (says === 'now-lighter') return make({ outcome: 'working', rule: 'K', reasons: evidence, nextStep: NEXT_WORKING, ...extra });
    if (says === 'same') return noChange(input, 'K', evidence, extra);
    if (says === 'day0-lighter') {
      return make({ outcome: 'see-doctor', rule: 'K', reasons: [LINE_DARKER, ...evidence], nextStep: NEXT_DOCTOR, ...extra });
    }
    return recheck(input, 'K', evidence, extra);
  }

  // Measured path: V5 to V8.
  const evidence = [use, measureLine(dir), pickLine(blindPick, dir)];
  const extra: Partial<Draft> = { measured: true };
  if (dir === 'darker') {
    return make({ outcome: 'see-doctor', rule: 'V6', reasons: [LINE_DARKER, ...evidence], nextStep: NEXT_DOCTOR, ...extra });
  }
  if (dir === 'lighter' && (says === 'now-lighter' || says === 'same')) {
    return make({ outcome: 'working', rule: 'V5', reasons: evidence, nextStep: NEXT_WORKING, ...extra });
  }
  if (dir === 'within' && says === 'same') return noChange(input, 'V7', evidence, extra);
  return recheck(input, 'V8', evidence, extra);
}
