/**
 * Calendar-date maths on YYYY-MM-DD strings. Pure: dates are passed in, nothing reads the clock.
 * Uses UTC midnight internally so daylight saving never shifts a day.
 */
import type { ISODate } from '../contracts';

const MS_PER_DAY = 86_400_000;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Parses YYYY-MM-DD to UTC midnight in ms. Throws on anything else. */
export function toDayNumber(date: ISODate): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round(ms / MS_PER_DAY);
}

/** Inverse of toDayNumber. */
export function fromDayNumber(day: number): ISODate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** date + n calendar days (n may be negative). */
export function addDays(date: ISODate, n: number): ISODate {
  return fromDayNumber(toDayNumber(date) + n);
}

/** a - b in whole calendar days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(a) - toDayNumber(b);
}

/** "3 January" (no year, no locale lookup). */
export function formatDayMonth(date: ISODate): string {
  const [, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`;
}

/** ISO week label "2026-W50" (ISO 8601, weeks start Monday). Used by the share payload. */
export function isoWeek(date: ISODate): string {
  const day = toDayNumber(date);
  const dow = (((day + 3) % 7) + 7) % 7; // 0 = Monday (1970-01-01 was a Thursday)
  const thursday = day - dow + 3;
  const year = Number(fromDayNumber(thursday).slice(0, 4));
  const jan1 = toDayNumber(`${year}-01-01`);
  const week = Math.floor((thursday - jan1) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}
