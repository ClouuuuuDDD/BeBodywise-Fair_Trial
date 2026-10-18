/**
 * Turns a camera burst into a stored photo: measure in the worker, apply the quality gate, keep the
 * sharpest frame, save the Blob and the numbers on this phone. Nothing here leaves the phone.
 */
import type { PhotoCapture, PhotoFailure, PhotoMoment, PhotoRegion } from '../../../contracts';
import { analyseBlob } from '../../../photo/client';
import { summariseBurst } from '../../../photo/measure';
import { addPhoto, removePhoto, saveMeasure } from '../../../state/trial';
import { tourToday } from '../../../state/tour';
import { track } from '../../../state/vault';

/** What the gate said. */
export type CaptureOutcome = { ok: true; id: string } | { ok: false; failures: PhotoFailure[] };

const attempts = new Map<string, number>();

/** Random id that starts with the moment, so the plan's photo list can be read at a glance. */
function photoId(moment: PhotoMoment, region: PhotoRegion): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now());
  return `${moment}-${region}-${rand}`;
}

async function sizeOf(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(blob);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
}

/** Measures a burst, runs the gate, and stores the photo when it passes. `previous` is replaced on success (retake). */
export async function processCapture(
  frames: Blob[],
  region: PhotoRegion,
  moment: PhotoMoment,
  previous: PhotoCapture[],
): Promise<CaptureOutcome> {
  const key = `${moment}-${region}`;
  const attempt = (attempts.get(key) ?? 0) + 1;
  attempts.set(key, attempt);

  const results = await Promise.all(frames.map((f) => analyseBlob(f)));
  const summary = summariseBurst(results);
  const failures = summary.quality.failures;
  track('photo_taken', '08', { session: moment, site: region, pass: failures.length === 0, failures, attempt });
  if (failures.length > 0) return { ok: false, failures };

  const sharpest = results.reduce((best, r, i) => (r.sharpness > (results[best]?.sharpness ?? -1) ? i : best), 0);
  const kept = frames[sharpest] ?? frames[0];
  if (!kept) return { ok: false, failures: ['blur'] };

  const id = photoId(moment, region);
  const { width, height } = await sizeOf(kept);
  const pairId = `${moment}-${tourToday()}`;
  await addPhoto({ id, region, moment, takenAt: new Date().toISOString(), blob: kept, width, height, pairId });
  saveMeasure(id, {
    measurement: {
      photoId: id,
      region,
      lab: summary.lab,
      itaDeg: summary.itaDeg,
      quality: summary.quality,
      correction: summary.correction,
      sampleCount: summary.sampleCount,
      burstSpreadItaDeg: summary.spread,
      burstFrames: summary.frames,
    },
    frameIta: results.map((r) => r.itaDeg),
  });
  for (const p of previous) if (p.moment === moment && p.region === region && p.id !== id) await removePhoto(p.id);
  return { ok: true, id };
}

/** The newest stored photo for a moment and region. */
export function latest(photos: PhotoCapture[], moment: PhotoMoment, region: PhotoRegion): PhotoCapture | undefined {
  return photos.filter((p) => p.moment === moment && p.region === region).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
}
