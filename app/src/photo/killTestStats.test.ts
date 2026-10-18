import { describe, expect, it } from 'vitest';
import { killTestReport, reportToCsv, shotsToCsv, toCaptures, toGaps, type LabShot, type Lighting } from './killTestStats';

const shot = (tone: string, light: Lighting, session: string, site: 'underarm' | 'inner-arm', itaDeg: number): LabShot => ({
  file: `${tone}_${light}_${session}_${site}.jpg`,
  tone,
  light,
  session,
  site,
  itaDeg,
  failures: [],
});

/** Sessions with a fixed gap of 20 plus per-session offsets on the underarm. */
function condition(tone: string, light: Lighting, offsets: number[]): LabShot[] {
  return offsets.flatMap((o, i) => [shot(tone, light, String(i + 1), 'underarm', 10 + o), shot(tone, light, String(i + 1), 'inner-arm', 30)]);
}

describe('kill test statistics', () => {
  it('groups photos with the same labels into one burst (median) and pairs sites into gaps', () => {
    const caps = toCaptures([
      shot('T1', 'daylight', '1', 'underarm', 10),
      shot('T1', 'daylight', '1', 'underarm', 12),
      shot('T1', 'daylight', '1', 'underarm', 11),
      shot('T1', 'daylight', '1', 'inner-arm', 30),
    ]);
    expect(caps).toHaveLength(2);
    const gaps = toGaps(caps);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.gap).toBe(19); // 30 - median(10, 11, 12)
    expect(gaps[0]?.burstSdUnder).toBeCloseTo(1, 6);
    expect(gaps[0]?.burstSdInner).toBeNull();
  });

  it('a quiet condition passes; band = k * sqrt(2) * SD of the gap', () => {
    const r = killTestReport(condition('T1', 'daylight', [0, 0.5, -0.5, 0.2]), 5);
    const row = r.rows[0];
    expect(row?.n).toBe(4);
    expect(row?.band).toBeCloseTo(2 * Math.SQRT2 * (row?.sigmaGap ?? 0), 9);
    expect(row?.pass).toBe(true);
    expect(r.passed).toBe(true);
  });

  it('a noisy condition fails the whole test', () => {
    const shots = [...condition('T1', 'daylight', [0, 0.3, -0.3]), ...condition('T2', 'indoor-warm', [0, 6, -6, 4])];
    const r = killTestReport(shots, 5);
    expect(r.rows.find((x) => x.label === 'T1, daylight')?.pass).toBe(true);
    expect(r.rows.find((x) => x.label === 'T2, indoor-warm')?.pass).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('too few sessions gives no verdict', () => {
    const r = killTestReport(condition('T1', 'daylight', [0, 1]), 5);
    expect(r.rows[0]?.enough).toBe(false);
    expect(r.rows[0]?.pass).toBeNull();
    expect(r.passed).toBeNull();
  });

  it('a shift between lights shows in the across-lights row even if each light is steady', () => {
    const shots = [
      ...condition('T1', 'daylight', [0, 0, 0.1]),
      ...condition('T1', 'indoor-warm', [8, 8, 8.1]),
    ];
    const r = killTestReport(shots, 5);
    const across = r.rows.find((x) => x.scope === 'tone-across-lights');
    expect(across?.pass).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('exports CSV with a header and escaped cells', () => {
    const csv = shotsToCsv([{ ...shot('T1', 'daylight', '1', 'underarm', 10.123), file: 'a,b.jpg' }]);
    expect(csv.split('\n')[0]).toBe('file,tone,light,session,site,ita_deg,failures');
    expect(csv).toContain('"a,b.jpg"');
    expect(reportToCsv(killTestReport(condition('T1', 'daylight', [0, 1, 2]), 5)).split('\n')[0]).toContain('band_ita_deg');
  });
});
