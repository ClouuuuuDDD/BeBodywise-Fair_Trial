/**
 * Trial state (E5): trial clock inputs, day log, photo refs, reactions, blind pick, verdict, share consent.
 * One active plan: her real plan from the on-phone vault, or Riya's example copy when example mode is on.
 * The two never mix: every write goes to whichever one is active (state/example.ts holds the example).
 * Skin photos (Blobs) live only in IndexedDB on this phone. Nothing here makes a network call.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type {
  AppMode,
  BlindPick,
  BodywiseProductId,
  DayLogEntry,
  ExampleState,
  ISODate,
  PhotoCapture,
  PhotoChange,
  PhotoMeasurement,
  Plan,
  ReactionRecord,
  ShareConsent,
  StopReason,
  TrialState,
  Verdict,
} from '../contracts';
import { DEFAULT_ANCHOR_PRODUCT, KILL_TEST_PASSED } from '../engine/config';
import { startPlan, trialClock, verdict as runVerdict } from '../engine';
import { computeChange, noiseBandFromBursts } from '../photo/measure';
import { getExample, updateExample, useExample } from './example';
import { tourToday, useTour } from './tour';
import { getStore, localToday, setVaultMode, track } from './vault';

/* ------------------------------------------------------------------ */
/* Live plan (her own trial)                                           */
/* ------------------------------------------------------------------ */

interface LiveSnapshot {
  ready: boolean;
  plan: Plan | undefined;
  photos: PhotoCapture[];
}

let live: LiveSnapshot = { ready: false, plan: undefined, photos: [] };
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

function emit(): void {
  for (const l of listeners) l();
}

function setLive(next: Partial<LiveSnapshot>): void {
  live = { ...live, ...next };
  emit();
}

/** Loads her plan and photos once per page load. */
export function loadLive(): Promise<void> {
  loading ??= getStore()
    .then(async (s) => {
      const [plan, photos] = await Promise.all([s.getPlan(), s.listPhotos()]);
      setLive({ ready: true, plan, photos });
    })
    .catch(() => setLive({ ready: true }));
  return loading;
}

