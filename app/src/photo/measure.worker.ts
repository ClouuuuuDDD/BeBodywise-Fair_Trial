/// <reference lib="webworker" />
/**
 * Web Worker: colour maths off the main thread (PRD performance note). Receives decoded RGBA pixels,
 * returns a FrameResult. Never touches the network. Owner: E3.
 */
import { analyseFrame, type AnalyseOptions, type FrameResult } from './measure';

export interface WorkerRequest {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
  options?: AnalyseOptions;
}
export type WorkerResponse = { id: number; ok: true; result: FrameResult } | { id: number; ok: false; error: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, width, height, buffer, options } = e.data;
  try {
    const result = analyseFrame({ width, height, data: new Uint8ClampedArray(buffer) }, options);
    (self as DedicatedWorkerGlobalScope).postMessage({ id, ok: true, result } satisfies WorkerResponse);
  } catch (err) {
    (self as DedicatedWorkerGlobalScope).postMessage({ id, ok: false, error: String(err) } satisfies WorkerResponse);
  }
};
