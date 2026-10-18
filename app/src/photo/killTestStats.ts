/**
 * Kill-test statistics. Pure. Owner: E3.
 * Question answered: with NO real change, how much does the measured gap (inner arm minus underarm,
 * in ITA°) move between repeat sessions, per lighting and skin tone? The noise band is
 * NOISE_K * sqrt(2) * sigma_gap, the same rule the app uses (noiseBandFromBursts).
 */
import { mean, median, sd } from './colour';
import { KILL_TEST_MAX_BAND_ITA_DEG, KILL_TEST_MIN_SESSIONS, NOISE_K } from '../engine/config';

export type Lighting = 'daylight' | 'indoor-warm' | 'indoor-cool';
export type Site = 'underarm' | 'inner-arm';

/** One measured photo with its labels. Photos sharing tone, light, session and site form one burst. */
export interface LabShot {
  file: string;
  tone: string;
  light: Lighting;
  /** Session id: a repeat of the same spot, e.g. "1", "2" (same arm, same spot, no product between). */
  session: string;
  site: Site;
  itaDeg: number;
  /** Quality failures of the photo (empty = passed the gate). */
  failures: string[];
}

export interface Capture {
  tone: string;
  light: Lighting;
  session: string;
  site: Site;
  itaDeg: number;
  frames: number;
  /** SD of ITA° across the burst frames; 0 when one frame. */
  burstSd: number;
  failures: string[];
}

export interface GapPoint {
  tone: string;
  light: Lighting;
  session: string;
  gap: number;
  /** Burst SDs of the two sites, when both had 2+ frames. */
  burstSdUnder: number | null;
  burstSdInner: number | null;
}

export interface SpreadRow {
  scope: 'condition' | 'tone-across-lights' | 'overall';
  label: string;
  tone: string;
  light: Lighting | 'all';
  /** Sessions (gap values) behind the row. */
  n: number;
  meanGap: number;
  /** SD of the gap across sessions. */
  sigmaGap: number;
  /** Noise band in ITA° from the across-session spread. */
  band: number;
  /** Noise band from within-burst spread only (what the app can measure on the phone); null if no bursts. */
  burstBand: number | null;
  /** True if n is enough to trust the spread. */
  enough: boolean;
  /** band <= threshold; null if not enough data. */
  pass: boolean | null;
}

export interface KillTestReport {
  threshold: number;
  rows: SpreadRow[];
  overall: SpreadRow | null;
  /** True if overall and every row with enough data are within the threshold. Null if no row has enough data. */
  passed: boolean | null;
  note: string;
}

/** Band for a given sigma of the gap. */
export function bandFromSigma(sigmaGap: number): number {
  return NOISE_K * Math.SQRT2 * sigmaGap;
}

/** Groups photos into bursts per (tone, light, session, site). */
export function toCaptures(shots: readonly LabShot[]): Capture[] {
  const groups = new Map<string, LabShot[]>();
  for (const s of shots) {
    const k = [s.tone, s.light, s.session, s.site].join('|');
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.values()].map((g) => {
    const first = g[0] as LabShot;
    const itas = g.map((x) => x.itaDeg);
    return {
      tone: first.tone,
      light: first.light,
      session: first.session,
      site: first.site,
      itaDeg: median(itas),
      frames: g.length,
      burstSd: sd(itas),
      failures: [...new Set(g.flatMap((x) => x.failures))],
    };
  });
}

/** Pairs underarm and inner-arm captures of the same tone, light and session into gap points. */
export function toGaps(captures: readonly Capture[]): GapPoint[] {
  const out: GapPoint[] = [];
  const key = (c: Capture): string => [c.tone, c.light, c.session].join('|');
  const under = new Map(captures.filter((c) => c.site === 'underarm').map((c) => [key(c), c]));
  for (const inner of captures.filter((c) => c.site === 'inner-arm')) {
    const u = under.get(key(inner));
    if (!u) continue;
    out.push({
      tone: inner.tone,
      light: inner.light,
      session: inner.session,
      gap: inner.itaDeg - u.itaDeg,
      burstSdUnder: u.frames >= 2 ? u.burstSd : null,
      burstSdInner: inner.frames >= 2 ? inner.burstSd : null,
    });
  }
  return out;
}

function burstBandOf(points: readonly GapPoint[]): number | null {
  const u = points.flatMap((p) => (p.burstSdUnder === null ? [] : [p.burstSdUnder ** 2]));
  const i = points.flatMap((p) => (p.burstSdInner === null ? [] : [p.burstSdInner ** 2]));
  return u.length && i.length ? bandFromSigma(Math.sqrt(mean(u) + mean(i))) : null;
}

