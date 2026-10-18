import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactionReport, Severity, Symptom } from '../../contracts';
import { suspectItem } from '../../engine';
import { getExample } from '../../state/example';
import { track } from '../../state/vault';
import { AppShell, BottomBar, CheckChip, Mascot, OptionGroup, OptionRow, PrimaryButton } from '../../ui';
import { nowIso, shortName } from './components/format';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

const SYMPTOMS: { value: Symptom; label: string }[] = [
  { value: 'stinging', label: 'Stinging' },
  { value: 'redness', label: 'Redness' },
  { value: 'flaking', label: 'Flaking' },
  { value: 'itching', label: 'Itching' },
  { value: 'darker', label: 'Darker than before' },
  { value: 'bumps-rash', label: 'Bumps or rash' },
];

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'bothering', label: 'Bothering me' },
  { value: 'painful', label: 'Painful' },
];

/** Screen 12: two taps (what, how bad), one shelf follow-up if it matters. */
export default function FeelsOff() {
  const s = useTrialScreen();
  const navigate = useNavigate();
  // Example Day 9: the screen opens filled in with the reaction Riya reported.
  const seed = s.isExample && getExample()?.stop === 'day-9' ? s.plan?.reactions[0]?.report : undefined;
  const [symptoms, setSymptoms] = useState<Symptom[]>(seed?.symptoms ?? []);
  const [severity, setSeverity] = useState<Severity | undefined>(seed?.severity);
  const [used, setUsed] = useState<'yes' | 'no' | undefined>(seed?.usedSuspect?.answer);

  if (s.gate !== undefined) return s.gate;
  const plan = s.plan;
  if (!plan) return null;

  const suspect = suspectItem(plan.shelf);
  const useDay = s.trial?.useDaysSoFar ?? 0;
  const ready = symptoms.length > 0 && severity !== undefined;

  function submit() {
    if (!ready || !severity || !plan) return;
    const report: ReactionReport = {
      at: nowIso(),
      symptoms,
      severity,
      useDay,
      ...(suspect && used ? { usedSuspect: { itemId: suspect.id, answer: used } } : {}),
    };
    track('reaction_reported', '12', {
      symptoms,
      severity,
      use_day: useDay,
      follow_up_asked: !!suspect,
      follow_up_answer: suspect && used ? used : null,
    });
    void navigate('/help/answer', { state: { report } });
  }

  return (
    <AppShell
      screen="12"
      banner={s.banner}
      header={{ back: true, title: plan.day0 ? `Fair Trial · Day ${useDay}` : 'Right Start' }}
    >
      <div className={styles.helpHead}>
        <h1 className={styles.h1}>What&apos;s happening?</h1>
        <Mascot id="rollon-worried" size={96} alt="" className={styles.helpMascot} />
      </div>
      <div className={styles.chips} role="group" aria-label="What's happening?">
        {SYMPTOMS.map((x) => (
          <CheckChip
            key={x.value}
            value={x.value}
            label={x.label}
            checked={symptoms.includes(x.value)}
            onChange={(on) => setSymptoms((cur) => (on ? [...cur, x.value] : cur.filter((v) => v !== x.value)))}
          />
        ))}
      </div>

      <h2 className={styles.h2}>How bad is it?</h2>
      <OptionGroup label="How bad is it?" columns={3}>
        {SEVERITIES.map((x) => (
          <OptionRow key={x.value} variant="segment" value={x.value} label={x.label} selected={severity === x.value} onSelect={(v) => setSeverity(v as Severity)} />
        ))}
      </OptionGroup>

      {suspect ? (
        <div className={styles.followUp} data-testid="follow-up">
          <Mascot id="toner-worried" size={54} alt="" />
          <div>
            <p className={styles.followQ}>Did you use your {shortName(suspect, true)} there?</p>
            <p className={styles.followWhy}>Asked because it&apos;s on your shelf.</p>
            <div className={styles.pills}>
              <button type="button" className={`${styles.pill} ${used === 'yes' ? styles.pillOn : ''}`} aria-pressed={used === 'yes'} data-testid="follow-yes" onClick={() => setUsed('yes')}>
                Yes, yesterday
              </button>
              <button type="button" className={`${styles.pill} ${used === 'no' ? styles.pillOn : ''}`} aria-pressed={used === 'no'} data-testid="follow-no" onClick={() => setUsed('no')}>
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomBar>
        <PrimaryButton disabled={!ready} onClick={submit}>
          See what to do
        </PrimaryButton>
      </BottomBar>
    </AppShell>
  );
}
