/**
 * Camera capture helpers: start the rear camera, grab a burst of frames cropped to the guide's
 * 3:4 box. Photos stay on the device: nothing here touches the network. Owner: E3.
 */
import { BURST_FRAMES, BURST_GAP_MS } from '../engine/config';

/** Aspect ratio (width / height) of the camera box and of every stored frame. */
export const FRAME_ASPECT = 3 / 4;

/** True if getUserMedia exists (needs https or localhost). */
export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
}

/** Starts the rear camera. Throws if denied or missing. Call from a tap. */
export function startCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
    audio: false,
  });
}

/**
 * Starts playback of the camera preview. Resolves false when the browser refuses (Android in-app browsers and some
 * Chrome cases only allow it from a tap): the screen then shows "Tap to start the camera".
 */
export async function playVideo(video: HTMLVideoElement): Promise<boolean> {
  video.muted = true; // muted is what makes playback allowed without sound; set it on the element itself
  try {
    await video.play();
  } catch {
    return false;
  }
  return !video.paused;
}

/** One fresh frame after playback starts, so a capture is never the frozen first frame. */
export function nextFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => resolve());
    else setTimeout(resolve, 120);
    setTimeout(resolve, 500); // never wait long
  });
}

/** True inside an app's built-in browser (Instagram, Facebook, Gmail and other Android WebViews), where the camera often fails. */
export function inAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /; wv\)|FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat|Twitter/i.test(navigator.userAgent);
}

/** Stops all tracks of a stream. */
export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function frameToBlob(video: HTMLVideoElement): Promise<Blob> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  let sw = vw;
  let sh = vh;
  if (vw / vh > FRAME_ASPECT) sw = vh * FRAME_ASPECT;
  else sh = vw / FRAME_ASPECT;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  const outH = Math.min(1280, Math.round(sh));
  const outW = Math.round(outH * FRAME_ASPECT);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no 2d canvas'));
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.92));
}

/** Grabs BURST_FRAMES frames BURST_GAP_MS apart from a playing video. The caller keeps the burst; nothing is uploaded. */
export async function captureBurst(video: HTMLVideoElement, frames = BURST_FRAMES, gapMs = BURST_GAP_MS): Promise<Blob[]> {
  const out: Blob[] = [];
  for (let i = 0; i < frames; i++) {
    out.push(await frameToBlob(video));
    if (i < frames - 1) await wait(gapMs);
  }
  return out;
}
