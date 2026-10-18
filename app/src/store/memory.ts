/** In-memory Store: the fallback when IndexedDB is missing or blocked, and what unit tests use. */
import type { AnalyticsEvent, DayLogEntry, ExampleState, PhotoCapture, Plan, ShelfItem } from '../contracts';
import { randomUuid } from './ids';
import type { Store } from './types';

/** Copies a record so callers cannot mutate what is "stored" (IndexedDB gives the same guarantee). */
function copy<T>(value: T): T {
  return structuredClone(value);
}

/** A fresh, empty in-memory store. */
export function createMemoryStore(): Store {
  let trialId: string | undefined;
  let plan: Plan | undefined;
  let example: ExampleState | undefined;
  let shelf = new Map<string, ShelfItem>();
  let days = new Map<string, DayLogEntry>();
  let photos = new Map<string, PhotoCapture>();
  let events: AnalyticsEvent[] = [];

  return {
    kind: 'memory',

    async getTrialId() {
      trialId ??= randomUuid();
      return trialId;
    },

    async getPlan() {
      return plan ? copy(plan) : undefined;
    },
    async putPlan(next) {
      if (next.mode === 'example') throw new Error('The example plan lives in its own store and never overwrites hers.');
      plan = copy(next);
    },
    async deletePlan() {
      plan = undefined;
    },

    async getExample() {
      return example ? copy(example) : undefined;
    },
    async putExample(state) {
      example = copy(state);
    },
    async deleteExample() {
      example = undefined;
    },

    async listShelf() {
      return [...shelf.values()].map(copy);
    },
    async putShelfItem(item) {
      shelf.set(item.id, copy(item)); // Map.set on an existing key keeps its position
    },
    async deleteShelfItem(id) {
      shelf.delete(id);
    },
    async clearShelf() {
      shelf = new Map();
    },

    async listDayLog() {
      return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map(copy);
    },
    async putDay(entry) {
      days.set(entry.date, copy(entry));
    },
    async deleteDay(date) {
      days.delete(date);
    },

    async putPhoto(photo) {
      const { frames: _burst, ...kept } = photo; // the burst is never persisted (contracts PhotoCapture.frames)
      photos.set(photo.id, { ...kept }); // shallow: the Blob is shared on purpose
    },
    async getPhoto(id) {
      const p = photos.get(id);
      return p ? { ...p } : undefined;
    },
    async listPhotos() {
      return [...photos.values()].sort((a, b) => a.takenAt.localeCompare(b.takenAt)).map((p) => ({ ...p }));
    },
    async deletePhoto(id) {
      photos.delete(id);
    },

    async appendEvent(event) {
      events.push(copy(event));
    },
    async listEvents() {
      return events.map(copy);
    },

    async deleteEverything() {
      trialId = undefined;
      plan = undefined;
      example = undefined;
      shelf = new Map();
      days = new Map();
      photos = new Map();
      events = [];
    },

    close() {
      /* nothing to close */
    },
  };
}
