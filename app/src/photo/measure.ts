/**
 * Pure measurement pipeline on decoded pixels: quality gate, white-card correction, robust Lab/ITA°,
 * burst summary, noise band, change. No DOM, no network. Runs in the worker (measure.worker.ts)
 * and directly in tests. Owner: E3.
 */
import type { CardCorrection, Lab, NoiseBand, PhotoChange, PhotoFailure, PhotoMeasurement, PhotoQuality } from '../contracts';
import {
  cardAtPoint,
  cardGains,
  clippedShare,
  findCard,
  itaDeg,
  laplacianVariance,
  linearToLab,
  luminance,
  mean,
  median,
  regionLabs,
  robustLab,
  sd,
  type CardFind,
  type Pixels,
} from './colour';
import { CARD, CARD_TARGET_LINEAR, COMPARABLE_CARD_L_MAX, GATE, GUIDE_OVAL, MEASURE_OVAL_SCALE, NOISE_K, TRIM_PERCENTILES } from '../engine/config';

/** Options for one frame. */
export interface AnalyseOptions {
  /** User-tapped card location (fractions of the frame), used when no card is found automatically. */
  cardPoint?: { x: number; y: number };
}

/** One analysed frame. */
export interface FrameResult {
  lab: Lab;
  itaDeg: number;
  quality: PhotoQuality;
  correction: CardCorrection | null;
  sampleCount: number;
  /** Variance of the Laplacian (for "keep the sharpest frame"). */
  sharpness: number;
}

/** Relative luminance Y from L*. */
function labToY(L: number): number {
  const fy = (L + 16) / 116;
  return fy ** 3 > 216 / 24389 ? fy ** 3 : (116 * fy - 16) / (24389 / 27);
}

/** Order the fix lines show in (copy s08.q.*). */
const FAILURE_ORDER: PhotoFailure[] = ['dark', 'blur', 'card-missing', 'warm'];

/** Quality gate + white-card correction + robust Lab/ITA° for one frame. */
export function analyseFrame(img: Pixels, opts: AnalyseOptions = {}): FrameResult {
  const oval = GUIDE_OVAL;
  const raw = robustLab(regionLabs(img, oval, MEASURE_OVAL_SCALE, [1, 1, 1]), TRIM_PERCENTILES);
  const skinY = labToY(raw.lab.L);

  let card: CardFind | null = findCard(img, oval, skinY, CARD);
  if (!card && opts.cardPoint) card = cardAtPoint(img, opts.cardPoint, CARD.blockFrac);

  const gains: [number, number, number] = card ? cardGains(card.rgb, CARD_TARGET_LINEAR) : [1, 1, 1];
  const { lab, count } = card ? robustLab(regionLabs(img, oval, MEASURE_OVAL_SCALE, gains), TRIM_PERCENTILES) : raw;

  const cardY = card ? luminance(...card.rgb) : NaN;
  const sharpness = laplacianVariance(img, oval);
  const lightOk = (card ? cardY >= GATE.cardYMin : skinY >= GATE.skinYMin) && clippedShare(img, oval) <= GATE.clipShareMax;
  const focusOk = sharpness >= GATE.laplacianVarMin;
  const cardFound = card !== null;
  const colourOk = card ? card.rgb[0] / Math.max(card.rgb[2], 1e-6) <= GATE.warmRbMax : true;

  const bad: Record<PhotoFailure, boolean> = { dark: !lightOk, blur: !focusOk, 'card-missing': !cardFound, warm: !colourOk };
  const quality: PhotoQuality = { lightOk, focusOk, cardFound, colourOk, failures: FAILURE_ORDER.filter((k) => bad[k]) };
  const correction: CardCorrection | null = card ? { gains, cardLab: linearToLab(...card.rgb) } : null;
  return { lab, itaDeg: itaDeg(lab), quality, correction, sampleCount: count, sharpness };
}

/** Summary of a burst of frames at one site. */
export interface BurstSummary {
  /** Median Lab of the frames. */
  lab: Lab;
  /** Median ITA° of the frames. */
  itaDeg: number;
  /** Sample SD of ITA° across the frames (0 for a single frame): the within-burst spread. */
  spread: number;
  /** Frames used. */
  frames: number;
  /** Quality and correction of the sharpest frame. */
  quality: PhotoQuality;
  correction: CardCorrection | null;
  sampleCount: number;
}

