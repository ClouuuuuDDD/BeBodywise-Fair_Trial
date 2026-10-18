/**
 * Pure colour maths and image statistics. No DOM, no React, no network. Owner: E3.
 * sRGB -> linear -> XYZ (D65) -> CIELAB -> ITA°.
 */
import type { Lab } from '../contracts';

/** D65 reference white, XYZ scaled so Y = 1. */
export const D65 = { X: 0.95047, Y: 1, Z: 1.08883 } as const;

/** sRGB 0-255 channel to linear 0-1. */
export function srgbToLinear(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear 0-1 to sRGB 0-255 (clamped). */
export function linearToSrgb(c: number): number {
  const v = Math.min(1, Math.max(0, c));
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
}

/** Linear sRGB to XYZ (D65). */
export function linearToXyz(r: number, g: number, b: number): [number, number, number] {
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

const EPS = 216 / 24389;
const KAPPA = 24389 / 27;
function f(t: number): number {
  return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
}

/** XYZ (D65, Y = 1 white) to CIELAB. */
export function xyzToLab(X: number, Y: number, Z: number): Lab {
  const fx = f(X / D65.X);
  const fy = f(Y / D65.Y);
  const fz = f(Z / D65.Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Linear sRGB (0-1) to CIELAB. */
export function linearToLab(r: number, g: number, b: number): Lab {
  const [X, Y, Z] = linearToXyz(r, g, b);
  return xyzToLab(X, Y, Z);
}

/** sRGB (0-255) to CIELAB. */
export function srgbToLab(r: number, g: number, b: number): Lab {
  return linearToLab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
}

/**
 * ITA° = atan((L* - 50) / b*) * 180 / pi. Higher = lighter skin.
 * atan2 equals atan for b* > 0 (all skin) and stays defined at b* = 0.
 */
export function itaDeg(lab: Lab): number {
  return (Math.atan2(lab.L - 50, lab.b) * 180) / Math.PI;
}

/* ---------- statistics ---------- */

/** Value at fraction p (0-1) of a sorted copy, linear interpolation. NaN for an empty list. */
export function quantile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((x, y) => x - y);
  const pos = Math.min(1, Math.max(0, p)) * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return (s[lo] as number) + ((s[hi] as number) - (s[lo] as number)) * (pos - lo);
}

/** Median. */
export function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

/** Mean. NaN for an empty list. */
export function mean(values: readonly number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : NaN;
}

/** Sample standard deviation (n - 1). 0 for fewer than two values. */
export function sd(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

/* ---------- images ---------- */

/** RGBA pixels, as from canvas ImageData. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** Normalised ellipse (fractions of the frame). */
export interface Oval {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** True if pixel (x, y) lies inside the oval scaled by `scale`. */
export function inOval(x: number, y: number, w: number, h: number, oval: Oval, scale = 1): boolean {
  const dx = (x + 0.5) / w - oval.cx;
  const dy = (y + 0.5) / h - oval.cy;
  const rx = oval.rx * scale;
  const ry = oval.ry * scale;
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

/** Variance of the Laplacian of the grey image inside the oval. Low = blurry. */
export function laplacianVariance(img: Pixels, oval: Oval): number {
  const { width: w, height: h, data } = img;
  const x0 = Math.max(1, Math.floor((oval.cx - oval.rx) * w));
  const x1 = Math.min(w - 2, Math.ceil((oval.cx + oval.rx) * w));
  const y0 = Math.max(1, Math.floor((oval.cy - oval.ry) * h));
  const y1 = Math.min(h - 2, Math.ceil((oval.cy + oval.ry) * h));
  // Only pixels well inside the oval: the oval's rim is a skin/background edge, not texture.
  const inside = (x: number, y: number): boolean => inOval(x, y, w, h, oval, 0.85);
  const grey = (x: number, y: number): number => {
    const i = (y * w + x) * 4;
    return 0.299 * (data[i] as number) + 0.587 * (data[i + 1] as number) + 0.114 * (data[i + 2] as number);
  };
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      const lap = grey(x - 1, y) + grey(x + 1, y) + grey(x, y - 1) + grey(x, y + 1) - 4 * grey(x, y);
      n++;
      sum += lap;
      sumSq += lap * lap;
    }
  }
  if (n === 0) return 0;
  const m = sum / n;
  return sumSq / n - m * m;
}

/** A found (or tapped) white card. */
export interface CardFind {
  /** Median linear RGB of the card patch. */
  rgb: [number, number, number];
  /** Patch centre, fractions of the frame. */
  at: { x: number; y: number };
  /** Blocks in the patch (0 for a tapped point). */
  blocks: number;
}

/** Relative luminance Y of linear RGB. */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
}

interface Block {
  gx: number;
  gy: number;
  rgb: [number, number, number];
  luma: number;
}

/** Median linear RGB of a pixel rectangle. */
function patchMedian(img: Pixels, x0: number, y0: number, x1: number, y1: number): [number, number, number] {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = Math.max(0, y0); y < Math.min(img.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(img.width, x1); x++) {
      const i = (y * img.width + x) * 4;
      rs.push(srgbToLinear(img.data[i] as number));
      gs.push(srgbToLinear(img.data[i + 1] as number));
      bs.push(srgbToLinear(img.data[i + 2] as number));
    }
  }
  return [median(rs), median(gs), median(bs)];
}

/** Card search tuning (see engine/config CARD). */
export interface CardParams {
  blockFrac: number;
  satMax: number;
  lumaMin: number;
  nearBrightest: number;
  minBlocks: number;
  overSkin: number;
}

/**
 * Finds the white card: the largest connected patch of the brightest low-saturation blocks outside
 * the guide oval. `skinY` (linear luminance of the skin) is used to reject a card that is not
 * brighter than skin. Returns null if none. A tapped point is handled by `cardAtPoint`.
 */
export function findCard(img: Pixels, oval: Oval, skinY: number, p: CardParams): CardFind | null {
  const { width: w, height: h } = img;
  const bs = Math.max(4, Math.round(Math.min(w, h) * p.blockFrac));
  const gw = Math.floor(w / bs);
  const gh = Math.floor(h / bs);
  const cands: Block[] = [];
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (inOval(gx * bs + bs / 2, gy * bs + bs / 2, w, h, oval, 1.1)) continue;
      const rgb = patchMedian(img, gx * bs, gy * bs, gx * bs + bs, gy * bs + bs);
      const gmx = linearToSrgb(Math.max(...rgb));
      const gmn = linearToSrgb(Math.min(...rgb));
      const satG = gmx > 0 ? (gmx - gmn) / gmx : 0;
      const lumaG = linearToSrgb(luminance(...rgb)) / 255;
      if (lumaG >= p.lumaMin && satG <= p.satMax) cands.push({ gx, gy, rgb, luma: lumaG });
    }
  }
  if (cands.length < p.minBlocks) return null;
  const top = Math.max(...cands.map((c) => c.luma));
  const bright = cands.filter((c) => c.luma >= top * p.nearBrightest);
  const key = (gx: number, gy: number): number => gy * gw + gx;
  const byKey = new Map(bright.map((b) => [key(b.gx, b.gy), b]));
  const seen = new Set<number>();
  let best: Block[] = [];
  for (const start of bright) {
    if (seen.has(key(start.gx, start.gy))) continue;
    const comp: Block[] = [];
    const stack = [start];
    seen.add(key(start.gx, start.gy));
    while (stack.length) {
      const b = stack.pop() as Block;
      comp.push(b);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = key(b.gx + dx, b.gy + dy);
        const nb = byKey.get(k);
        if (nb && !seen.has(k)) {
          seen.add(k);
          stack.push(nb);
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  if (best.length < p.minBlocks) return null;
  const rgb: [number, number, number] = [
    median(best.map((b) => b.rgb[0])),
    median(best.map((b) => b.rgb[1])),
    median(best.map((b) => b.rgb[2])),
  ];
  if (luminance(...rgb) < skinY * p.overSkin) return null;
  const x = mean(best.map((b) => b.gx * bs + bs / 2)) / w;
  const y = mean(best.map((b) => b.gy * bs + bs / 2)) / h;
  return { rgb, at: { x, y }, blocks: best.length };
}

/** Card colour from a user-tapped point (fractions of the frame): median of a small patch around it. */
export function cardAtPoint(img: Pixels, point: { x: number; y: number }, blockFrac: number): CardFind {
  const r = Math.max(4, Math.round(Math.min(img.width, img.height) * blockFrac * 1.5));
  const px = Math.round(point.x * img.width);
  const py = Math.round(point.y * img.height);
  return { rgb: patchMedian(img, px - r, py - r, px + r, py + r), at: point, blocks: 0 };
}

/**
 * Per-channel linear gains that map the card to a fixed neutral white (`target`, linear). This fixes
 * the colour cast and the exposure together, so two days with different light strength compare fairly.
 */
export function cardGains(rgb: readonly [number, number, number], target: number): [number, number, number] {
  return [target / Math.max(rgb[0], 1e-6), target / Math.max(rgb[1], 1e-6), target / Math.max(rgb[2], 1e-6)];
}

/** Pixels measured in the oval (centre part), as Lab after applying gains in linear light. */
export function regionLabs(img: Pixels, oval: Oval, scale: number, gains: readonly [number, number, number]): Lab[] {
  const { width: w, height: h, data } = img;
  const out: Lab[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inOval(x, y, w, h, oval, scale)) continue;
      const i = (y * w + x) * 4;
      const r = Math.min(1, srgbToLinear(data[i] as number) * gains[0]);
      const g = Math.min(1, srgbToLinear(data[i + 1] as number) * gains[1]);
      const b = Math.min(1, srgbToLinear(data[i + 2] as number) * gains[2]);
      out.push(linearToLab(r, g, b));
    }
  }
  return out;
}

/** Robust colour of a region: drop pixels outside the L* percentile window, then the median of L*, a*, b*. */
export function robustLab(labs: readonly Lab[], trim: readonly [number, number]): { lab: Lab; count: number } {
  if (labs.length === 0) return { lab: { L: NaN, a: NaN, b: NaN }, count: 0 };
  const lo = quantile(labs.map((l) => l.L), trim[0]);
  const hi = quantile(labs.map((l) => l.L), trim[1]);
  const kept = labs.filter((l) => l.L >= lo && l.L <= hi);
  return {
    lab: { L: median(kept.map((l) => l.L)), a: median(kept.map((l) => l.a)), b: median(kept.map((l) => l.b)) },
    count: kept.length,
  };
}

/** Share of oval pixels with any channel at 250 or more. */
export function clippedShare(img: Pixels, oval: Oval): number {
  const { width: w, height: h, data } = img;
  let n = 0;
  let c = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inOval(x, y, w, h, oval)) continue;
      n++;
      const i = (y * w + x) * 4;
      if ((data[i] as number) >= 250 || (data[i + 1] as number) >= 250 || (data[i + 2] as number) >= 250) c++;
    }
  }
  return n ? c / n : 0;
}
