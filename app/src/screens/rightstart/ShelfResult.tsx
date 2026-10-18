import { useEffect } from 'react';
import { track } from '../../state';
import { firstTime, shelfAnswersFor, useRightStart } from '../../state/rightStart';
import { AppShell, BottomBar, DrMehr, Mascot, PlaceholderRulesNote, PrimaryButton, TextLink } from '../../ui';
import { FitGuard } from './components/FitGuard';
import { DOCTOR_URL } from './components/links';
import { answerLine, summaryLine } from './components/answerCopy';
import { mascotForItem, worriedFor } from './components/mascotFor';
import { answers as t, match } from './copy';
import styles from './ShelfResult.module.css';

/** Screen 05: How your shelf gets along. One answer per product, naming the product and the ingredient. */
export default function ShelfResult() {
  return (
    <FitGuard>
      <Answers />
    </FitGuard>
  );
}

function Answers() {
  const s = useRightStart();
  const answers = shelfAnswersFor(s.shelf);
  const count = (k: string) => answers.filter((a) => a.answer === k).length;
  const signature = answers.map((a) => `${a.itemId}:${a.answer}`).join('|');

  useEffect(() => {
    if (!firstTime(`shelf:${signature}`)) return;
    track('shelf_checked', '05', {
      item_count: answers.length,
      n_fine: count('fine'),
      n_split_time: count('split-time'),
      n_pick_one: count('pick-one'),
      n_wait: count('wait'),
      n_stop_ask: count('stop-ask'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const summary = summaryLine(answers);
  const stopFirst = answers.some((a) => a.answer === 'stop-ask');

  return (
    <AppShell screen="05" ground={stopFirst ? 'plain' : 'dots'} header={{ back: '/check/shelf', title: t.runningHead }}>
      <div className={styles.intro}>
        <div className={styles.introText}>
          <h1 className={styles.title}>{summary}</h1>
          {answers.length > 0 ? <p className={styles.lead}>{t.lead}</p> : null}
        </div>
        <DrMehr pose="clipboard" size={74} alt="Dr. Mehr with a clipboard" />
      </div>
      <ul className={styles.rows}>
        {answers.map((a) => {
          const item = s.shelf.find((i) => i.id === a.itemId);
          if (!item) return null;
          const worried = a.answer === 'pick-one' || a.answer === 'stop-ask';
          const base = mascotForItem(item);
          return (
            <li key={a.itemId} className={styles.row} data-testid="answer-row" data-answer={a.answer}>
              <Mascot id={worried ? worriedFor(base) : base} size={52} alt="" />
              <div>
                <span className={styles.pill} data-answer={a.answer}>
                  {t.label[a.answer]}
                </span>
                <span className={styles.name}>{item.product}</span>
                <p className={styles.text}>
                  {answerLine(a, item).map((p, i) => (p.strong ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className={styles.note}>
        <PlaceholderRulesNote />
      </div>
      <BottomBar sticky>
        <PrimaryButton to="/check/match">{t.primary}</PrimaryButton>
        {stopFirst ? (
          <TextLink href={DOCTOR_URL} external onClick={() => track('doctor_link_clicked', '05', { from: 'stop-ask' })} data-testid="doctor-link">
            {match.doctor}
          </TextLink>
        ) : null}
      </BottomBar>
    </AppShell>
  );
}
