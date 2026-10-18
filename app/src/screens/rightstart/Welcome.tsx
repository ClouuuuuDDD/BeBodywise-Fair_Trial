import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import type { Channel } from '../../contracts';
import { AppShell, BottomBar, CornerRibbon, DrMehr, Mascot, PrimaryButton, ResultCard, Sparkle, TextLink } from '../../ui';
import { firstTime, setChannel, useRightStart } from '../../state/rightStart';
import { track } from '../../state';
import { startTour, useTour } from '../../state/tour';
import { welcome } from './copy';
import styles from './Welcome.module.css';

const DOOR_CHANNELS: readonly Channel[] = ['bodywise-product-page', 'amazon-qr', 'box-qr', 'shared-link'];

function channelFrom(src: string | null): Channel | undefined {
  return DOOR_CHANNELS.find((c) => c === src);
}

/** Screen 02: Welcome. One primary action; a saved plan routes on (FR-M1-04). */
export default function Welcome() {
  const s = useRightStart();
  const tour = useTour();
  const [params] = useSearchParams();
  const src = channelFrom(params.get('src'));

  useEffect(() => {
    if (!src || !firstTime(`door:${src}`)) return;
    setChannel(src);
    track('door_opened', '02', { channel: src });
  }, [src]);

  if (!s.ready) return null;

  if (s.plan) {
    const to = s.plan.day0 ? '/trial' : s.plan.verdict?.outcome === 'working' ? '/keep' : '/start';
    return <Navigate to={to} replace />;
  }
  if (src === 'box-qr') return <Navigate to="/start?src=box-qr" replace />;

  const channel = src ?? s.channel;

  return (
    <AppShell screen="02" header={{ brand: 'Fair Trial', concept: true }}>
      <DrMehr pose="wave" size={214} alt="Dr. Mehr waving hello" loading="eager" className={styles.doctor} />
      <div className={styles.intro}>
        <h1 className={styles.title}>{welcome.title}</h1>
        <p className={styles.lead}>{welcome.lead}</p>
      </div>
      <ResultCard ribbon={<CornerRibbon>1</CornerRibbon>} className={styles.cast} padding="none">
        <Mascot id="rollon" size={112} alt="Roll-on character" loading="eager" />
        <div className={styles.plates}>
          <span className={styles.plate}>{welcome.cardPlate}</span>
          <span className={`${styles.chip} ${styles.mint}`}>{welcome.cardChip1}</span>
          <span className={`${styles.chip} ${styles.butter}`}>{welcome.cardChip2}</span>
        </div>
        <Sparkle size={22} className={styles.spark} />
      </ResultCard>
      <ul className={styles.facts}>
        <li>
          <FactIcon d="clock" />
          {welcome.fact1}
        </li>
        <li>
          <FactIcon d="lock" />
          {welcome.fact2}
        </li>
        <li>
          <FactIcon d="phone" />
          {welcome.fact3}
        </li>
      </ul>
      <BottomBar>
        <PrimaryButton
          to="/check/1"
          icon={<Sparkle size={20} />}
          onClick={() => track('check_started', '02', { channel })}
        >
          {welcome.primary}
        </PrimaryButton>
        <TextLink to="/example">{welcome.secondary}</TextLink>
        {tour.on ? null : (
          <TextLink to="/check/1" data-testid="start-demo" onClick={() => startTour()}>
            {welcome.demo}
          </TextLink>
        )}
      </BottomBar>
    </AppShell>
  );
}

function FactIcon({ d }: { d: 'clock' | 'lock' | 'phone' }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--primary)', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false };
  if (d === 'clock')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (d === 'lock')
    return (
      <svg {...common}>
        <rect x="5" y="11" width="14" height="10" rx="3" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </svg>
  );
}
