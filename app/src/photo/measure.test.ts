import { describe, expect, it } from 'vitest';
import type { PhotoMeasurement, PhotoQuality } from '../contracts';
import { linearToSrgb, srgbToLinear, type Pixels } from './colour';
import { analyseFrame, computeChange, noiseBandFromBursts, summariseBurst, type FrameResult } from './measure';
import { GUIDE_OVAL } from '../engine/config';

type RGB = [number, number, number];

/** Deterministic pseudo-noise in [-1, 1]. */
function rnd(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Synthetic frame: grey wall, skin in the guide oval (with texture), white card bottom right.
 * `cast` multiplies linear channels (a coloured light); `gain` is overall exposure; `blur` smooths texture.
 */
function scene(opts: { skin: RGB; cast?: RGB; gain?: number; card?: boolean; texture?: number; w?: number; h?: number }): Pixels {
  const w = opts.w ?? 240;
  const h = opts.h ?? 320;
  const cast = opts.cast ?? [1, 1, 1];
  const gain = opts.gain ?? 1;
  const tex = opts.texture ?? 6;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w - GUIDE_OVAL.cx;
      const dy = (y + 0.5) / h - GUIDE_OVAL.cy;
      const inOval = (dx * dx) / GUIDE_OVAL.rx ** 2 + (dy * dy) / GUIDE_OVAL.ry ** 2 <= 1;
      const inCard = (opts.card ?? true) && x > w * 0.72 && y > h * 0.8 && x < w * 0.97 && y < h * 0.97;
      let base: RGB = [90, 100, 95]; // wall, sRGB
      if (inOval) base = opts.skin;
      if (inCard) base = [235, 235, 235];
      const n = inOval ? rnd(x * 7 + y * 131) * tex : 0;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const lin = srgbToLinear(Math.min(255, Math.max(0, (base[c] as number) + n))) * (cast[c] as number) * gain;
        data[i + c] = Math.round(linearToSrgb(lin));
      }
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const SKIN: RGB = [190, 140, 115];

describe('analyseFrame', () => {
  it('finds the card, passes the gate, returns a plausible ITA°', () => {
    const r = analyseFrame(scene({ skin: SKIN }));
    expect(r.quality.cardFound).toBe(true);
    expect(r.quality.failures).toEqual([]);
    expect(r.correction).not.toBeNull();
    expect(r.itaDeg).toBeGreaterThan(0);
    expect(r.itaDeg).toBeLessThan(60);
  });

  it('card correction removes a coloured light', () => {
    const neutral = analyseFrame(scene({ skin: SKIN }));
    const tinted = analyseFrame(scene({ skin: SKIN, cast: [1.0, 0.9, 0.78] })); // warm bulb, within the warm limit
    expect(tinted.quality.cardFound).toBe(true);
    expect(Math.abs(tinted.itaDeg - neutral.itaDeg)).toBeLessThan(3);
    // Without correction the same tint moves ITA° a lot more (card hidden -> no gains).
    const uncorrected = analyseFrame(scene({ skin: SKIN, cast: [1.0, 0.9, 0.78], card: false }));
    expect(Math.abs(uncorrected.itaDeg - neutral.itaDeg)).toBeGreaterThan(Math.abs(tinted.itaDeg - neutral.itaDeg) + 2);
  });

  it('a known skin shift shows up as a known ITA° shift', () => {
    const base = analyseFrame(scene({ skin: [170, 120, 95] }));
    const lighter = analyseFrame(scene({ skin: [195, 145, 118] }));
    const lighterStill = analyseFrame(scene({ skin: [215, 165, 138] }));
    expect(lighter.itaDeg).toBeGreaterThan(base.itaDeg + 3);
    expect(lighterStill.itaDeg).toBeGreaterThan(lighter.itaDeg + 3);
  });

  it('flags card missing', () => {
    const r = analyseFrame(scene({ skin: SKIN, card: false }));
    expect(r.quality.cardFound).toBe(false);
    expect(r.quality.failures).toContain('card-missing');
    expect(r.correction).toBeNull();
  });

  it('the tapped-point fallback finds a card the search missed', () => {
    const img = scene({ skin: SKIN });
    const r = analyseFrame(img, { cardPoint: { x: 0.85, y: 0.88 } });
    expect(r.quality.cardFound).toBe(true);
  });

  it('flags too dark', () => {
    const r = analyseFrame(scene({ skin: SKIN, gain: 0.08 }));
    expect(r.quality.lightOk).toBe(false);
    expect(r.quality.failures).toContain('dark');
  });

  it('flags too bright (clipping)', () => {
    const r = analyseFrame(scene({ skin: [250, 235, 225], gain: 1.4 }));
    expect(r.quality.lightOk).toBe(false);
  });

  it('flags blur (flat texture) and passes a sharp one', () => {
    const sharp = analyseFrame(scene({ skin: SKIN, texture: 14 }));
    const flat = analyseFrame(scene({ skin: SKIN, texture: 0 }));
    expect(sharp.quality.focusOk).toBe(true);
    expect(flat.quality.focusOk).toBe(false);
    expect(flat.quality.failures).toContain('blur');
  });

  it('flags light too yellow', () => {
    const r = analyseFrame(scene({ skin: SKIN, cast: [1.0, 0.8, 0.45] }));
    expect(r.quality.colourOk).toBe(false);
    expect(r.quality.failures).toContain('warm');
  });

  it('orders failures dark, blur, card, warm', () => {
    const r = analyseFrame(scene({ skin: SKIN, gain: 0.08, texture: 0, card: false }));
    expect(r.quality.failures).toEqual(['dark', 'blur', 'card-missing']);
  });
});

const frame = (ita: number, sharp = 100): FrameResult => ({
  lab: { L: 60, a: 10, b: 15 },
  itaDeg: ita,
  quality: { lightOk: true, focusOk: true, cardFound: true, colourOk: true, failures: [] },
  correction: { gains: [1, 1, 1], cardLab: { L: 90, a: 0, b: 0 } },
  sampleCount: 100,
  sharpness: sharp,
});

describe('burst and noise band', () => {
  it('summarises a burst: median ITA°, spread, sharpest frame', () => {
    const s = summariseBurst([frame(20), frame(21, 300), frame(22)]);
    expect(s.itaDeg).toBe(21);
    expect(s.spread).toBeCloseTo(1, 6);
    expect(s.frames).toBe(3);
  });

  it('noise band from within-burst spread: k * sqrt(2) * sqrt(varU + varI)', () => {
    // each site: frames 10, 11, 12 -> SD 1; gap sigma sqrt(2); change sigma 2; band k*2 = 4
    const band = noiseBandFromBursts([{ underarm: [10, 11, 12], innerArm: [30, 31, 32] }]);
    expect(band).not.toBeNull();
    expect(band?.itaDeg).toBeCloseTo(4, 6);
    expect(band?.source).toBe('day0-pair');
  });

  it('is zero-free: widens with spread and with across-session spread, null without bursts', () => {
    const tight = noiseBandFromBursts([{ underarm: [10, 10.1, 9.9], innerArm: [30, 30.1, 29.9] }]);
    const loose = noiseBandFromBursts([{ underarm: [10, 12, 8], innerArm: [30, 32, 28] }]);
    expect((loose?.itaDeg ?? 0)).toBeGreaterThan(tight?.itaDeg ?? 0);
    const wide = noiseBandFromBursts([{ underarm: [10, 10.1, 9.9], innerArm: [30, 30.1, 29.9] }], 3);
    expect(wide?.itaDeg).toBeCloseTo(2 * Math.SQRT2 * 3, 6);
    expect(noiseBandFromBursts([{ underarm: [10], innerArm: [30] }])).toBeNull();
  });
});

describe('photoChange maths', () => {
  const quality: PhotoQuality = { lightOk: true, focusOk: true, cardFound: true, colourOk: true, failures: [] };
  const m = (ita: number, cardL = 90): PhotoMeasurement => ({
    photoId: 'x',
    region: 'underarm',
    lab: { L: 60, a: 0, b: 10 },
    itaDeg: ita,
    quality,
    correction: { gains: [1, 1, 1], cardLab: { L: cardL, a: 0, b: 0 } },
    sampleCount: 10,
    burstSpreadItaDeg: 0,
    burstFrames: 3,
  });
  const band = { itaDeg: 4, source: 'day0-pair' as const, samples: 1 };

  it('change = gapDay0 - gapNow; beyond the band counts', () => {
    // Day 0 gap 30 - 10 = 20; now 30 - 20 = 10; change 10 > 4
    const c = computeChange({ underarm: m(10), innerArm: m(30) }, { underarm: m(20), innerArm: m(30) }, band);
    expect(c.gapDay0).toBe(20);
    expect(c.gapNow).toBe(10);
    expect(c.change).toBe(10);
    expect(c.beyondBand).toBe(true);
    expect(c.bucket).toBe('beyond-band');
  });
  it('within the band is no change; darker beyond the band is flagged', () => {
    expect(computeChange({ underarm: m(10), innerArm: m(30) }, { underarm: m(12), innerArm: m(30) }, band).bucket).toBe('within-band');
    const dark = computeChange({ underarm: m(10), innerArm: m(30) }, { underarm: m(5), innerArm: m(30) }, band);
    expect(dark.darkerBeyondBand).toBe(true);
    expect(dark.bucket).toBe('darker-beyond-band');
  });
  it('light too different between sessions is not comparable', () => {
    const c = computeChange({ underarm: m(10, 90), innerArm: m(30, 90) }, { underarm: m(20, 60), innerArm: m(30, 60) }, band);
    expect(c.comparable).toBe(false);
    expect(c.bucket).toBe('not-comparable');
    expect(c.beyondBand).toBe(false);
  });
});
