import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TrialEvent } from '../../contracts';
import { setConsent } from '../../state/trial';
import { track } from '../../state/vault';
import { AppShell, BottomBar, DrMehr, Icon, PrimaryButton, ResultCard, Sheet, TextLink } from '../../ui';
import { buildSharePayload, fieldCount, payloadRows } from './components/sharePayload';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

const SHARED = ['Your verdict', 'Days used', 'Fit answers', "Your shelf (classes, not other brands' names)", 'Reactions', 'How much your photos changed (a range only)', 'Whether your pick agreed', 'How you found us', 'Week of the year'];
const SHARED_STOP = ['Why you stopped', 'Days used', 'Fit answers', 'Your shelf', 'Reactions'];
const NEVER = ['Photos', 'Your name', 'Your number', 'Your location'];

/** Screen 19: Part 2 opt-in, showing exactly what is and isn't shared. */
export default function ShareResult() {
  const s = useTrialScreen();
  const navigate = useNavigate();
  const stop = new URLSearchParams(useLocation().search).get('stop') === '1';
  const [payload, setPayload] = useState<TrialEvent[] | undefined>();
  const [seeOpen, setSeeOpen] = useState(false);

  if (s.gate !== undefined) return s.gate;
  const plan = s.plan;
  if (!plan) return null;

  const working = plan.verdict?.outcome === 'working';
  const next = stop ? '/trial' : working ? '/keep' : '/trial';
  const scope: ('outcome' | 'use-days' | 'fit-answers' | 'shelf-classes' | 'reactions' | 'stop-reason')[] = stop
    ? ['stop-reason', 'use-days', 'fit-answers', 'shelf-classes', 'reactions']
    : ['outcome', 'use-days', 'fit-answers', 'shelf-classes', 'reactions'];

  function yes() {
    if (!plan) return;
    const built = buildSharePayload({ plan, trial: s.trial, photos: s.photos, example: s.isExample, today: s.today, stop });
    setPayload(built);
    setConsent({ shared: true, at: new Date().toISOString(), scope, payload: built });
    track('share_answered', '19', { choice: 'yes' });
    track('share_payload_prepared', '19', { field_count: fieldCount(built) });
  }

  function no() {
    setConsent({ shared: false, at: new Date().toISOString(), scope: [] });
    track('share_answered', '19', { choice: 'no' });
    void navigate(next);
  }

  const items = stop ? SHARED_STOP : SHARED;

  return (
    <AppShell screen="19" ground="plain" banner={s.banner} header={{ back: true, title: 'Optional' }}>
      <div className={styles.photoHead}>
        <div>
          <h1 className={styles.h1}>{stop ? 'Help the next woman understand why?' : 'Help the next woman decide?'}</h1>
          <p className={styles.lead}>
            {stop
              ? 'Your reason, shared anonymously, helps Be Bodywise fix what made people stop.'
              : 'Your result, shared anonymously, tells future buyers how often it works for skin like theirs, before they pay.'}
          </p>
        </div>
        <DrMehr pose="proud" size={100} alt="" className={styles.photoMehr} />
      </div>

      <div className={styles.shareCols}>
        <ResultCard size="sm" padding="sm" highlight>
          <span className={`${styles.plate} ${styles.plateBlue}`}>Shared</span>
          <ul className={styles.shareList} data-testid="shared-list">
            {items.map((i) => (
              <li key={i}>
                <Icon name="check" size={16} strokeWidth={3} />
                {i}
              </li>
            ))}
          </ul>
        </ResultCard>
        <ResultCard size="sm" padding="sm">
          <span className={`${styles.plate} ${styles.plateGrey}`}>Never shared</span>
          <ul className={styles.shareList} data-testid="never-list">
            {NEVER.map((i) => (
              <li key={i} className={styles.never}>
                <Icon name="close" size={16} strokeWidth={3} />
                {i}
              </li>
            ))}
          </ul>
        </ResultCard>
      </div>
      <p className={styles.note}>You can delete everything from this phone at any time.</p>

      {payload ? (
        <div className={styles.thanks} role="status" data-testid="share-thanks">
          <p>Thank you. In this concept, nothing is sent. This is what would be shared.</p>
          <TextLink layout="inline" onClick={() => setSeeOpen(true)} data-testid="see-shared">
            See exactly what would be shared
          </TextLink>
        </div>
      ) : null}

      <BottomBar>
        {payload ? (
          <PrimaryButton onClick={() => void navigate(next)}>Continue</PrimaryButton>
        ) : (
          <>
            <PrimaryButton onClick={yes}>Yes, share anonymously</PrimaryButton>
            <TextLink onClick={no} data-testid="secondary">
              No thanks
            </TextLink>
          </>
        )}
      </BottomBar>

      <Sheet open={seeOpen} onClose={() => setSeeOpen(false)} title="What would be shared">
        <div data-testid="payload-list">
          {payload
            ? payloadRows(payload).map((row, i) => (
                <section key={i} className={styles.payloadRow}>
                  <h3>{row.heading}</h3>
                  <ul>
                    {row.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </section>
              ))
            : null}
        </div>
      </Sheet>
    </AppShell>
  );
}
