/** Public API of the on-phone vault: plan, shelf, day log, photos, example store and the local analytics log. Owner: E2. */
import { openIdbStore } from './idbStore';
import { createMemoryStore } from './memory';
import type { Store } from './types';

export { createAnalytics, findForbiddenKey, localIsoWithOffset } from './analytics';
export type { Analytics, AnalyticsContext } from './analytics';
export { DB_NAME, DB_VERSION, openIdbStore, requestPersistence } from './idbStore';
export { randomUuid } from './ids';
export { createMemoryStore } from './memory';
export { STORE_NAMES } from './types';
export type { Store, StoreName } from './types';

/**
 * Opens IndexedDB, or falls back to an in-memory store when it is missing or blocked (private windows,
 * old browsers, tests). The caller can check `store.kind`; the app must still work, just without saving.
 */
export async function createStore(name?: string): Promise<Store> {
  try {
    if (typeof indexedDB === 'undefined') return createMemoryStore();
    return await openIdbStore(name);
  } catch {
    return createMemoryStore();
  }
}
