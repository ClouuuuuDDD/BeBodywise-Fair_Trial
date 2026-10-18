/**
 * The anonymous share payload (events.md "Share payload"), built only after "Yes, share anonymously".
 * Buckets and classes only: no names, no photos, no plan code, no exact dates (ISO week only), no other
 * brands' product names. In the prototype it stays on this phone and she can read all of it.
 */
import type { ChangeBucket, IngredientClass, PhotoCapture, Plan, StopReason, TrialEvent, TrialState, Verdict } from '../../../contracts';
import { isoWeek } from '../../../engine';
import { randomUuid } from '../../../store';
import { changeOf } from '../../../state/trial';

function pct(trial: TrialState | undefined): TrialEvent['useDaysPct'] {
  const p = trial ? Math.round((trial.useDaysSoFar / trial.targetUseDays) * 100) : 0;
  return p >= 90 ? '90-100' : p >= 70 ? '70-89' : p >= 50 ? '50-69' : '0-49';
}

/** Photo-change bucket. The example has no real photos, so it reads the seeded outcome. */
function bucketFor(plan: Plan, v: Verdict | undefined, photos: PhotoCapture[], example: boolean, today: string): ChangeBucket {
  if (!v || v.withoutPhotos) return 'no-photos';
  if (example) {
    return v.outcome === 'working' ? 'beyond-band' : v.outcome === 'not-for-you' ? 'within-band' : v.outcome === 'cant-call' ? 'not-comparable' : 'no-photos';
  }
  return changeOf(plan, photos, today)?.bucket ?? 'no-photos';
}

function agreement(plan: Plan, bucket: ChangeBucket): NonNullable<TrialEvent['blindPick']> {
  const says = plan.blindPick?.says;
  if (!says) return 'skipped';
  if (bucket === 'no-photos' || bucket === 'not-comparable') return 'unsure';
  const agrees =
    (says === 'now-lighter' && bucket === 'beyond-band') || (says === 'same' && bucket === 'within-band') || (says === 'day0-lighter' && bucket === 'darker-beyond-band');
  return agrees ? 'agrees' : 'disagrees';
}

/** One record per moment that exists, for this trial. `stopReason` is only included on the stop variant. */
export function buildSharePayload(args: {
  plan: Plan;
  trial: TrialState | undefined;
  photos: PhotoCapture[];
  example: boolean;
  today: string;
  stop: boolean;
}): TrialEvent[] {
  const { plan, trial, photos, example, today, stop } = args;
  const id = randomUuid(); // fresh for this share: cannot be joined to the local trial id
  const week = isoWeek(today);
  const product = `${plan.trialProduct ?? plan.pick.pick ?? 'bw-rollon-4'}${plan.pick.variant && plan.pick.pick === (plan.trialProduct ?? plan.pick.pick) ? `/${plan.pick.variant}` : ''}`;
  const flags = plan.fitResult.hormoneNote ? ['hormone'] : ['none'];
  const channel = plan.channel === 'example' ? undefined : plan.channel;
  const shelfClasses = plan.shelf.flatMap((i) => (i.classes as IngredientClass[]).flatMap((c) => i.areas.map((a) => `${c}:${a}`)));
  const base = { trial: id, week, ...(channel ? { channel } : {}) };

  const out: TrialEvent[] = [
    { event: 'fit-check', ...base, ...(plan.fit.shade ? { shade: plan.fit.shade } : {}), ...(plan.fit.hairRemoval ? { hairRemoval: plan.fit.hairRemoval } : {}), patternFlags: flags },
    { event: 'shelf-check', ...base, shelfClasses, shelfAnswers: plan.shelfAnswers.map((a) => a.answer) },
    { event: 'pick', ...base, product },
    { event: 'trial-start', ...base, product },
  ];
  for (const r of plan.reactions) out.push({ event: 'reaction', ...base, light: r.result.light });

  if (stop) {
    const reason: StopReason | undefined = plan.stopped?.reason;
    out.push({ event: 'stop', ...base, ...(reason ? { stopReason: reason } : {}), useDaysPct: pct(trial) });
    return out;
  }

  const v = plan.verdict;
  if (v) {
    const bucket = bucketFor(plan, v, photos, example, today);
    out.push({
      event: 'verdict',
      ...base,
      product,
      ...(plan.fit.shade ? { shade: plan.fit.shade } : {}),
      ...(plan.fit.hairRemoval ? { hairRemoval: plan.fit.hairRemoval } : {}),
      patternFlags: flags,
      shelfClasses,
      shelfAnswers: plan.shelfAnswers.map((a) => a.answer),
      useDaysPct: pct(trial),
      change: bucket,
      blindPick: agreement(plan, bucket),
      outcome: v.outcome,
    });
    if (v.stepUp) out.push({ event: 'step-up', ...base, product: v.stepUp });
  }
  return out;
}

/** Plain-list rows for the "See exactly what would be shared" sheet. */
export function payloadRows(payload: TrialEvent[]): { heading: string; lines: string[] }[] {
  return payload.map((rec) => ({
    heading: rec.event,
    lines: Object.entries(rec)
      .filter(([k]) => k !== 'event')
      .map(([k, val]) => `${k}: ${Array.isArray(val) ? val.join(', ') : String(val)}`),
  }));
}

/** Number of fields in the whole payload (event `share_payload_prepared`). */
export function fieldCount(payload: TrialEvent[]): number {
  return payload.reduce((n, rec) => n + Object.keys(rec).length - 1, 0);
}
