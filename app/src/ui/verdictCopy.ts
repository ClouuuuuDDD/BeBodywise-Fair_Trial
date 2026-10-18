export type VerdictOutcome = 'working' | 'not-yet' | 'cant-call' | 'not-for-you' | 'see-doctor';

/** Default big word per outcome (copy.md v.*.title). */
export const VERDICT_HEADLINES: Record<VerdictOutcome, string> = {
  working: 'Working.',
  'not-yet': 'Not yet.',
  'cant-call': "Can't call it.",
  'not-for-you': 'Not for you.',
  'see-doctor': 'See a doctor.',
};
