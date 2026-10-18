import type { ISODate } from '../../../contracts';
import { track } from '../../../state/vault';
import { PrimaryButton, Sheet } from '../../../ui';
import { downloadIcs, googleCalendarUrl } from './calendar';
import styles from './trial.module.css';

/** Choice sheet: Google Calendar or a .ics file (FR-M7-06). `onDone` runs after either. */
export function CalendarSheet({ open, onClose, date, onDone }: { open: boolean; onClose: () => void; date: ISODate; onDone: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add to my calendar">
      <div className={styles.calChoices}>
        <PrimaryButton
          variant="secondary"
          href={googleCalendarUrl(date)}
          external
          data-testid="cal-google"
          onClick={() => {
            track('calendar_added', '10', { method: 'google' });
            onDone();
          }}
        >
          Google Calendar
        </PrimaryButton>
        <PrimaryButton
          variant="secondary"
          data-testid="cal-ics"
          onClick={() => {
            downloadIcs(date);
            track('calendar_added', '10', { method: 'ics' });
            onDone();
          }}
        >
          Other calendar (.ics)
        </PrimaryButton>
      </div>
    </Sheet>
  );
}
