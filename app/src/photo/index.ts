/**
 * Photo lab public API. Owner: E3.
 * Camera guide (getUserMedia), quality gate, white-card correction, sRGB -> linear -> XYZ (D65) ->
 * CIELAB -> ITA° in a Web Worker, noise band. Skin pixels never leave the phone: nothing in this
 * folder makes a network call.
 * Types: PhotoCapture, PhotoMeasurement, PhotoQuality, CardCorrection, NoiseBand, PhotoChange in contracts.
 */
import type { Lab, NoiseBand, PhotoChange, PhotoMeasurement } from '../contracts';
import { analyseBlob } from './client';
import { itaDeg as itaFromLab } from './colour';
import { computeChange, summariseBurst, type BurstSummary } from './measure';

export { CameraCapture } from './CameraCapture';
export { fixLines, FIX_LINE } from './copy';
export { noiseBandFromBursts, summariseBurst, type BurstPair, type BurstSummary } from './measure';

/** ITA° = atan((L* - 50) / b*) * 180 / pi. Higher = lighter. */
export function itaDeg(lab: Lab): number {
  return itaFromLab(lab);
}

/** Measures one photo's guide-oval region after card correction, in a worker. */
export async function measurePhoto(
  photo: Blob,
  cardPoint?: { x: number; y: number },
): Promise<Omit<PhotoMeasurement, 'photoId' | 'region'>> {
  const r = await analyseBlob(photo, { cardPoint });
  return {
    lab: r.lab,
    itaDeg: r.itaDeg,
    quality: r.quality,
    correction: r.correction,
    sampleCount: r.sampleCount,
    burstSpreadItaDeg: 0,
    burstFrames: 1,
  };
}

/** Measures a capture's burst of frames: median ITA°, within-burst spread, quality of the sharpest frame. */
export async function measureBurst(frames: readonly Blob[], cardPoint?: { x: number; y: number }): Promise<BurstSummary> {
  return summariseBurst(await Promise.all(frames.map((f) => analyseBlob(f, { cardPoint }))));
}

/** Gap = ITA°(inner arm) - ITA°(underarm); change = gapDay0 - gapNow, judged against the band. */
export function photoChange(
  day0: { underarm: PhotoMeasurement; innerArm: PhotoMeasurement },
  now: { underarm: PhotoMeasurement; innerArm: PhotoMeasurement },
  band: NoiseBand,
): PhotoChange {
  return computeChange(day0, now, band);
}
