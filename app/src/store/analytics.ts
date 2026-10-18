/**
 * Local analytics log (PRD section 11, engineering/handoff/events.md). Every event is appended to the
 * `events` store on this phone. No SDK, no beacon, no network call. Writes are fire-and-forget and never
 * throw into the UI. Example-mode events carry `mode: 'example'` and are excluded from every metric.
 */
import type { AnalyticsEvent, AnalyticsEventName, AnalyticsEventProps, AppMode } from '../contracts';
import type { Store } from './types';

/** What the envelope needs that the store does not know. */
export interface AnalyticsContext {
  /** Build hash (`app_version`). */
  appVersion: string;
  /** Hash of config.ts + both rule JSON files (`rules_version`); the engine's rulesVersion(). */
  rulesVersion: string;
  /** Clock, injectable for tests. Defaults to the current time. */
  now?: () => Date;
}

/** Property names that must never appear in an event (events.md rule 4). */
const FORBIDDEN_KEY = /(^|_)(name|phone|email|photo|image|lat|lng|lon|location|address|ip)(_|$)/;

/** Local ISO 8601 with offset, e.g. "2026-10-17T21:40:00+05:30" (events.md `ts`). */
export function localIsoWithOffset(date: Date): string {
  const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}

/** Returns the first forbidden property name in an event's properties, or undefined when it is clean. */
export function findForbiddenKey(props: object): string | undefined {
  return Object.keys(props).find((k) => FORBIDDEN_KEY.test(k));
}

/** The logger returned by createAnalytics. */
export interface Analytics {
  /** Fire-and-forget: queues the write and returns at once. Never throws, never blocks. */
  track<K extends AnalyticsEventName>(event: K, screen: string, props: AnalyticsEventProps[K], mode?: AppMode): void;
  /** Same write, but resolves when it is stored (tests, and the `data_deleted` write after a wipe). Never rejects. */
  trackAsync<K extends AnalyticsEventName>(
    event: K,
    screen: string,
    props: AnalyticsEventProps[K],
    mode?: AppMode,
  ): Promise<AnalyticsEvent<K> | null>;
}

/** Makes the logger for a store. */
export function createAnalytics(store: Store, ctx: AnalyticsContext): Analytics {
  const clock = ctx.now ?? (() => new Date());

  async function trackAsync<K extends AnalyticsEventName>(
    event: K,
    screen: string,
    props: AnalyticsEventProps[K],
    mode: AppMode = 'live',
  ): Promise<AnalyticsEvent<K> | null> {
    try {
      if (findForbiddenKey(props) !== undefined) return null;
      const [trialId, plan, example] = await Promise.all([store.getTrialId(), store.getPlan(), store.getExample()]);
      const planCode = mode === 'example' ? (example?.plan.planCode ?? null) : (plan?.planCode ?? null);
      const record = {
        event,
        ts: localIsoWithOffset(clock()),
        trial_id: trialId,
        plan_code: planCode,
        mode,
        screen,
        app_version: ctx.appVersion,
        rules_version: ctx.rulesVersion,
        ...props,
      } as unknown as AnalyticsEvent<K>;
      await store.appendEvent(record as AnalyticsEvent);
      return record;
    } catch {
      return null; // logging must never break the screen
    }
  }

  return {
    trackAsync,
    track(event, screen, props, mode) {
      void trackAsync(event, screen, props, mode);
    },
  };
}
