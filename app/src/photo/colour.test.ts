import { describe, expect, it } from 'vitest';
import { itaDeg, linearToSrgb, median, quantile, sd, srgbToLab, srgbToLinear } from './colour';

describe('sRGB -> linear', () => {
  it('maps the ends and a mid value', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(255)).toBeCloseTo(1, 10);
    expect(srgbToLinear(128)).toBeCloseTo(0.2158605, 6);
  });
  it('round-trips', () => {
    for (const v of [0, 10, 64, 128, 200, 255]) expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 6);
  });
});

describe('sRGB -> CIELAB (D65)', () => {
  it('white is L 100, a 0, b 0', () => {
    const l = srgbToLab(255, 255, 255);
    expect(l.L).toBeCloseTo(100, 2);
    expect(l.a).toBeCloseTo(0, 2);
    expect(l.b).toBeCloseTo(0, 2);
  });
  it('black is L 0', () => {
    expect(srgbToLab(0, 0, 0).L).toBeCloseTo(0, 6);
  });
  it('matches reference values for red and mid grey', () => {
    const red = srgbToLab(255, 0, 0);
    expect(red.L).toBeCloseTo(53.24, 1);
    expect(red.a).toBeCloseTo(80.09, 1);
    expect(red.b).toBeCloseTo(67.2, 1);
    const grey = srgbToLab(128, 128, 128);
    expect(grey.L).toBeCloseTo(53.59, 1);
    expect(Math.abs(grey.a)).toBeLessThan(0.05);
  });
});

describe('ITA°', () => {
  it('reference points', () => {
    expect(itaDeg({ L: 70, a: 5, b: 20 })).toBeCloseTo(45, 6); // atan(20/20)
    expect(itaDeg({ L: 50, a: 5, b: 10 })).toBeCloseTo(0, 6);
    expect(itaDeg({ L: 30, a: 5, b: 20 })).toBeCloseTo(-45, 6);
    expect(itaDeg({ L: 50 + 10 * Math.sqrt(3), a: 0, b: 10 })).toBeCloseTo(60, 6);
  });
  it('is higher for lighter skin and stays defined at b = 0', () => {
    expect(itaDeg({ L: 75, a: 0, b: 18 })).toBeGreaterThan(itaDeg({ L: 60, a: 0, b: 18 }));
    expect(itaDeg({ L: 60, a: 0, b: 0 })).toBeCloseTo(90, 6);
  });
  it('lighter real sRGB skin tones give higher ITA° than darker', () => {
    expect(itaDeg(srgbToLab(235, 190, 165))).toBeGreaterThan(itaDeg(srgbToLab(150, 105, 80)));
  });
});

describe('statistics', () => {
  it('median, quantile, sd', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(sd([5])).toBe(0);
  });
});
