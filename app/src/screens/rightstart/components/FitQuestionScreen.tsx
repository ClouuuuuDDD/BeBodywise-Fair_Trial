import { useNavigate } from 'react-router-dom';
import type { FitAnswers } from '../../../contracts';
import { fit as runFit } from '../../../engine';
import { track } from '../../../state';
import { answerFit, useRightStart } from '../../../state/rightStart';
import { AppShell, DrMehr, Mascot, OptionGroup, OptionRow } from '../../../ui';
import { fitQuestions } from '../copy';
import styles from './FitQuestionScreen.module.css';

type Step = 1 | 2 | 3 | 4 | 5;

const KEY: Record<Step, keyof FitAnswers> = {
  1: 'shade',
  2: 'duration',
  3: 'hairRemoval',
  4: 'darkNeck',
  5: 'regularPeriods',
};

const METER: Record<string, 0 | 1 | 2 | 3> = { same: 0, mild: 1, moderate: 2, severe: 3 };

/**
 * One fit question (screens 03b and 03): title, her answers as tap-to-advance rows, Dr. Mehr, the hint bubble.
 * Tapping an answer stores it and moves on; question 5 completes the check and opens the shelf (FR-M2-01).
 */
export function FitQuestionScreen({ step }: { step: Step }) {
  const s = useRightStart();
  const navigate = useNavigate();
  const q = fitQuestions[step];
  const current = s.fit[KEY[step]] as string | undefined;

  function choose(value: string) {
    answerFit(KEY[step], value as never);
    track('fit_answered', step === 1 ? '03b' : '03', { question: step, answer: value });
    if (step < 5) {
      void navigate(`/check/${step + 1}`);
      return;
    }
    const answers: FitAnswers = { ...s.fit, regularPeriods: value as FitAnswers['regularPeriods'] };
    const result = runFit(answers);
    track('fit_completed', '03', {
      shade: answers.shade ?? null,
      duration: answers.duration ?? null,
      hair_removal: answers.hairRemoval ?? null,
      neck: answers.darkNeck ?? null,
      periods: answers.regularPeriods ?? null,
      fit_outcome: result.outcome,
      hormone_note: result.hormoneNote,
    });
    void navigate('/check/shelf');
  }

  const first = step === 1;
  return (
    <AppShell
      screen={first ? '03b' : '03'}
      header={{ back: first ? '/' : `/check/${step - 1}`, title: `Right Start · ${step} of 5`, step: { current: step, total: 5 } }}
    >
      <DrMehr
        pose={first ? 'point' : 'curious'}
        size={first ? 140 : 150}
        loading="eager"
        className={first ? styles.doctorPoint : styles.doctorCurious}
        style={{ position: 'absolute' }}
      />
      <div className={first ? styles.headWide : styles.head}>
        <h1 className={styles.title}>{q.title}</h1>
        {q.hint ? <p className={styles.hint}>{q.hint}</p> : null}
      </div>
      <div className={first ? styles.optsFirst : styles.opts}>
        <OptionGroup label={q.title}>
          {q.answers.map((a) => (
            <OptionRow
              key={a.value}
              value={a.value}
              label={a.label}
              selected={current === a.value}
              onSelect={choose}
              meter={first ? METER[a.value] : undefined}
              right={a.value === 'razor' ? <Mascot id="razor" size={44} alt="" /> : undefined}
            />
          ))}
        </OptionGroup>
      </div>
      {q.bubble ? (
        <div className={styles.bubble}>
          <DrMehr pose="avatar" say={q.bubble} />
        </div>
      ) : null}
    </AppShell>
  );
}
