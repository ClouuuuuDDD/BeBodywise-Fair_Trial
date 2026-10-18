import { describe, expect, it, vi } from 'vitest';
import { rulesVersion } from '../../engine';
import { createAnalytics, createMemoryStore, createStore, findForbiddenKey, localIsoWithOffset } from '../index';
import type { Store } from '../index';
import { contract, example, livePlan } from './storeContract';

contract('memory', () => createMemoryStore());

describe('memory store extras', () => {
  it('hands out copies, so a screen cannot change the saved plan by accident', async () => {
    const s = createMemoryStore();
    await s.putPlan(livePlan());
    const got = await s.getPlan();
    got!.planCode = 'FT-ZZZZ';
    expect((await s.getPlan())?.planCode).toBe('FT-ABCD');
  });

  it('createStore falls back to memory when IndexedDB is missing (node, private windows)', async () => {
    const s = await createStore();
    expect(s.kind).toBe(typeof indexedDB === 'undefined' ? 'memory' : 'idb');
    s.close();
  });
});

describe('local analytics log (events.md)', () => {
  const fixed = () => new Date(2026, 9, 17, 21, 40, 5);

  it('writes the envelope plus the event properties, nothing else, and sends nothing over the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const s = createMemoryStore();
    await s.putPlan(livePlan());
    const a = createAnalytics(s, { appVersion: 'abc123', rulesVersion: rulesVersion(), now: fixed });
    const written = await a.trackAsync('pick_shown', '05b', { product_id: 'bw-rollon-4', variant: 'no-fragrance', rule_row: 8, base_row: 8, hormone_note: false });
    const stored = (await s.listEvents())[0];
    expect(stored).toEqual(written);
    expect(stored).toMatchObject({
      event: 'pick_shown',
      trial_id: await s.getTrialId(),
      plan_code: 'FT-ABCD',
      mode: 'live',
      screen: '05b',
      app_version: 'abc123',
      rules_version: rulesVersion(),
      product_id: 'bw-rollon-4',
      variant: 'no-fragrance',
      rule_row: 8,
      hormone_note: false,
    });
    expect(stored?.ts).toMatch(/^2026-10-17T21:40:05[+-]\d{2}:\d{2}$/);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('plan_code is null before a plan is saved', async () => {
    const a = createAnalytics(createMemoryStore(), { appVersion: 'x', rulesVersion: 'y' });
    expect((await a.trackAsync('door_opened', '02', { channel: 'amazon-qr' }))?.plan_code).toBeNull();
  });

  it('example mode events carry mode "example" and the example plan code, not hers', async () => {
    const s = createMemoryStore();
    await s.putPlan(livePlan());
    await s.putExample(example);
    const a = createAnalytics(s, { appVersion: 'x', rulesVersion: 'y' });
    const e = await a.trackAsync('example_jump', '22', { jump: 'day-9' }, 'example');
    expect(e).toMatchObject({ mode: 'example', plan_code: example.plan.planCode });
  });

  it('refuses a property that could carry personal data (events.md rule 4)', async () => {
    const s = createMemoryStore();
    const a = createAnalytics(s, { appVersion: 'x', rulesVersion: 'y' });
    // Deliberately wrong: a free-text field smuggled in as a property.
    const bad = { channel: 'direct', phone: '000' } as unknown as { channel: 'direct' };
    expect(await a.trackAsync('door_opened', '02', bad)).toBeNull();
    expect(await s.listEvents()).toEqual([]);
    expect(findForbiddenKey({ product_id: 'x', latency_bucket: 'lt2s', hormone_note: true, with_photos: false })).toBeUndefined();
    expect(findForbiddenKey({ user_name: 'x' })).toBe('user_name');
  });

  it('never throws into the UI when the store fails, and track() returns at once', async () => {
    const broken: Store = { ...createMemoryStore(), appendEvent: () => Promise.reject(new Error('quota')) };
    const a = createAnalytics(broken, { appVersion: 'x', rulesVersion: 'y' });
    expect(await a.trackAsync('door_opened', '02', { channel: 'direct' })).toBeNull();
    expect(() => a.track('door_opened', '02', { channel: 'direct' })).not.toThrow();
  });

  it('formats a local timestamp with an offset', () => {
    expect(localIsoWithOffset(fixed())).toMatch(/^2026-10-17T21:40:05[+-]\d{2}:\d{2}$/);
  });
});
