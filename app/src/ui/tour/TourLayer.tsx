import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, diffDays } from '../../engine';
import { HALFWAY_USE_DAY, BOTTLE_DAYS, TRIAL_USE_DAYS } from '../../engine/config';
import { endTour, getTour, markChapterSeen, setTourToday, startTour, useTour } from '../../state/tour';
import { deleteEverything, useTrial } from '../../state/trial';
import { DrMehr } from '../DrMehr';
import { PrimaryButton } from '../PrimaryButton';
import { Sheet } from '../Sheet';
import { CHAPTERS, chapterById, chapterForPath } from './chapters';
import styles from './tour.module.css';

/** Use-days worth stopping at, with what happens there. */
const STOPS = [
  { useDay: 9, label: 'Day 9', hint: 'try "Something feels off"' },
  { useDay: HALFWAY_USE_DAY, label: `Day ${HALFWAY_USE_DAY}`, hint: 'halfway photo' },
  { useDay: BOTTLE_DAYS, label: `Day ${BOTTLE_DAYS}`, hint: 'bottle running low' },
  { useDay: TRIAL_USE_DAYS, label: `Day ${TRIAL_USE_DAYS}`, hint: 'verdict' },
];

/**
 * Guided demo: a slim bar on every screen while the demo is on (chapter, day control on the trial screens),
 * and a chapter card the first time each phase is reached. Start it with "Play the whole journey" on the
 * welcome screen or any URL with ?demo=1.
 */
export function TourLayer() {
  const tour = useTour();
  const [params, setParams] = useSearchParams();

  // ?demo=1 starts the demo once, then leaves the address bar so "End" stays ended.
  useEffect(() => {
    if (params.get('demo') !== '1') return;
    if (!getTour().on) startTour();
    const next = new URLSearchParams(params);
    next.delete('demo');
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Only read her trial while the demo is on: with the demo off, nothing here touches the vault.
  return tour.on ? <TourOn /> : null;
}

function TourOn() {
  const tour = useTour();
  const t = useTrial();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [cardOpen, setCardOpen] = useState(false);

  const plan = t.isExample ? undefined : t.plan;
  const settled = !!plan && (!!plan.stopped || !!plan.verdict);
  const chapterId = t.isExample ? undefined : chapterForPath(pathname, settled);
  const unseen = !!chapterId && !tour.seen.includes(chapterId);

  if (t.isExample) return null;

  const chapter = chapterId ? chapterById(chapterId) : undefined;
  const closeCard = () => {
    setCardOpen(false);
    if (chapterId) markChapterSeen(chapterId);
  };

  const trial = t.trial;
  const showDays = chapterId === 'using' && !!plan?.day0 && !!trial && !settled;
  const lateDays = trial ? trial.pausedDays + trial.skippedDays : 0;
  const jumpTo = (useDay: number) => {
    if (!plan?.day0) return;
    setTourToday(addDays(plan.day0, useDay + lateDays));
  };
  const calendarDay = plan?.day0 ? diffDays(t.today, plan.day0) : 0;

  const restart = async () => {
    await deleteEverything();
    startTour();
    void navigate('/');
  };

  return (
    <>
      <div className={styles.bar} data-testid="tour-bar">
        <div className={styles.row}>
          <span className={styles.tag}>Demo</span>
          <span className={styles.chapter}>
            {chapter ? (chapter.id === 'bodywise' ? 'For Be Bodywise' : `${chapter.label.replace(/^Chapter (\d) of (\d)$/, '$1/$2')} · ${chapter.short}`) : 'The whole journey'}
          </span>
          <span className={styles.actions}>
            {chapter ? (
              <button type="button" className={styles.link} onClick={() => setCardOpen(true)}>
                About
              </button>
            ) : null}
            <button type="button" className={styles.link} onClick={() => void restart()}>
              Restart
            </button>
            <button type="button" className={styles.link} onClick={endTour}>
              End
            </button>
          </span>
        </div>
        {showDays ? (
          <div className={styles.days} data-testid="tour-days">
            <span className={styles.today} title={calendarDay !== trial.useDaysSoFar ? `${calendarDay} days on the calendar` : undefined}>
              Day {trial.useDaysSoFar} of {TRIAL_USE_DAYS}
            </span>
            <div className={styles.jumps}>
              <button type="button" className={styles.jump} onClick={() => jumpTo(trial.useDaysSoFar + 1)}>
                +1 day
              </button>
              {STOPS.filter((s) => s.useDay > trial.useDaysSoFar).map((s) => (
                <button key={s.useDay} type="button" className={styles.jump} title={s.hint} onClick={() => jumpTo(s.useDay)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {chapterId === 'verdict' && pathname === '/verdict' ? (
          <div className={styles.days}>
            <Link className={styles.jump} to="/example?jump=not-for-you-calm" data-testid="tour-other-ending">
              See the other ending: Not for you →
            </Link>
          </div>
        ) : null}
        {chapterId === 'after' && pathname !== '/verdict/share' ? (
          <div className={styles.days}>
            <Link className={styles.jump} to="/insights">
              Last stop: what Bodywise learns →
            </Link>
          </div>
        ) : null}
      </div>

      {chapter ? (
        <Sheet
          open={cardOpen || unseen}
          onClose={closeCard}
          title={`${chapter.label} · ${chapter.title}`}
          footer={<PrimaryButton onClick={closeCard}>{chapter.id === 'bodywise' ? 'Show me' : 'Start this chapter'}</PrimaryButton>}
        >
          <div className={styles.card} data-testid={`tour-card-${chapter.id}`}>
            <div className={styles.cardHead}>
              <DrMehr pose={chapter.pose} size={56} alt="" className={styles.mehr} />
              {chapter.bridge ? <p className={styles.bridge}>{chapter.bridge}</p> : null}
            </div>
            <dl className={styles.points}>
              <dt>Without the app</dt>
              <dd>{chapter.problem}</dd>
              <dt>What this part does</dt>
              <dd>{chapter.solves}</dd>
              <dt>Try this</dt>
              <dd>{chapter.tryThis}</dd>
            </dl>
            <ol className={styles.map} aria-label="The journey">
              {CHAPTERS.filter((c) => c.id !== 'bodywise').map((c) => (
                <li key={c.id} className={c.id === chapter.id ? styles.here : undefined}>
                  {c.short}
                </li>
              ))}
            </ol>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
