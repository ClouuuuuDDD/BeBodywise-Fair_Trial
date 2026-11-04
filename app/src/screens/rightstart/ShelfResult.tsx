import { useEffect, useState } from 'react';
import { track } from '../../state';
import { firstTime, retryShelfReview, shelfAnswersFor, useRightStart } from '../../state/rightStart';
import { AppShell, BottomBar, DrMehr, Mascot, PlaceholderRulesNote, PrimaryButton, TextLink } from '../../ui';
import { FitGuard } from './components/FitGuard';
import { DOCTOR_URL } from './components/links';
import { ACTION_LABEL, REVIEW_COPY, orderForReview, reviewSummary } from './components/reviewCopy';
import { AI_REVIEW_LABEL } from '../../engine/config';
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

  const stopFirst = s.shelf.some((i) => i.review?.action === 'ask-doctor');
  const rows = orderForReview(s.shelf);
  const [busy, setBusy] = useState<string | undefined>();
  async function retry(id: string) {
    if (busy) return;
    setBusy(id);
    await retryShelfReview(id);
    setBusy(undefined);
  }

  return (
    <AppShell screen="05" ground={stopFirst ? 'plain' : 'dots'} header={{ back: '/check/shelf', title: t.runningHead }}>
      <div className={styles.intro}>
        <div className={styles.introText}>
          <h1 className={styles.title} aria-live="polite" data-testid="review-summary">{reviewSummary(s.shelf, s.checking.length)}</h1>
          {rows.length > 0 ? <p className={styles.lead}>{REVIEW_COPY.lead}</p> : null}
        </div>
        <DrMehr pose="clipboard" size={74} alt="Dr. Mehr with a clipboard" />
      </div>
      <ul className={styles.rows}>
        {rows.map((item) => {
          const rv = item.review;
          const running = s.checking.includes(item.id);
          const ok = !running && rv?.status === 'ok' && rv.action !== undefined;
          const action = ok ? rv.action! : undefined;
          const state = action ?? (running ? 'checking' : 'unchecked');
          const worried = action === 'stop-on-skin' || action === 'ask-doctor';
          const base = mascotForItem(item);
          return (
            <li key={item.id} className={styles.row} data-testid="review-row" data-action={state}>
              <Mascot id={worried ? worriedFor(base) : base} size={52} alt="" />
              <div>
                <span className={styles.pill} data-action={state}>
                  {action ? ACTION_LABEL[action] : running ? REVIEW_COPY.checking : REVIEW_COPY.unchecked}
                </span>
                <span className={styles.name}>{item.product}</span>
                {ok && rv.culprits.length > 0 ? (
                  <p className={styles.text} data-testid="culprits">
                    {REVIEW_COPY.culprits}{' '}
                    {rv.culprits.map((c, n) => (
                      <span key={`${c.ingredient}-${n}`}>{n > 0 ? ', ' : ''}<b>{c.ingredient}</b></span>
                    ))}
                  </p>
                ) : null}
                {ok && rv.actionWhy ? <p className={styles.text}>{rv.actionWhy}</p> : null}
                {ok && rv.mayWorsenDarkness ? (
                  <p className={styles.flag} data-testid="darkness-flag">
                    <b>{REVIEW_COPY.darkness}.</b> {rv.darknessWhy ?? ''}
                  </p>
                ) : null}
                {ok && rv.provider === 'rules' ? (
                  <p className={styles.unsure} data-testid="rules-review">
                    {REVIEW_COPY.byRules}{' '}
                    <TextLink onClick={() => void retry(item.id)} data-testid="retry-review">
                      {REVIEW_COPY.retryAi}
                    </TextLink>
                  </p>
                ) : ok && rv.confidence === 'low' ? (
                  <p className={styles.unsure}>{REVIEW_COPY.lowConfidence}</p>
                ) : null}
                {running ? <p className={styles.text}>{REVIEW_COPY.checkingLine}</p> : null}
                {!ok && !running ? (
                  <p className={styles.text}>
                    {REVIEW_COPY.failed}{' '}
                    <TextLink onClick={() => void retry(item.id)} data-testid="retry-review">
                      {REVIEW_COPY.retry}
                    </TextLink>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className={styles.note}>
        <PlaceholderRulesNote text={AI_REVIEW_LABEL} />
      </div>
      <BottomBar sticky>
        {/* The plan copies the shelf when saved, so she moves on once every answer is in. */}
        <PrimaryButton to="/check/match" loading={s.checking.length > 0}>{t.primary}</PrimaryButton>
        {stopFirst ? (
          <TextLink href={DOCTOR_URL} external onClick={() => track('doctor_link_clicked', '05', { from: 'stop-ask' })} data-testid="doctor-link">
            {match.doctor}
          </TextLink>
        ) : null}
      </BottomBar>
    </AppShell>
  );
}
