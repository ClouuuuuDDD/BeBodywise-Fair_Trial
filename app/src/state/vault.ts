/**
 * Shared on-phone vault handle and local analytics for the trial, keep and example screens (E5).
 * One store per page load; nothing here touches the network.
 */
import type { AnalyticsEventName, AnalyticsEventProps, AppMode } from '../contracts';
import { rulesVersion } from '../engine';
import { createAnalytics, createStore } from '../store';
import type { Analytics, Store } from '../store';

let storePromise: Promise<Store> | undefined;
let analytics: Promise<Analytics> | undefined;
let currentMode: AppMode = 'live';

/** The single store for this page load (IndexedDB, or memory when blocked). */
export function getStore(): Promise<Store> {
  storePromise ??= createStore();
  return storePromise;
}

/** Example mode switches this so every event carries `mode: "example"`. */
export function setVaultMode(mode: AppMode): void {
  currentMode = mode;
}

/** Current mode of the app (live or example). */
export function vaultMode(): AppMode {
  return currentMode;
}

/** Fire-and-forget local event. Never throws, never sends anything. */
export function track<K extends AnalyticsEventName>(
  event: K,
  screen: string,
  props: AnalyticsEventProps[K],
  modeOverride?: AppMode,
): void {
  const mode = modeOverride ?? currentMode;
  analytics ??= getStore().then((s) => createAnalytics(s, { appVersion: 'prototype', rulesVersion: rulesVersion() }));
  void analytics.then((a) => a.track(event, screen, props, mode)).catch(() => undefined);
}

/** Today on her phone as YYYY-MM-DD (local time). */
export function localToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Test hook: swap in another store before first use (Vitest, or a Playwright page that wants memory). */
export function injectStoreForTests(store: Store): void {
  storePromise = Promise.resolve(store);
  analytics = undefined;
}
