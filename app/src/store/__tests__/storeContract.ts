/** The Store contract suite, shared by store.test.ts (memory) and idbStore.test.ts (fake-indexeddb). */
import { describe, expect, it } from 'vitest';
import type { DayLogEntry, PhotoCapture } from '../../contracts';
import { exampleState, riyaShelf } from '../../engine';
import { createAnalytics } from '../index';
import type { Store } from '../index';

export const example = exampleState('day-23');
export const livePlan = () => ({ ...example.plan, mode: 'live' as const, planCode: 'FT-ABCD', channel: 'direct' as const });

export function photo(id: string, takenAt: string): PhotoCapture {
  return {
    id,
    region: 'underarm',
    moment: 'day0',
    takenAt,
    blob: new Blob(['jpeg-bytes'], { type: 'image/jpeg' }),
    width: 800,
    height: 600,
    pairId: 'pair-1',
  };
}

/** The same behaviour is required of every Store implementation. */
export function contract(name: string, make: () => Promise<Store> | Store) {
  describe(`Store contract: ${name}`, () => {
    it('keeps one trial id until everything is deleted', async () => {
      const s = await make();
      const a = await s.getTrialId();
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(await s.getTrialId()).toBe(a);
      await s.deleteEverything();
      expect(await s.getTrialId()).not.toBe(a);
      s.close();
    });

    it('round-trips her plan and refuses to store the example plan in its place', async () => {
      const s = await make();
      expect(await s.getPlan()).toBeUndefined();
      await s.putPlan(livePlan());
      expect((await s.getPlan())?.planCode).toBe('FT-ABCD');
      await expect(s.putPlan(example.plan)).rejects.toThrow(/example/);
      expect((await s.getPlan())?.planCode).toBe('FT-ABCD');
      await s.deletePlan();
      expect(await s.getPlan()).toBeUndefined();
      s.close();
    });

    it('keeps the example in its own store (AC-22-3: her plan is unchanged by running it)', async () => {
      const s = await make();
      await s.putPlan(livePlan());
      await s.putExample(example);
      expect((await s.getExample())?.persona).toBe('Riya');
      expect((await s.getPlan())?.planCode).toBe('FT-ABCD');
      await s.deleteExample();
      expect(await s.getExample()).toBeUndefined();
      expect((await s.getPlan())?.planCode).toBe('FT-ABCD');
      s.close();
    });

    it('keeps the shelf in the order added, replaces in place, removes and clears', async () => {
      const s = await make();
      const [toner, spray, cream] = riyaShelf();
      await s.putShelfItem(toner!);
      await s.putShelfItem(spray!);
      await s.putShelfItem(cream!);
      expect((await s.listShelf()).map((i) => i.id)).toEqual(['riya-toner', 'riya-spray', 'riya-cream']);
      await s.putShelfItem({ ...toner!, stung: true });
      const after = await s.listShelf();
      expect(after.map((i) => i.id)).toEqual(['riya-toner', 'riya-spray', 'riya-cream']);
      expect(after[0]?.stung).toBe(true);
      expect(after[0]).not.toHaveProperty('order');
      await s.deleteShelfItem('riya-spray');
      expect((await s.listShelf()).map((i) => i.id)).toEqual(['riya-toner', 'riya-cream']);
      await s.clearShelf();
      expect(await s.listShelf()).toEqual([]);
      s.close();
    });

    it('logs one entry per date, last write wins, oldest first, and clears a day', async () => {
      const s = await make();
      const entry = (date: string, status: DayLogEntry['status']): DayLogEntry => ({ date, status, source: 'tap' });
      await s.putDay(entry('2026-10-20', 'used'));
      await s.putDay(entry('2026-10-18', 'paused'));
      await s.putDay(entry('2026-10-20', 'skipped'));
      expect(await s.listDayLog()).toEqual([entry('2026-10-18', 'paused'), entry('2026-10-20', 'skipped')]);
      await s.deleteDay('2026-10-18');
      expect(await s.listDayLog()).toEqual([entry('2026-10-20', 'skipped')]);
      s.close();
    });

    it('stores photos with their Blob, oldest first', async () => {
      const s = await make();
      await s.putPhoto(photo('b', '2026-10-17T09:05:00+05:30'));
      await s.putPhoto(photo('a', '2026-10-17T09:00:00+05:30'));
      expect((await s.listPhotos()).map((p) => p.id)).toEqual(['a', 'b']);
      const got = await s.getPhoto('a');
      expect(got?.blob.size).toBe(10);
      expect(got?.blob.type).toBe('image/jpeg');
      await s.deletePhoto('a');
      expect(await s.getPhoto('a')).toBeUndefined();
      s.close();
    });

    it('appends events in write order and wipes everything on delete', async () => {
      const s = await make();
      const a = createAnalytics(s, { appVersion: 'test', rulesVersion: 'r1' });
      await a.trackAsync('door_opened', '02', { channel: 'direct' });
      await a.trackAsync('check_started', '03b', { channel: 'direct' });
      expect((await s.listEvents()).map((e) => e.event)).toEqual(['door_opened', 'check_started']);
      await s.putPlan(livePlan());
      await s.putShelfItem(riyaShelf()[0]!);
      await s.putDay({ date: '2026-10-20', status: 'used', source: 'tap' });
      await s.putPhoto(photo('a', '2026-10-17T09:00:00+05:30'));
      await s.putExample(example);
      await s.deleteEverything();
      expect(await s.getPlan()).toBeUndefined();
      expect(await s.getExample()).toBeUndefined();
      expect(await s.listShelf()).toEqual([]);
      expect(await s.listDayLog()).toEqual([]);
      expect(await s.listPhotos()).toEqual([]);
      expect(await s.listEvents()).toEqual([]);
      s.close();
    });

    it('never persists the burst frames, only the kept blob (contracts PhotoCapture.frames)', async () => {
      const s = await make();
      const burst = [new Blob(['f1']), new Blob(['f2']), new Blob(['f3'])];
      await s.putPhoto({ ...photo('burst-1', '2026-10-17T09:00:00+05:30'), frames: burst });
      const got = await s.getPhoto('burst-1');
      expect(got?.frames).toBeUndefined();
      expect(got?.blob).toBeDefined();
      s.close();
    });
  });
}

