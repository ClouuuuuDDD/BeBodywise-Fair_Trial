import type { ISODate } from '../../../contracts';
import { addDays } from '../../../engine';

const TITLE = 'Fair Trial: judge my roll-on today';

const compact = (d: ISODate) => d.replaceAll('-', '');

/** Google Calendar "add event" link for an all-day event on `date`. */
export function googleCalendarUrl(date: ISODate): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    dates: `${compact(date)}/${compact(addDays(date, 1))}`,
    details: 'Your judge-by date. Open Fair Trial to see whether it worked.',
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** An .ics file made on the device: the judge-by date only, no other data. */
export function icsFile(date: ISODate): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fair Trial//Concept for Be Bodywise//EN',
    'BEGIN:VEVENT',
    `UID:${compact(date)}@fair-trial`,
    `DTSTAMP:${compact(date)}T000000Z`,
    `DTSTART;VALUE=DATE:${compact(date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
    `SUMMARY:${TITLE}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadIcs(date: ISODate): void {
  const url = URL.createObjectURL(new Blob([icsFile(date)], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fair-trial-judge-by.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
