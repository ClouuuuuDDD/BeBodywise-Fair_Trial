/** Tiny per-visit flags kept on this phone (refill dismissed, halfway photo taken). Example flags live in session storage only. */
export function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1' || localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Sets a flag; the example never writes to local storage. */
export function writeFlag(key: string, example: boolean): void {
  try {
    (example ? sessionStorage : localStorage).setItem(key, '1');
  } catch {
    /* ignore */
  }
}

/** Key of the "halfway check-in done" flag. */
export const halfwayKey = (example: boolean): string => `ft-halfway-done-${example ? 'example' : 'live'}`;

/** Key of the "refill prompt dismissed for this bottle" flag. */
export const refillKey = (example: boolean, bottle: number): string => `ft-refill-dismissed-${example ? 'example' : 'live'}-${bottle}`;
