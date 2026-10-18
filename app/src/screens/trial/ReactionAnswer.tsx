import { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { DayLogEntry, ReactionReport } from '../../contracts';
import { ESCALATION_LINE, pauseEntries, triageReaction } from '../../engine';
import { GREEN_WINDOW_DAYS } from '../../engine/config';
import { addReaction, clockFor } from '../../state/trial';
import { track } from '../../state/vault';
import { AppShell, BottomBar, DrMehr, Icon, Mascot, PlaceholderRulesNote, PrimaryButton, ResultCard, TextLink, TrafficLight } from '../../ui';
import { DOCTOR_URL, shortDate, shortName } from './components/format';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

const sig = (r: ReactionReport) => `${r.useDay}|${[...r.symptoms].sort().join(',')}|${r.severity}`;

/** Screen 13: traffic-light answer with one action. Cute steps back. */
export default function ReactionAnswer() {
  const s = useTrialScreen();
  const location = useLocation();
  const report = (location.state as { report?: ReactionReport } | null)?.report;
  const plan = s.plan;

  const result = useMemo(() => (report && plan ? triageReaction(report, plan.shelf) : undefined), [report, plan]);
  const pauses: DayLogEntry[] = useMemo(() => {
    if (!result || !plan?.day0) return [];
    if (result.light === 'amber') return pauseEntries(s.today);
    if (result.light === 'red') return pauseEntries(s.today, 'reaction-red', 1);
    return [];
  }, [result, plan?.day0, s.today]);

  useEffect(() => {
    if (!report || !result || !plan) return;
    track('reaction_answer_shown', '13', { light: result.light, rule_id: result.ruleId, likely_cause_class: result.likelyCause?.ingredientClass ?? null });
    // Log once per report: opening the screen again, or the example's seeded reaction, adds nothing.
    if (plan.reactions.some((r) => sig(r.report) === sig(report))) return;
    addReaction({ report, result }, pauses);
    if (pauses.length > 0) track('use_day_logged', '13', { status: 'paused', source: result.light === 'red' ? 'reaction-red' : 'reaction-amber' });
    // once per report
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.at]);

  if (s.gate !== undefined) return s.gate;
  if (!plan) return null;
  if (!report || !result) return <Navigate to="/help" replace />;

  const level = result.light;
  const cause = result.likelyCause;
  const causeItem = cause ? plan.shelf.find((i) => i.id === cause.itemId) : undefined;
  const merged = new Set(pauses.map((p) => p.date));
  const newJudgeBy = plan.day0
    ? clockFor({ ...plan, dayLog: [...plan.dayLog.filter((e) => !merged.has(e.date)), ...pauses] }, s.today)?.judgeByDate
    : undefined;

  const title =
    level === 'green' ? 'Keep going.' : level === 'amber' ? 'Pause for 3 days.' : 'Stop using it.';
  const body =
    level === 'green'
      ? report.useDay <= GREEN_WINDOW_DAYS
        ? 'Common in the first 2 weeks. Skip a day if needed.'
        : 'Skip a day if needed. If it keeps happening, pause for 3 days.'
      : level === 'amber'
        ? 'Then use it every other night for a week before going back to every night.'
        : 'Show this to a doctor. Bring your skin file.';

  return (
    <AppShell screen="13" ground="plain" banner={s.banner} header={{ back: true, title: 'What to do' }}>
      <div className={styles.answerTop}>
        <TrafficLight level={level} title={title} art={<DrMehr pose="concerned" size={108} alt="" />}>
          <p>{body}</p>
          {level === 'amber' && newJudgeBy ? <p className={styles.newDate}>Your judge-by date moves to {shortDate(newJudgeBy)}.</p> : null}
        </TrafficLight>
      </div>

      {cause && causeItem ? (
        <ResultCard size="sm" padding="sm" className={styles.cause} data-testid="likely-cause">
          <Mascot id="rollon-worried" size={52} alt="" />
          <span className={styles.fence} aria-hidden="true">
            <Icon name="fence" size={22} />
          </span>
          <Mascot id="toner-worried" size={44} alt="" />
          <p>
            <b>Likely cause:</b> {shortName(causeItem)} on the same skin. {cause.fix}
          </p>
        </ResultCard>
      ) : null}

      {result.showEscalation ? (
        <ResultCard size="sm" padding="sm" data-testid="escalation">
          <p className={styles.escalation}>{ESCALATION_LINE}</p>
        </ResultCard>
      ) : null}
      <PlaceholderRulesNote />

      <BottomBar>
        {level === 'red' ? (
          <>
            <PrimaryButton href={DOCTOR_URL} external onClick={() => track('doctor_link_clicked', '13', { from: 'reaction-red' })}>
              Talk to the Bodywise in-app doctor
            </PrimaryButton>
            <TextLink to="/file" data-testid="secondary">
              Open my skin file
            </TextLink>
          </>
        ) : (
          <>
            <PrimaryButton to={plan.day0 ? '/trial' : '/start/routine'}>Got it</PrimaryButton>
            <TextLink to="/file" data-testid="secondary">
              Open my skin file
            </TextLink>
          </>
        )}
      </BottomBar>
    </AppShell>
  );
}
