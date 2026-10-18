/**
 * Guided demo ("Play the whole journey"): chapter cards between the phases, and a day control so a person
 * sitting with the prototype can move her own trial forward instead of waiting 8 weeks.
 * Session only: closing the tab ends the demo. Her plan is real data on this phone; only "today" is shifted.
 */
import { useSyncExternalStore } from 'react';
import type { ISODate } from '../contracts';
import { addDays } from '../engine';
import { localToday } from './vault';

export type ChapterId = 'before' | 'arrives' | 'using' | 'verdict' | 'after' | 'bodywise';

export interface TourState {
  on: boolean;
  /** Days added to the phone's date while the demo is on. */
  dayOffset: number;
  /** Chapters whose card has been shown. */
  seen: ChapterId[];
}

const KEY = 'ft-tour';
const OFF: TourState = { on: false, dayOffset: 0, seen: [] };
/** The shipped app opens in the guided demo. Build with VITE_GUIDED_DEMO=0 for the plain app (the browser tests do). */
export const DEMO_BY_DEFAULT = import.meta.env.VITE_GUIDED_DEMO !== '0';

function read(): TourState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return { ...OFF, ...(JSON.parse(raw) as Partial<TourState>) };
  } catch {
    return OFF;
  }
  return DEMO_BY_DEFAULT ? { on: true, dayOffset: 0, seen: [] } : OFF;
}

let current: TourState = typeof window === 'undefined' ? OFF : read();
const listeners = new Set<() => void>();

function set(next: TourState): void {
  current = next;
  try {
    // Kept when off too, so "End" holds for the rest of the visit even where the demo is the default.
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private window: the demo still works for this page load */
  }
  for (const l of listeners) l();
}

/** Turns the demo on from the start (chapter cards unseen, today = the phone's date). */
export function startTour(): void {
  set({ on: true, dayOffset: 0, seen: [] });
}

/** Turns the demo off and puts "today" back to the phone's date. */
export function endTour(): void {
  set(OFF);
}

export function markChapterSeen(id: ChapterId): void {
  if (!current.on || current.seen.includes(id)) return;
  set({ ...current, seen: [...current.seen, id] });
}

/** Moves the demo's today so that it lands on `date` (never before the phone's real date). */
export function setTourToday(date: ISODate): void {
  if (!current.on) return;
  const real = localToday();
  const offset = Math.max(0, Math.round((Date.parse(date) - Date.parse(real)) / 86_400_000));
  set({ ...current, dayOffset: offset });
}

/** Today for her real trial: the phone's date, plus the demo's offset while the demo is on. */
export function tourToday(): ISODate {
  const real = localToday();
  return current.on && current.dayOffset > 0 ? addDays(real, current.dayOffset) : real;
}

export function getTour(): TourState {
  return current;
}

export function useTour(): TourState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => OFF,
  );
}