/** Re-reads the vault (another screen, such as Right Start, saved a plan). */
export function reloadLive(): Promise<void> {
  loading = undefined;
  return loadLive();
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Product on trial: what she chose, else the pick, else the anchor roll-on. */
export function productOf(plan: Plan): BodywiseProductId {
  return plan.trialProduct ?? plan.pick.pick ?? DEFAULT_ANCHOR_PRODUCT;
}

/** Trial clock for a plan on a day, or undefined before Day 0. */
export function clockFor(plan: Plan, today: ISODate): TrialState | undefined {
  if (!plan.day0) return undefined;
  return trialClock({
    productId: productOf(plan),
    startDate: plan.day0,
    dayLog: plan.dayLog,
    today,
    ...(plan.eventDate ? { eventDate: plan.eventDate } : {}),
  });
}

/** Use-day numbers (1-based) of the paused and reaction days, for the use-day dots. */
export function dotsFor(plan: Plan, today: ISODate): { paused: number[]; reaction: number[] } {
  if (!plan.day0) return { paused: [], reaction: [] };
  const start = Date.parse(`${plan.day0}T00:00:00Z`);
  const offset = (d: ISODate) => Math.round((Date.parse(`${d}T00:00:00Z`) - start) / 86_400_000);
  // Dots are use-day cells: each calendar day after Day 0 that was a use-day takes the next cell.
  const off = new Map<number, 'paused' | 'skipped'>();
  for (const e of plan.dayLog) if (e.status !== 'used') off.set(offset(e.date), e.status === 'paused' ? 'paused' : 'skipped');
  const reactionDays = new Set(plan.reactions.map((r) => r.report.useDay));
  const paused: number[] = [];
  const reaction: number[] = [];
  const last = Math.max(0, offset(today));
  let cell = 0;
  for (let d = 1; d <= last; d++) {
    const status = off.get(d);
    if (status === 'skipped') continue; // skipped days leave no cell; the date moves back
    cell++;
    if (status === 'paused') paused.push(cell);
  }
  for (const u of reactionDays) if (u > 0) reaction.push(u);
  return { paused, reaction };
}

/* ------------------------------------------------------------------ */
/* Photo measurements: numbers only, kept beside the photos on this phone */
/* ------------------------------------------------------------------ */

/** What is kept about a measured capture. No pixels. */
export interface StoredMeasure {
  measurement: PhotoMeasurement;
  /** ITA° of each burst frame, for the noise band (decisions B8). */
  frameIta: number[];
}

const MEASURE_KEY = 'ft-measures';

function readMeasures(): Record<string, StoredMeasure> {
  try {
    return JSON.parse(localStorage.getItem(MEASURE_KEY) ?? '{}') as Record<string, StoredMeasure>;
  } catch {
    return {};
  }
}

/** Saves the measurement of one capture. */
export function saveMeasure(photoId: string, m: StoredMeasure): void {
  try {
    localStorage.setItem(MEASURE_KEY, JSON.stringify({ ...readMeasures(), [photoId]: m }));
  } catch {
    /* storage blocked: the verdict then rests on the blind pick */
  }
}

/** One stored measurement. */
export function loadMeasure(photoId: string): StoredMeasure | undefined {
  return readMeasures()[photoId];
}

/** Fallback noise band in ITA° when no burst spread exists. Shown only as a supporting number while KILL_TEST_PASSED is false. */
const FALLBACK_BAND_ITA = 4;

/* ------------------------------------------------------------------ */
/* Writes: always to the active plan                                   */
/* ------------------------------------------------------------------ */

/** True when example mode is on. */
export function inExample(): boolean {
  return getExample() !== null;
}

/** Changes the active plan (example copy or her own) and saves it on this phone. */
export function mutatePlan(fn: (plan: Plan) => Plan): void {
  if (inExample()) {
    updateExample((s: ExampleState) => ({ ...s, plan: fn(s.plan) }));
    return;
  }
  const plan = live.plan;
  if (!plan) return;
  const next = fn(structuredClone(plan));
  setLive({ plan: next });
  void getStore().then((s) => s.putPlan(next)).catch(() => undefined);
}

/** Today for the active plan: the example's jumped day, or her phone's date. */
export function activeToday(): ISODate {
  return getExample()?.today ?? tourToday();
}

/** Makes sure the trial product and routine exist (screen 07 and everything after it need them). */
export function ensureStartPlan(): void {
  const plan = activePlan();
  if (!plan || (plan.trialProduct && plan.startPlan)) return;
  mutatePlan((p) => {
    const id = productOf(p);
    return {
      ...p,
      trialProduct: id,
      startPlan: startPlan(p.pick, p.shelf, p.shelfAnswers, p.fit, id),
    };
  });
}

/** Non-hook read of the active plan. */
export function activePlan(): Plan | undefined {
  return getExample()?.plan ?? live.plan;
}

/** Day 0 is set when she leaves "Your date". Not a use-day. */
export function startDay0(): void {
  const today = activeToday();
  ensureStartPlan();
  mutatePlan((p) => (p.day0 ? p : { ...p, day0: today }));
}

/** Logs a day (used, paused, skipped). */
export function logDay(date: ISODate, status: DayLogEntry['status'], source: DayLogEntry['source'] = 'tap'): void {
  mutatePlan((p) => ({ ...p, dayLog: [...p.dayLog.filter((e) => e.date !== date), { date, status, source }] }));
  track('use_day_logged', '11', { status, source });
}

/** Clears a day back to "not logged" (counted as used). */
export function clearDay(date: ISODate): void {
  mutatePlan((p) => ({ ...p, dayLog: p.dayLog.filter((e) => e.date !== date) }));
  track('use_day_logged', '11', { status: 'cleared', source: 'tap' });
}

/** Adds a reaction and, for amber or red, the paused days that move the judge-by date. */
export function addReaction(record: ReactionRecord, pauses: DayLogEntry[]): void {
  mutatePlan((p) => {
    if (p.reactions.some((r) => r.report.at === record.report.at && r.report.severity === record.report.severity && r.report.symptoms.join() === record.report.symptoms.join())) return p; // same report twice (StrictMode, reopened screen)
    const dates = new Set(pauses.map((e) => e.date));
    return {
      ...p,
      reactions: [...p.reactions, record],
      dayLog: [...p.dayLog.filter((e) => !dates.has(e.date)), ...pauses],
    };
  });
}

/** Event date for "I have an event before then". */
export function setEventDate(date: ISODate | undefined): void {
  mutatePlan((p) => {
    const { eventDate: _old, ...rest } = p;
    return date ? { ...rest, eventDate: date } : rest;
  });
}

/** Saves a captured photo (Blob stays on this phone) and points the plan at it. */
export async function addPhoto(photo: PhotoCapture): Promise<void> {
  const store = await getStore();
  await store.putPhoto(photo);
  const { frames: _frames, ...kept } = photo;
  setLive({ photos: [...live.photos.filter((p) => p.id !== photo.id), kept] });
  mutatePlan((p) => ({ ...p, photoIds: [...p.photoIds.filter((id) => id !== photo.id), photo.id], photosSkipped: false }));
}

/** Removes a photo (retake). */
export async function removePhoto(id: string): Promise<void> {
  const store = await getStore();
  await store.deletePhoto(id);
  setLive({ photos: live.photos.filter((p) => p.id !== id) });
  mutatePlan((p) => ({ ...p, photoIds: p.photoIds.filter((x) => x !== id) }));
}

/** Day 0 photos skipped (consequence line shown). */
export function skipPhotos(): void {
  mutatePlan((p) => ({ ...p, photosSkipped: true }));
}

/** Stores the blind pick. */
export function setBlindPick(pick: BlindPick): void {
  mutatePlan((p) => ({ ...p, blindPick: pick }));
}

/** Stores the verdict once it is shown, so it does not change under her. */
export function setVerdict(v: Verdict): void {
  mutatePlan((p) => ({ ...p, verdict: v }));
}

/** Forgets a verdict (she retakes photos after "Can't call it"). */
export function clearVerdict(): void {
  try {
    sessionStorage.removeItem('ft-blind-order');
  } catch {
    /* ignore */
  }
  mutatePlan((p) => {
    const { verdict: _v, blindPick: _b, ...rest } = p;
    return rest;
  });
}

/** Marks the trial stopped; the reason is kept on this phone only. */
export function stopTrial(reason?: StopReason): void {
  const on = activeToday();
  mutatePlan((p) => ({ ...p, stopped: reason ? { on, reason } : { on } }));
}

/** Clears "stopped" so she can start again at Day 0. */
export function restartTrial(): void {
  mutatePlan((p) => {
    const { stopped: _s, day0: _d, verdict: _v, blindPick: _b, ...rest } = p;
    return { ...rest, dayLog: [], reactions: [], photoIds: [], photosSkipped: false };
  });
}

/** Stores her share choice (screen 19). The payload stays on this phone. */
export function setConsent(consent: ShareConsent): void {
  mutatePlan((p) => ({ ...p, consent }));
}

/** Deletes everything from this phone (FR-M9-03). Example data goes too. */
export async function deleteEverything(): Promise<void> {
  const store = await getStore();
  await store.deleteEverything();
  try {
    localStorage.removeItem(MEASURE_KEY);
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  setVaultMode('live');
  setLive({ plan: undefined, photos: [] });
  track('data_deleted', '15', {});
}

/* ------------------------------------------------------------------ */
/* Verdict input                                                       */
/* ------------------------------------------------------------------ */

/** Picks the photos of a moment, newest per region. */
function pairAt(photos: PhotoCapture[], moment: PhotoCapture['moment']) {
  const pick = (region: PhotoCapture['region']) =>
    photos.filter((p) => p.moment === moment && p.region === region).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
  return { underarm: pick('underarm'), innerArm: pick('inner-arm') };
}

/** True when both Day 0 photos exist. */
export function hasDay0Photos(photos: PhotoCapture[]): boolean {
  const p = pairAt(photos, 'day0');
  return !!p.underarm && !!p.innerArm;
}

/** True when both verdict photos exist. */
export function hasVerdictPhotos(photos: PhotoCapture[]): boolean {
  const p = pairAt(photos, 'verdict');
  return !!p.underarm && !!p.innerArm;
}

/** Photo change between Day 0 and the verdict photos, from the measurements kept on this phone; null without both pairs. */
export function changeOf(plan: Plan, photos: PhotoCapture[], _today?: ISODate): PhotoChange | null {
  void plan;
  const d0 = pairAt(photos, 'day0');
  const vd = pairAt(photos, 'verdict');
  const m = (p: PhotoCapture | undefined) => (p ? loadMeasure(p.id) : undefined);
  const [d0u, d0i, vdu, vdi] = [m(d0.underarm), m(d0.innerArm), m(vd.underarm), m(vd.innerArm)];
  if (!(d0u && d0i && vdu && vdi)) return null;
  const band = noiseBandFromBursts([
    { underarm: d0u.frameIta, innerArm: d0i.frameIta },
    { underarm: vdu.frameIta, innerArm: vdi.frameIta },
  ]) ?? { itaDeg: FALLBACK_BAND_ITA, source: 'kill-test-default' as const, samples: 0 };
  return computeChange(
    { underarm: d0u.measurement, innerArm: d0i.measurement },
    { underarm: vdu.measurement, innerArm: vdi.measurement },
    band,
  );
}

/** Runs the verdict engine on the real photos and the stored picks. Example mode keeps Riya's seeded verdict. */
export function computeVerdict(plan: Plan, photos: PhotoCapture[], today: ISODate, shadeNow?: Plan['fit']['shade']): Verdict | undefined {
  const trial = clockFor(plan, today);
  if (!trial) return undefined;
  const product = productOf(plan);
  return runVerdict({
    trial,
    reactions: plan.reactions,
    change: changeOf(plan, photos, today),
    blindPick: plan.blindPick ?? null,
    ...(plan.fit.shade ? { shadeDay0: plan.fit.shade } : {}),
    ...(shadeNow ? { shadeNow } : {}),
    trialProductStung: plan.shelf.some((i) => i.catalogId === product && i.stung),
    hormonePattern: plan.fitResult.hormoneNote,
    killTestPassed: KILL_TEST_PASSED,
    today,
  });
}

/* ------------------------------------------------------------------ */
/* The hook                                                            */
/* ------------------------------------------------------------------ */

/** What a screen reads. */
export interface TrialView {
  /** The vault has been read (live) or the example is loaded. */
  ready: boolean;
  mode: AppMode;
  isExample: boolean;
  plan: Plan | undefined;
  today: ISODate;
  /** Trial clock; undefined before Day 0. */
  trial: TrialState | undefined;
  product: BodywiseProductId;
  /** Her real photos (empty in the example, which shows staged placeholders). */
  photos: PhotoCapture[];
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The active plan, its clock and photos. Subscribes to changes. */
export function useTrial(): TrialView {
  const snap = useSyncExternalStore(subscribe, () => live, () => live);
  const example = useExample();
  const tour = useTour();
  if (!snap.ready && !loading) void loadLive();
  const plan = example ? example.plan : snap.plan;
  // The demo's day control moves "today" for her own trial; reading `tour` re-renders on a jump.
  const today = example ? example.today : tour.on ? tourToday() : localToday();
  return useMemo<TrialView>(
    () => ({
      ready: example ? true : snap.ready,
      mode: example ? 'example' : 'live',
      isExample: !!example,
      plan,
      today,
      trial: plan ? clockFor(plan, today) : undefined,
      product: plan ? productOf(plan) : DEFAULT_ANCHOR_PRODUCT,
      photos: example ? [] : snap.photos,
    }),
    [example, snap, plan, today],
  );
}

/** Object URL for a stored photo, cached so screens can show it. Revoked never (small, per page load). */
const urls = new Map<string, string>();
export function photoUrl(photo: PhotoCapture | undefined): string | undefined {
  if (!photo) return undefined;
  let url = urls.get(photo.id);
  if (!url) {
    url = URL.createObjectURL(photo.blob);
    urls.set(photo.id, url);
  }
  return url;
}
