/** IndexedDB Store built on `idb`. Skin photos (Blobs) and everything else stay on this phone: no network calls. */
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { AnalyticsEvent, DayLogEntry, ExampleState, PhotoCapture, Plan, ShelfItem } from '../contracts';
import { randomUuid } from './ids';
import { STORE_NAMES } from './types';
import type { Store } from './types';

/** Database name; the example never uses a different database, only its own object store. */
export const DB_NAME = 'fair-trial';
/** Bump when a store or index changes, and handle the old version in `upgrade`. */
export const DB_VERSION = 1;

const PLAN_KEY = 'live';
const EXAMPLE_KEY = 'riya';
const TRIAL_ID_KEY = 'trialId';

interface FairTrialDB extends DBSchema {
  plan: { key: string; value: Plan };
  example: { key: string; value: ExampleState };
  shelf: { key: string; value: ShelfItem & { order: number } };
  dayLog: { key: string; value: DayLogEntry };
  photos: { key: string; value: PhotoCapture; indexes: { 'by-pair': string; 'by-taken': string } };
  events: { key: number; value: AnalyticsEvent; indexes: { 'by-event': string } };
  meta: { key: string; value: string };
}

/** Opens (and creates) the database. Rejects when IndexedDB is unavailable; createStore then falls back to memory. */
export async function openIdbStore(name: string = DB_NAME): Promise<Store> {
  const db: IDBPDatabase<FairTrialDB> = await openDB<FairTrialDB>(name, DB_VERSION, {
    upgrade(upgrading) {
      upgrading.createObjectStore('plan');
      upgrading.createObjectStore('example');
      upgrading.createObjectStore('shelf', { keyPath: 'id' });
      upgrading.createObjectStore('dayLog', { keyPath: 'date' });
      const photos = upgrading.createObjectStore('photos', { keyPath: 'id' });
      photos.createIndex('by-pair', 'pairId');
      photos.createIndex('by-taken', 'takenAt');
      const events = upgrading.createObjectStore('events', { autoIncrement: true });
      events.createIndex('by-event', 'event');
      upgrading.createObjectStore('meta');
    },
  });

  return {
    kind: 'idb',

    async getTrialId() {
      const existing = await db.get('meta', TRIAL_ID_KEY);
      if (existing) return existing;
      const made = randomUuid();
      // add() fails if another tab wrote one first; then read theirs so both tabs agree.
      try {
        await db.add('meta', made, TRIAL_ID_KEY);
        return made;
      } catch {
        return (await db.get('meta', TRIAL_ID_KEY)) ?? made;
      }
    },

    async getPlan() {
      return db.get('plan', PLAN_KEY);
    },
    async putPlan(plan) {
      if (plan.mode === 'example') throw new Error('The example plan lives in its own store and never overwrites hers.');
      await db.put('plan', plan, PLAN_KEY);
    },
    async deletePlan() {
      await db.delete('plan', PLAN_KEY);
    },

    async getExample() {
      return db.get('example', EXAMPLE_KEY);
    },
    async putExample(state) {
      await db.put('example', state, EXAMPLE_KEY);
    },
    async deleteExample() {
      await db.delete('example', EXAMPLE_KEY);
    },

    async listShelf() {
      const rows = await db.getAll('shelf');
      return rows.sort((a, b) => a.order - b.order).map(({ order: _order, ...item }) => item);
    },
    async putShelfItem(item) {
      const tx = db.transaction('shelf', 'readwrite');
      const existing = await tx.store.get(item.id);
      // Monotonic, inside the transaction: items added in the same millisecond keep the order added.
      const order = existing?.order ?? (await tx.store.getAll()).reduce((max, row) => Math.max(max, row.order), 0) + 1;
      await tx.store.put({ ...item, order });
      await tx.done;
    },
    async deleteShelfItem(id) {
      await db.delete('shelf', id);
    },
    async clearShelf() {
      await db.clear('shelf');
    },

    async listDayLog() {
      const rows = await db.getAll('dayLog');
      return rows.sort((a, b) => a.date.localeCompare(b.date));
    },
    async putDay(entry) {
      await db.put('dayLog', entry);
    },
    async deleteDay(date) {
      await db.delete('dayLog', date);
    },

    async putPhoto(photo) {
      const { frames: _burst, ...kept } = photo; // the burst is never persisted (contracts PhotoCapture.frames)
      await db.put('photos', kept);
    },
    async getPhoto(id) {
      return db.get('photos', id);
    },
    async listPhotos() {
      return db.getAllFromIndex('photos', 'by-taken');
    },
    async deletePhoto(id) {
      await db.delete('photos', id);
    },

    async appendEvent(event) {
      await db.add('events', event);
    },
    async listEvents() {
      return db.getAll('events');
    },

    async deleteEverything() {
      const tx = db.transaction([...STORE_NAMES], 'readwrite');
      await Promise.all(STORE_NAMES.map((n) => tx.objectStore(n).clear()));
      await tx.done;
    },

    close() {
      db.close();
    },
  };
}

/** Asks the browser not to evict the database (FR-X-09, at plan save). Resolves false when unsupported or refused. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore: persistence is a nice-to-have */
  }
  return false;
}