/** Combines a burst: median ITA°, within-burst spread, quality of the sharpest frame (architecture, pipeline 2). */
export function summariseBurst(frames: readonly FrameResult[]): BurstSummary {
  if (frames.length === 0) throw new Error('summariseBurst: no frames');
  const sharpest = frames.reduce((best, f) => (f.sharpness > best.sharpness ? f : best));
  const lab: Lab = {
    L: median(frames.map((f) => f.lab.L)),
    a: median(frames.map((f) => f.lab.a)),
    b: median(frames.map((f) => f.lab.b)),
  };
  return {
    lab,
    itaDeg: median(frames.map((f) => f.itaDeg)),
    spread: sd(frames.map((f) => f.itaDeg)),
    frames: frames.length,
    quality: sharpest.quality,
    correction: sharpest.correction,
    sampleCount: sharpest.sampleCount,
  };
}

/** Within-burst ITA° values for one underarm + inner-arm capture pair. */
export interface BurstPair {
  underarm: readonly number[];
  innerArm: readonly number[];
}

/**
 * Noise band from the spread within bursts (decisions B8), optionally widened by the spread across
 * sessions. Per-frame variances of both sites are pooled over all given pairs (Day 0 and verdict);
 * the gap's sigma is sqrt(varU + varI); a change is the difference of two gaps, so sigma_change =
 * sqrt(2) * sigma_gap; band = NOISE_K * sigma_change. `acrossSessionGapSd` (SD of the gap over repeat
 * sessions in the same spot) replaces the burst figure when larger. Null if no burst has 2+ frames
 * and no session spread is given. Frames of one burst share hand position and light, so this is a
 * floor; the kill test measures the realistic figure.
 */
export function noiseBandFromBursts(pairs: readonly BurstPair[], acrossSessionGapSd?: number): NoiseBand | null {
  const vU: number[] = [];
  const vI: number[] = [];
  for (const p of pairs) {
    if (p.underarm.length >= 2) vU.push(sd(p.underarm) ** 2);
    if (p.innerArm.length >= 2) vI.push(sd(p.innerArm) ** 2);
  }
  const burstGapSigma = vU.length && vI.length ? Math.sqrt(mean(vU) + mean(vI)) : 0;
  const gapSigma = Math.max(burstGapSigma, acrossSessionGapSd ?? 0);
  if (gapSigma === 0 && !(vU.length && vI.length)) return null;
  return { itaDeg: NOISE_K * Math.SQRT2 * gapSigma, source: 'day0-pair', samples: Math.min(vU.length, vI.length) || 1 };
}

/** Gap = ITA°(inner arm) - ITA°(underarm). */
export function gapOf(m: { underarm: Pick<PhotoMeasurement, 'itaDeg'>; innerArm: Pick<PhotoMeasurement, 'itaDeg'> }): number {
  return m.innerArm.itaDeg - m.underarm.itaDeg;
}

/** Gap now vs Day 0, judged against the noise band. */
export function computeChange(
  day0: { underarm: PhotoMeasurement; innerArm: PhotoMeasurement },
  now: { underarm: PhotoMeasurement; innerArm: PhotoMeasurement },
  band: NoiseBand,
): PhotoChange {
  const gapDay0 = gapOf(day0);
  const gapNow = gapOf(now);
  const change = gapDay0 - gapNow;
  const all = [day0.underarm, day0.innerArm, now.underarm, now.innerArm];
  const cardL = (ms: PhotoMeasurement[]): number => mean(ms.map((m) => m.correction?.cardLab.L ?? NaN));
  const lightDiff = Math.abs(cardL([day0.underarm, day0.innerArm]) - cardL([now.underarm, now.innerArm]));
  const comparable =
    all.every((m) => m.correction !== null && m.quality.failures.length === 0) && lightDiff <= COMPARABLE_CARD_L_MAX;
  const beyondBand = comparable && change > band.itaDeg;
  const darkerBeyondBand = comparable && change < -band.itaDeg;
  const bucket = !comparable ? 'not-comparable' : beyondBand ? 'beyond-band' : darkerBeyondBand ? 'darker-beyond-band' : 'within-band';
  return { gapDay0, gapNow, change, band, beyondBand, darkerBeyondBand, comparable, bucket };
}
