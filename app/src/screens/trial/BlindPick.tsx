import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { BlindPickSays } from '../../contracts';
import { getExample } from '../../state/example';
import { hasVerdictPhotos, photoUrl, setBlindPick } from '../../state/trial';
import { track } from '../../state/vault';
import { AppShell, BottomBar, CornerRibbon, DrMehr, PrimaryButton } from '../../ui';
import { latest } from './components/capture';
import { ExamplePhoto } from './components/ExamplePhoto';
import { shortDate } from './components/format';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

const ORDER_KEY = 'ft-blind-order';

/** Which photo is shown as A. Random per trial, then kept so a refresh cannot reveal anything (FR-M10-01). */
function orderFor(seeded: 'day0' | 'now' | undefined): 'day0' | 'now' {
  if (seeded) return seeded;
  try {
    const kept = sessionStorage.getItem(ORDER_KEY);
    if (kept === 'day0' || kept === 'now') return kept;
    const made = Math.random() < 0.5 ? 'day0' : 'now';
    sessionStorage.setItem(ORDER_KEY, made);
    return made;
  } catch {
    return 'now';
  }
}

function Slot({ letter, src, example, verdictDay, lighter, color, onPick }: { letter: 'A' | 'B'; src: string | undefined; example: boolean; verdictDay: boolean; lighter: boolean; color: string; onPick: () => void }) {
  return (
    <div className={styles.pickCard}>
      <CornerRibbon color={color} offset={14}>
        {letter}
      </CornerRibbon>
      <div className={styles.photoFrame}>
        {src ? <img src={src} alt={`Photo ${letter}`} /> : example ? <ExamplePhoto region="underarm" moment={verdictDay ? 'verdict' : 'day0'} lighter={lighter} alt={`Photo ${letter}`} /> : null}
      </div>
      <button type="button" className={styles.thisOne} data-testid={`pick-${letter}`} onClick={onPick}>
        This one
      </button>
    </div>
  );
}

/** Screen 16: her own eye decides first. Day 0 and today, shuffled, nothing that says which is which. */
export default function BlindPick() {
  const s = useTrialScreen();
  const navigate = useNavigate();
  const [aIs] = useState<'day0' | 'now'>(() => orderFor(s.isExample ? getExample()?.plan.blindPick?.shownAsA ?? 'now' : undefined));

  if (s.gate !== undefined) return s.gate;
  const plan = s.plan;
  if (!plan) return null;
  if (!s.isExample && !hasVerdictPhotos(s.photos)) return <Navigate to="/verdict/photo" replace />;

  const day0 = photoUrl(latest(s.photos, 'day0', 'underarm'));
  const now = photoUrl(latest(s.photos, 'verdict', 'underarm'));
  const srcA = aIs === 'now' ? now : day0;
  const srcB = aIs === 'now' ? day0 : now;
  // Example only: the verdict-day picture is lighter on the Working path (the seeded pick says so), same tone otherwise.
  const lighter = s.isExample && getExample()?.plan.blindPick?.says === 'now-lighter';

  function choose(choice: 'A' | 'B' | 'same') {
    const says: BlindPickSays = choice === 'same' ? 'same' : (choice === 'A') === (aIs === 'now') ? 'now-lighter' : 'day0-lighter';
    setBlindPick({ shownAsA: aIs, choice, says, at: new Date().toISOString() });
    track('blind_pick_answered', '16', { choice: says, order: aIs === 'day0' ? 'AB' : 'BA' });
    void navigate('/verdict');
  }

  return (
    <AppShell
      screen="16"
      banner={s.banner}
      header={{ back: true, title: `Judge-by date · ${s.trial ? shortDate(s.trial.judgeByDate) : ''}`, planCode: plan.planCode }}
    >
      <div className={styles.photoHead}>
        <div>
          <h1 className={styles.h1}>Which one looks lighter?</h1>
          <p className={styles.lead}>Day 0 and today, shuffled. Your eye decides first.</p>
        </div>
        <DrMehr pose="curious" size={96} alt="" className={styles.photoMehr} />
      </div>
      <div className={styles.photoPair}>
        <Slot letter="A" src={srcA} example={s.isExample} verdictDay={aIs === 'now'} lighter={lighter} color="var(--violet)" onPick={() => choose('A')} />
        <Slot letter="B" src={srcB} example={s.isExample} verdictDay={aIs !== 'now'} lighter={lighter} color="var(--pink)" onPick={() => choose('B')} />
      </div>
      <p className={styles.note}>Your pick is one of two reads. The other compares each photo with your inner arm.</p>
      <BottomBar>
        <PrimaryButton variant="secondary" data-testid="secondary" onClick={() => choose('same')}>
          They look the same to me
        </PrimaryButton>
      </BottomBar>
    </AppShell>
  );
}
