import { useEffect, useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import type { BodywiseProductId, Channel } from '../../contracts';
import { AppShell, BottomBar, DrMehr, PrimaryButton, Sparkle, TextLink } from '../../ui';
import { catalog, productPrice } from '../../engine';
import { firstTime, selectProduct, setChannel, useRightStart } from '../../state/rightStart';
import { track } from '../../state';
import { startTour, useTour } from '../../state/tour';
import { ProductArt } from './components/ProductArt';
import { RANGE_NAMES } from './components/rangeNames';
import { parseSelectedProduct } from './components/selectedProduct';
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
  const productParam = params.get('product');

  const selected: BodywiseProductId = productParam !== null ? parseSelectedProduct(productParam) : s.selectedProductId ?? parseSelectedProduct(null);
  const rangeRef = useRef<HTMLDivElement>(null);

  // Bring her pick into view inside the strip itself (never scrolls the page).
  useEffect(() => {
    const strip = rangeRef.current;
    const card = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !card) return;
    strip.scrollLeft = Math.max(0, card.offsetLeft - (strip.clientWidth - card.offsetWidth) / 2);
  }, [selected, s.ready]);

  useEffect(() => {
    if (productParam !== null) selectProduct(parseSelectedProduct(productParam));
  }, [productParam]);

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
  const name = catalog.products.find((p) => p.id === selected)?.name ?? RANGE_NAMES[selected];

  return (
    <AppShell screen="02" header={{ brand: 'Fair Trial', concept: true }}>
      <DrMehr pose="wave" size={214} alt="Dr. Mehr waving hello" loading="eager" className={styles.doctor} />
      <div className={styles.intro}>
        <h1 className={styles.title}>
          {welcome.picked} <b>{`${name} (Rs ${productPrice(selected)})`}</b>.
        </h1>
        <p className={styles.lead}>{welcome.range(catalog.products.length)}</p>
      </div>
      <div ref={rangeRef} className={styles.rangeScroll} role="region" aria-label={welcome.rangeLabel} data-scroll-x tabIndex={0}>
      <ul className={styles.range} data-testid="pick-range" role="list">
        {catalog.products.map((p) => {
          const id = p.id as BodywiseProductId;
          const mine = id === selected;
          return (
            <li key={id} className={styles.rangeItem} aria-current={mine || undefined} data-selected={mine || undefined}>
              <ProductArt id={id} size={52} />
              <span className={styles.rangeName}>{RANGE_NAMES[id]}</span>
              <span className={styles.rangePrice}>{`Rs ${productPrice(id)}`}</span>
              <span className={styles.rangeFor}>{p.for}</span>
              {mine ? (
                <>
                  <span className={styles.rangeMine} aria-hidden="true">{welcome.yourPick}</span>
                  <span className="sr-only">{welcome.yourPick}</span>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
      </div>
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
