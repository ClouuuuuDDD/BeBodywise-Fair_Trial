import type { FitAnswers, FitResult } from '../contracts';
import { DEPILATORY_GAP_DAYS, HABIT_HAIR_REMOVAL, HORMONE_NOTE_TRIGGER, SHAVE_GAP_MIN, WAX_GAP_H } from './config';

/** Hair-removal gap line for the fit result and the first start rule (copy s05b.habit.*). */
export function habitLine(hairRemoval: FitAnswers['hairRemoval']): string | undefined {
  switch (hairRemoval) {
    case 'razor':
      return `Shaved? Wait ${SHAVE_GAP_MIN[0]}-${SHAVE_GAP_MIN[1]} minutes before the roll-on. If it stings, use it at night instead.`;
    case 'wax':
      return `Waxed? Wait ${WAX_GAP_H[0]}-${WAX_GAP_H[1]} hours before the roll-on.`;
    case 'cream':
      return `After hair removal cream, wait ${DEPILATORY_GAP_DAYS} days before the roll-on.`;
    default:
      return undefined;
  }
}

/** True when both hormone-note halves are met: neck and periods answers both in the trigger sets. */
export function hormonePattern(answers: FitAnswers): boolean {
  const { neck, periods } = HORMONE_NOTE_TRIGGER;
  return (
    answers.darkNeck !== undefined &&
    answers.regularPeriods !== undefined &&
    neck.includes(answers.darkNeck) &&
    periods.includes(answers.regularPeriods)
  );
}

/**
 * Fit check: two outcomes, never a gate (H-18, FR-M2-01). Hormone note per HORMONE_NOTE_TRIGGER;
 * 'good-with-habit' when hairRemoval is in HABIT_HAIR_REMOVAL, with the gap line (razor/wax: G0-1;
 * cream: DEPILATORY_GAP_DAYS). Placeholder rules, to be signed by a dermatologist.
 */
export function fit(answers: FitAnswers): FitResult {
  const hair = answers.hairRemoval;
  const habit = hair && HABIT_HAIR_REMOVAL.includes(hair) ? habitLine(hair) : undefined;
  const result: FitResult = {
    outcome: habit ? 'good-with-habit' : 'good',
    hormoneNote: hormonePattern(answers),
  };
  if (habit) result.habit = habit;
  return result;
}
