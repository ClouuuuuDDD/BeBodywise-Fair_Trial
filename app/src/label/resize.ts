import { LABEL_MAX_EDGE_PX } from '../engine/config';

export const LABEL_JPEG_QUALITY = 0.8;

/** Size after scaling the long side down to maxEdge (never up). */
export function targetSize(width: number, height: number, maxEdge = LABEL_MAX_EDGE_PX): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge || long <= 0) return { width, height };
  const scale = maxEdge / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface ResizedPhoto {
  blob: Blob;
  /** Base64 of the JPEG, without a data: prefix. */
  base64: string;
  width: number;
  height: number;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Resizes to LABEL_MAX_EDGE_PX on the long side and re-encodes as JPEG (quality 0.8). Browser only. */
export async function resizeLabelPhoto(photo: Blob): Promise<ResizedPhoto> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  const { width, height } = targetSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', LABEL_JPEG_QUALITY),
  );
  return { blob, base64: await blobToBase64(blob), width, height };
}
