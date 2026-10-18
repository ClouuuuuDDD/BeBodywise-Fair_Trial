import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { PhotoMoment, PhotoRegion } from '../../contracts';
import { CameraCapture, fixLines } from '../../photo';
import { hasDay0Photos, skipPhotos } from '../../state/trial';
import { track } from '../../state/vault';
import { AppShell, BottomBar, DrMehr, PrimaryButton, PrivacyChip, TextLink } from '../../ui';
import { processCapture } from './components/capture';
import { ExamplePhoto } from './components/ExamplePhoto';
import { halfwayKey, writeFlag } from './components/flags';
import { shortDate } from './components/format';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

type Phase = { kind: 'ready' } | { kind: 'checking' } | { kind: 'fail'; lines: string[] } | { kind: 'skip' } | { kind: 'halfway-done' };

/** The camera card without a camera: the example has no real photos, so it stages the shot. */
function StagedCamera({ site, moment, onTake }: { site: PhotoRegion; moment: PhotoMoment; onTake: () => void }) {
  return (
    <div data-testid="camera-capture">
      <div className={styles.staged}>
        <ExamplePhoto fill region={site} moment={moment === 'verdict' ? 'verdict' : 'day0'} alt={`Example ${site === 'underarm' ? 'underarm' : 'inner arm'} photo guide`} />
        <p className={styles.stagedInstr}>
          {site === 'underarm' ? 'Lift your arm. Fit your underarm in the oval.' : 'Turn your arm. Fit your inner arm in the oval.'}
        </p>
      </div>
      <p className={styles.tip}>Hold a plain white paper in the corner. Face a window, no flash.</p>
      <PrimaryButton onClick={onTake}>Take photo</PrimaryButton>
    </div>
  );
}

/** Screen 08: guided photo on Day 0; reused for the halfway and verdict photos. */
export default function StartingPhoto() {
  const s = useTrialScreen();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const site: PhotoRegion = new URLSearchParams(search).get('site') === 'inner-arm' ? 'inner-arm' : 'underarm';
  const moment: PhotoMoment = pathname.startsWith('/verdict') ? 'verdict' : pathname.startsWith('/trial') ? 'halfway' : 'day0';
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });

  if (s.gate !== undefined) return s.gate;
  const plan = s.plan;
  if (!plan) return null;
  // Verdict day without Day 0 photos: nothing to compare, so her own eye answers (verdict V3).
  if (moment === 'verdict' && !s.isExample && !hasDay0Photos(s.photos)) return <Navigate to="/verdict" replace />;

  const base = moment === 'verdict' ? '/verdict/photo' : moment === 'halfway' ? '/trial/halfway' : '/start/photo';
  const useDay = s.trial?.useDaysSoFar ?? 0;

  function advance() {
    if (site === 'underarm') {
      void navigate(`${base}?site=inner-arm`);
      return;
    }
    if (moment === 'day0') void navigate('/start/photo/check');
    else if (moment === 'verdict') void navigate('/verdict/pick');
    else {
      writeFlag(halfwayKey(s.isExample), s.isExample);
      track('halfway_photo_taken', '08', { use_day: useDay });
      setPhase({ kind: 'halfway-done' });
    }
  }

  async function onCapture(frames: Blob[]) {
    setPhase({ kind: 'checking' });
    try {
      const out = await processCapture(frames, site, moment, s.photos);
      if (out.ok) {
        setPhase({ kind: 'ready' });
        advance();
      } else {
        setPhase({ kind: 'fail', lines: fixLines(out.failures) });
      }
    } catch {
      setPhase({ kind: 'fail', lines: ['I could not read that photo. Try again.'] });
    }
  }

  const planCode = plan.planCode;
  const head =
    moment === 'verdict'
      ? `Judge-by date · ${s.trial ? shortDate(s.trial.judgeByDate) : ''}`
      : moment === 'halfway'
        ? 'Fair Trial · Halfway'
        : `Day 0 · Photo ${site === 'underarm' ? 1 : 2} of 2`;

  if (phase.kind === 'halfway-done') {
    return (
      <AppShell screen="08" banner={s.banner} header={{ title: head, planCode }}>
        <h1 className={styles.h1}>Too early to judge.</h1>
        <p className={styles.lead} data-testid="halfway-result">Too early to judge. Here&apos;s your progress so far.</p>
        <div className={styles.halfwayCard}>
          <DrMehr pose="proud" size={104} alt="" />
          <p>Your check-in photos are saved on this phone. Your verdict comes at your judge-by date.</p>
        </div>
        <BottomBar>
          <PrimaryButton to="/trial">Back to my trial</PrimaryButton>
        </BottomBar>
      </AppShell>
    );
  }

  const title =
    moment === 'halfway' && site === 'underarm' ? "Halfway. Want to take a check-in photo?" : site === 'underarm' ? 'Your underarm, today' : 'Your inner arm, same light';
  const lead = moment === 'verdict' ? 'Same guide as Day 0, so the comparison is fair.' : 'So we can compare fairly in 8 weeks.';

  return (
    <AppShell screen="08" banner={s.banner} header={{ back: true, title: head, planCode }}>
      <div className={styles.photoHead}>
        <div>
          <h1 className={styles.h1}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </div>
        <DrMehr pose="camera" size={112} alt="" className={styles.photoMehr} />
      </div>

      <div className={styles.cam}>
        {s.isExample ? <StagedCamera site={site} moment={moment} onTake={advance} /> : <CameraCapture key={`${moment}-${site}`} site={site} onCapture={(f) => void onCapture(f)} />}
      </div>

      {phase.kind === 'checking' ? (
        <p role="status" className={styles.checking}>
          One moment…
        </p>
      ) : null}
      {phase.kind === 'fail' ? (
        <div className={styles.fail} role="alert" data-testid="photo-fail">
          {phase.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
          <PrimaryButton variant="secondary" size="sm" data-testid="retake" onClick={() => setPhase({ kind: 'ready' })}>
            Retake
          </PrimaryButton>
        </div>
      ) : null}

      <div className={styles.privacyRow}>
        <PrivacyChip>Photos never leave this phone</PrivacyChip>
      </div>

      <BottomBar>
        {phase.kind === 'skip' ? (
          <>
            <p className={styles.skipNote} data-testid="skip-note">
              Without photos, I can still give you a date to decide, but I can&apos;t measure the change.
            </p>
            <PrimaryButton
              onClick={() => {
                skipPhotos();
                track('photos_skipped', '08', { session: 'day0' });
                void navigate('/start/date');
              }}
            >
              Continue without photos
            </PrimaryButton>
          </>
        ) : moment === 'day0' ? (
          <TextLink onClick={() => setPhase({ kind: 'skip' })} data-testid="skip">
            Skip for now
          </TextLink>
        ) : moment === 'halfway' ? (
          <TextLink to="/trial">Not now</TextLink>
        ) : null}
      </BottomBar>
    </AppShell>
  );
}
