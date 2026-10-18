import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CALM_STOP, enterExample, isStop, routeOf, type AnyStop } from '../../state/example';
import { track } from '../../state/vault';
import { AppShell, DrMehr, Icon, Mascot, Sheet, type DrMehrPose, type MascotId } from '../../ui';
import styles from './example.module.css';

interface Moment {
  key: string;
  stop?: AnyStop;
  label: string;
  title: string;
  art: { mascot: MascotId } | { pose: DrMehrPose };
  tint: string;
}

const MOMENTS: Moment[] = [
  { key: 'check', stop: 'check', label: '14 Oct', title: 'Fit and shelf check', art: { mascot: 'rollon' }, tint: 'var(--surface-muted)' },
  { key: 'day-0', stop: 'day-0', label: 'Day 0', title: 'Routine and first photo', art: { pose: 'camera' }, tint: 'var(--tint-mint)' },
  { key: 'day-9', stop: 'day-9', label: 'Day 9', title: 'It stings', art: { mascot: 'rollon-worried' }, tint: 'var(--tint-rose)' },
  { key: 'day-23', stop: 'day-23', label: 'Day 23', title: 'The quiet middle', art: { mascot: 'rollon-sleepy' }, tint: 'var(--surface-muted)' },
  { key: 'day-40', stop: 'day-40', label: 'Day 40', title: 'Running low', art: { pose: 'calendar' }, tint: 'var(--butter-tint)' },
  { key: 'day-56-working', stop: 'day-56-working', label: 'Day 56', title: 'Verdict: working', art: { mascot: 'rollon-celebrate' }, tint: 'var(--tint-mint)' },
  { key: 'day-56-not-for-you', stop: 'day-56-not-for-you', label: 'Day 56, the other ending', title: 'Verdict: not for you', art: { mascot: 'rollon-goodbye' }, tint: 'var(--surface-muted)' },
  { key: 'more', label: 'More endings', title: "Not yet, Can't call it, See a doctor", art: { pose: 'concerned' }, tint: 'var(--tint-lilac)' },
  { key: 'keep-going', stop: 'keep-going', label: 'After the verdict', title: 'Keep going', art: { mascot: 'serum' }, tint: 'var(--tint-mint)' },
  { key: 'insights', stop: 'insights', label: 'For Be Bodywise', title: 'What the shelf tells us', art: { pose: 'clipboard' }, tint: 'var(--butter-tint)' },
];

const ENDINGS: { stop: AnyStop; label: string; hint: string }[] = [
  { stop: CALM_STOP, label: 'Not for you, with the step-up line', hint: 'A calm trial, no change' },
  { stop: 'not-yet', label: 'Not yet', hint: 'Not enough use-days' },
  { stop: 'cant-call', label: "Can't call it", hint: 'The light was too different' },
  { stop: 'see-doctor', label: 'See a doctor', hint: 'A reaction that needs a doctor' },
];

/** Screen 22: the whole trial in a minute, for reviewers. Riya's moments; every tap seeds the state and jumps there. */
export default function ExampleTrial() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { state } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState(false);
  const jump = params.get('jump');

  function go(stop: AnyStop) {
    try {
      enterExample(stop);
      setError(false);
      void navigate(routeOf(stop), { replace: false });
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    track('example_opened', '22', { entry: (state as { entry?: string } | null)?.entry === 'welcome' ? 'welcome' : 'direct' });
    if (isStop(jump)) {
      enterExample(jump);
      void navigate(routeOf(jump), { replace: true });
    }
    // once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell screen="22" header={{ back: '/', brand: 'Fair Trial', concept: true }}>
      <div className={styles.head}>
        <div>
          <span className={styles.tag} data-testid="example-tag">Example trial</span>
          <h1 className={styles.h1}>See the whole trial in a minute</h1>
        </div>
        <DrMehr pose="wave" size={82} alt="" className={styles.mehr} />
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          The example couldn&apos;t load. Try again.
        </p>
      ) : null}
      <ol className={styles.list}>
        {MOMENTS.map((m, i) => (
          <li key={m.key}>
            <button
              type="button"
              className={styles.card}
              data-testid={`moment-${m.key}`}
              onClick={() => (m.stop ? go(m.stop) : setMoreOpen(true))}
            >
              <span className={styles.thumb} style={{ background: m.tint }}>
                {'mascot' in m.art ? <Mascot id={m.art.mascot} size={52} alt="" /> : <DrMehr pose={m.art.pose} size={40} alt="" />}
              </span>
              <span className={styles.text}>
                <span className={styles.label}>
                  <span className={styles.no}>{i + 1}</span> {m.label}
                </span>
                <span className={styles.title}>{m.title}</span>
              </span>
              <Icon name="chevron" size={22} className={styles.chev} />
            </button>
          </li>
        ))}
      </ol>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More endings">
        <ul className={styles.endings}>
          {ENDINGS.map((e) => (
            <li key={e.stop}>
              <button
                type="button"
                className={styles.ending}
                data-testid={`ending-${e.stop}`}
                onClick={() => {
                  setMoreOpen(false);
                  go(e.stop);
                }}
              >
                <b>{e.label}</b>
                <span>{e.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </AppShell>
  );
}