function row(
  scope: SpreadRow['scope'],
  label: string,
  tone: string,
  light: SpreadRow['light'],
  points: readonly GapPoint[],
  threshold: number,
  sigmaOverride?: number,
): SpreadRow {
  const gaps = points.map((p) => p.gap);
  const sigmaGap = sigmaOverride ?? sd(gaps);
  const band = bandFromSigma(sigmaGap);
  const enough = gaps.length >= KILL_TEST_MIN_SESSIONS;
  return {
    scope,
    label,
    tone,
    light,
    n: gaps.length,
    meanGap: mean(gaps),
    sigmaGap,
    band,
    burstBand: burstBandOf(points),
    enough,
    pass: enough ? band <= threshold : null,
  };
}

/** Full report: per condition (tone x light), per tone across lights, and overall (pooled within-condition variance). */
export function killTestReport(shots: readonly LabShot[], threshold = KILL_TEST_MAX_BAND_ITA_DEG): KillTestReport {
  const gaps = toGaps(toCaptures(shots));
  const rows: SpreadRow[] = [];
  const conds = new Map<string, GapPoint[]>();
  for (const g of gaps) conds.set(`${g.tone}|${g.light}`, [...(conds.get(`${g.tone}|${g.light}`) ?? []), g]);
  for (const [k, pts] of conds) {
    const [tone, light] = k.split('|') as [string, Lighting];
    rows.push(row('condition', `${tone}, ${light}`, tone, light, pts, threshold));
  }
  const tones = [...new Set(gaps.map((g) => g.tone))];
  for (const tone of tones) {
    const pts = gaps.filter((g) => g.tone === tone);
    if (new Set(pts.map((p) => p.light)).size >= 2) rows.push(row('tone-across-lights', `${tone}, all lights`, tone, 'all', pts, threshold));
  }
  // Pooled within-condition variance, weighted by degrees of freedom.
  let ss = 0;
  let df = 0;
  for (const pts of conds.values()) {
    if (pts.length >= 2) {
      ss += sd(pts.map((p) => p.gap)) ** 2 * (pts.length - 1);
      df += pts.length - 1;
    }
  }
  const overall = df > 0 ? row('overall', 'Overall (pooled)', 'all', 'all', gaps, threshold, Math.sqrt(ss / df)) : null;
  if (overall) {
    overall.enough = df >= KILL_TEST_MIN_SESSIONS - 1;
    overall.pass = overall.enough ? overall.band <= threshold : null;
  }
  const judged = [...rows, ...(overall ? [overall] : [])].filter((r) => r.pass !== null);
  const passed = judged.length === 0 ? null : judged.every((r) => r.pass === true);
  const note =
    passed === null
      ? `Not enough sessions yet: each condition needs at least ${KILL_TEST_MIN_SESSIONS} sessions with both photos.`
      : passed
        ? 'Measurement may lead the verdict (placeholder threshold; set KILL_TEST_PASSED only with the team).'
        : 'Too noisy: the blind pick leads the verdict and measurement is supporting only.';
  return { threshold, rows, overall, passed, note };
}

/** CSV of the per-photo table. */
export function shotsToCsv(shots: readonly LabShot[]): string {
  const head = 'file,tone,light,session,site,ita_deg,failures';
  const lines = shots.map((s) =>
    [s.file, s.tone, s.light, s.session, s.site, s.itaDeg.toFixed(2), s.failures.join('+')].map(csvCell).join(','),
  );
  return [head, ...lines].join('\n');
}

/** CSV of the spread table. */
export function reportToCsv(r: KillTestReport): string {
  const head = 'scope,label,n,mean_gap,sigma_gap,band_ita_deg,burst_band_ita_deg,enough,pass';
  const rows = [...r.rows, ...(r.overall ? [r.overall] : [])].map((x) =>
    [
      x.scope,
      x.label,
      x.n,
      x.meanGap.toFixed(2),
      x.sigmaGap.toFixed(2),
      x.band.toFixed(2),
      x.burstBand === null ? '' : x.burstBand.toFixed(2),
      x.enough,
      x.pass === null ? '' : x.pass,
    ]
      .map(csvCell)
      .join(','),
  );
  return [head, ...rows].join('\n');
}

function csvCell(v: unknown): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
