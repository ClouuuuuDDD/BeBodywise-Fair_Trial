/** Small formatting helpers for the trial screens. */
import type { HairRemoval, DarknessDuration, ISODate, ShelfItem } from '../../../contracts';
import { formatDayMonth } from '../../../engine';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Dec". */
export function shortDate(date: ISODate): string {
  const [, m, d] = date.split('-');
  return `${Number(d)} ${SHORT_MONTHS[Number(m) - 1] ?? ''}`;
}

/** "12 December". */
export const longDate = formatDayMonth;

/** Doctor link target: one constant in ui/links.ts (decisions: Doctor link). No price anywhere (X1-06). */
export { DOCTOR_URL } from '../../../ui/links';

/** How long, in her words (fit Q2). */
export const DURATION_WORDS: Record<DarknessDuration, string> = {
  months: 'a few months',
  'year-plus': 'a year or more',
  always: 'as long as she can remember',
};

/** Hair removal, in her words (fit Q3). */
export const HAIR_WORDS: Record<HairRemoval, string> = {
  razor: 'razor',
  wax: 'wax',
  cream: 'hair removal cream',
  laser: 'laser',
  none: 'no hair removal',
};

const BY_MASCOT: Record<string, string> = {
  toner: 'toner',
  'spray-can': 'deodorant spray',
  deodorant: 'deodorant',
  'hair-removal': 'hair removal cream',
  lotion: 'body lotion',
  serum: 'serum',
  retinol: 'retinol',
  sunscreen: 'sunscreen',
  'chemist-tube': 'cream',
};

/** A short noun for a shelf product ("glycolic toner"), so copy reads like her words, not a label. */
export function shortName(item: ShelfItem, glycolic = false): string {
  const base = (item.mascot && BY_MASCOT[item.mascot]) || item.product;
  if (glycolic && item.mascot === 'toner' && item.ingredients.some((i) => /glycolic/i.test(i.inci))) return 'glycolic toner';
  return base;
}

/** Lower-cases the first letter, to follow "Product: " in a keep-apart line. */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Local ISO timestamp with offset, for reaction records. */
export function nowIso(now: Date = new Date()): string {
  const p = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const off = -now.getTimezoneOffset();
  return (
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}` +
    `${off >= 0 ? '+' : '-'}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`
  );
}
