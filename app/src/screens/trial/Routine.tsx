import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { ShelfItem } from '../../contracts';
import { ensureStartPlan } from '../../state/trial';
import { track } from '../../state/vault';
import { AppShell, BottomBar, Mascot, PlaceholderRulesNote, PrimaryButton, TextLink } from '../../ui';
import { MASCOTS, type MascotId } from '../../ui';
import { lowerFirst } from './components/format';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

const asMascot = (key: string | undefined, fallback: MascotId): MascotId =>
  key && Object.prototype.hasOwnProperty.call(MASCOTS, key) ? (key as MascotId) : fallback;

const isDeodorant = (i: ShelfItem | undefined) =>
  !!i && (i.classes.includes('antiperspirant') || i.classes.includes('drying-alcohol') || i.mascot === 'deodorant' || i.mascot === 'spray-can');

function Moon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    </svg>
  );
}

function Sun() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

/** Screen 07: Night / Morning / Keep apart, then three rules. */
export default function Routine() {
  const s = useTrialScreen();
  const { search } = useLocation();
  const fromHome = new URLSearchParams(search).get('from') === 'home';
  const plan = s.plan;
  useEffect(() => {
    if (plan && !plan.startPlan) ensureStartPlan();
  }, [plan]);

  if (s.gate !== undefined) return s.gate;
  if (!plan) return null;
  const sp = plan.startPlan;
  if (!sp) return null;

  const itemOf = (ref: string) => plan.shelf.find((i) => i.id === ref);
  const rollon: MascotId = sp.productId === 'bw-rollon-6' ? 'rollon-strong' : sp.productId.startsWith('bw-kit') ? 'cream-jar' : 'rollon-sleepy';
  const morningSteps = sp.morning.filter((m) => m.ref !== 'none');
  const first = morningSteps[0];
  const shareUrl = `${window.location.origin}/`;
  const shareText = `My roll-on routine from Fair Trial: ${shareUrl}`;

  async function share(e: React.MouseEvent) {
    if (typeof navigator.share === 'function') {
      e.preventDefault();
      try {
        await navigator.share({ text: shareText, url: shareUrl });
        track('routine_shared', '07', { method: 'web-share' });
      } catch {
        /* she closed the share sheet */
      }
    } else {
      track('routine_shared', '07', { method: 'whatsapp' });
    }
  }

  return (
    <AppShell
      screen="07"
      banner={s.banner}
      header={{ back: fromHome ? '/trial' : '/start', title: 'Day 0 · 1 of 3', planCode: plan.planCode }}
    >
      <h1 className={styles.h1}>Your routine</h1>

      <section className={`${styles.stage} ${styles.night}`} aria-label="Night">
        <Mascot id={rollon} size={86} alt="" />
        <div>
          <h2 className={styles.stageTitle}>Night</h2>
          <p className={styles.stageBody}>
            {sp.night.length > 0 && sp.productId.startsWith('bw-kit') ? `${sp.night[0]?.product}. ${sp.night[0]?.instruction}` : 'Roll-on. One swipe, on clean, dry skin.'}
          </p>
        </div>
        <span className={styles.stageIcon}>
          <Moon />
        </span>
      </section>

      <section className={`${styles.stage} ${styles.morning}`} aria-label="Morning">
        {first ? <Mascot id={asMascot(itemOf(first.ref)?.mascot, 'deodorant')} size={80} alt="" /> : <Mascot id="deodorant" size={80} muted alt="" />}
        <div>
          <h2 className={styles.stageTitle}>Morning</h2>
          {morningSteps.length === 0 ? (
            <p className={styles.stageBody}>Nothing else needed.</p>
          ) : (
            morningSteps.map((m) => (
              <p key={m.ref} className={styles.stageBody}>
                {isDeodorant(itemOf(m.ref)) ? 'Your usual deodorant.' : `${m.product}: ${lowerFirst(m.instruction)}`}
              </p>
            ))
          )}
        </div>
        <span className={styles.stageIcon}>
          <Sun />
        </span>
      </section>

      {sp.keepApart.map((k) => (
        <section key={k.ref} className={styles.apart} aria-label="Keep apart" data-testid="keep-apart">
          <Mascot id={asMascot(itemOf(k.ref)?.mascot, 'toner')} size={62} alt="" />
          <div>
            <h2 className={`${styles.stageTitle} ${styles.apartTitle}`}>Keep apart</h2>
            <p className={styles.stageBody}>
              {k.product}: {lowerFirst(k.reason)}
            </p>
          </div>
        </section>
      ))}

      <ol data-scroll-x tabIndex={0} aria-label="Three habits" className={styles.rules}>
        {sp.rules.map((r, i) => (
          <li key={i}>
            <span className={styles.ruleNo}>{i + 1}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
      <p className={styles.note}>{sp.onceADayNote}</p>
      <PlaceholderRulesNote />

      <BottomBar>
        <PrimaryButton
          to={fromHome ? '/trial' : '/start/photo?site=underarm'}
          onClick={() => track('routine_acknowledged', '07', { keep_apart_count: sp.keepApart.length })}
        >
          Got it
        </PrimaryButton>
        <TextLink href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} external onClick={(e) => void share(e)} data-testid="share-routine">
          <span className={styles.inlineIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
            Send to the person using it
          </span>
        </TextLink>
      </BottomBar>
    </AppShell>
  );
}
