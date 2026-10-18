/**
 * The on-phone vault (IndexedDB) interface. Everything stays on the device: no network calls anywhere in
 * this folder. Two implementations: idbStore.ts (real) and memory.ts (tests and browsers without IndexedDB).
 * Owner: E2. Types come from app/src/contracts; this file only describes storage.
 */
import type { AnalyticsEvent, AppMode, DayLogEntry, ExampleState, PhotoCapture, Plan, ShelfItem } from '../contracts';

/** Names of the object stores, shared by both implementations. */
export const STORE_NAMES = ['plan', 'example', 'shelf', 'dayLog', 'photos', 'events', 'meta'] as const;
/** One object store name. */
export type StoreName = (typeof STORE_NAMES)[number];

/** Everything saved on her phone. All methods are async; none throws for a missing record. */
export interface Store {
  /** Which implementation is in use (tests assert on it; screens never need to). */
  readonly kind: 'idb' | 'memory';

  /** Random UUID v4 made at first launch and kept on the device (events `trial_id`). */
  getTrialId(): Promise<string>;

  /** Her saved plan (the live one; the example never shares this record). */
  getPlan(): Promise<Plan | undefined>;
  /** Saves her plan. Refuses a plan with `mode: 'example'` so the example can never overwrite hers. */
  putPlan(plan: Plan): Promise<void>;
  /** Deletes her plan only. */
  deletePlan(): Promise<void>;

  /** The seeded example (Riya), in its own store. */
  getExample(): Promise<ExampleState | undefined>;
  /** Saves the example state. */
  putExample(state: ExampleState): Promise<void>;
  /** Deletes the example state only. */
  deleteExample(): Promise<void>;

  /** Shelf items in the order added (the shelf she is building before a plan exists). */
  listShelf(): Promise<ShelfItem[]>;
  /** Adds or replaces a shelf item (by id). Keeps its place when replacing. */
  putShelfItem(item: ShelfItem): Promise<void>;
  /** Removes a shelf item. */
  deleteShelfItem(id: string): Promise<void>;
  /** Empties the shelf. */
  clearShelf(): Promise<void>;

  /** Logged days, oldest first. */
  listDayLog(): Promise<DayLogEntry[]>;
  /** One entry per date; the last write wins. */
  putDay(entry: DayLogEntry): Promise<void>;
  /** Clears a day back to "not logged" (assumed used). */
  deleteDay(date: string): Promise<void>;

  /** Saves a photo record with its Blob. The Blob never leaves the device. */
  putPhoto(photo: PhotoCapture): Promise<void>;
  /** One photo by id. */
  getPhoto(id: string): Promise<PhotoCapture | undefined>;
  /** All photos, oldest first. */
  listPhotos(): Promise<PhotoCapture[]>;
  /** Deletes one photo. */
  deletePhoto(id: string): Promise<void>;

  /** Appends one local analytics event (store `events`). Nothing is ever sent. */
  appendEvent(event: AnalyticsEvent): Promise<void>;
  /** All local events in write order. */
  listEvents(): Promise<AnalyticsEvent[]>;

  /** Wipes every store (FR-M9-03 "Delete everything from this phone"). The trial id is made again on next use. */
  deleteEverything(): Promise<void>;

  /** Closes the connection (tests). */
  close(): void;
}

/** Which mode a plan record belongs to; only 'live' is stored by putPlan. */
export type StorablePlanMode = Extract<AppMode, 'live'>;
