/**
 * Main-thread side: decode a Blob, downscale, and send the pixels to the worker. No network calls
 * anywhere in app/src/photo/ (photos stay on the device). Owner: E3.
 */
import type { FrameResult, AnalyseOptions } from './measure';
import { analyseFrame } from './measure';
import { PHOTO_MEASURE_EDGE_PX } from '../engine/config';
import type { WorkerRequest, WorkerResponse } from './measure.worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: FrameResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  worker = new Worker(new URL('./measure.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error));
  };
  worker.onerror = () => {
    for (const p of pending.values()) p.reject(new Error('photo worker failed'));
    pending.clear();
    worker = null;
  };
  return worker;
}

/** Decodes a Blob and downscales it (long edge PHOTO_MEASURE_EDGE_PX) to RGBA pixels. */
export async function decodeBlob(blob: Blob): Promise<ImageData> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, PHOTO_MEASURE_EDGE_PX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d canvas');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return ctx.getImageData(0, 0, w, h);
}

/** Analyses one frame in the worker (falls back to the main thread if workers are unavailable). */
export async function analyseBlob(blob: Blob, options?: AnalyseOptions): Promise<FrameResult> {
  const img = await decodeBlob(blob);
  const w = getWorker();
  if (!w) return analyseFrame(img, options);
  const id = nextId++;
  return new Promise<FrameResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const buffer = img.data.buffer as ArrayBuffer;
    const msg: WorkerRequest = { id, width: img.width, height: img.height, buffer, options };
    w.postMessage(msg, [buffer]);
  });
}
