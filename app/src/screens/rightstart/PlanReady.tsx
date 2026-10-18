import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BodywiseProductId, Plan, ShelfAnswer, ShelfItem } from '../../contracts';
import { formatDayMonth } from '../../engine';
import { DEFAULT_ANCHOR_PRODUCT } from '../../engine/config';
import { track } from '../../state';
import { firstTime, useRightStart } from '../../state/rightStart';
import { AppShell, BottomBar, CornerRibbon, DrMehr, Mascot, PrimaryButton, ResultCard, TextLink, type MascotId } from '../../ui';
import { ProductArt } from './components/ProductArt';
import { mascotForItem } from './components/mascotFor';
import { answers as answerCopy, plan as t } from './copy';
import styles from './PlanReady.module.css';

/** The noun on a roster plate. */
const PLATE: Partial<Record<MascotId, string>> = {
  'spray-can': 'Spray',
  deodorant: 'Deodorant',
  toner: 'Toner',
  'toner-worried': 'Toner',
  'hair-removal': 'Cream',
  lotion: 'Lotion',
  serum: 'Serum',
  retinol: 'Retinol',
  sunscreen: 'Sunscreen',
  'chemist-tube': 'Cream',
  'cream-jar': 'Cream',
};

type Tone = 'blue' | 'teal' | 'pink' | 'amber';

/** The role chip under a shelf product: how it sits with the roll-on (copy s06.role.*). */
function role(item: ShelfItem, answer: ShelfAnswer | undefined): { label: string; tone: Tone } {
  switch (answer?.answer) {
    case 'split-time':
      return { label: t.roleSplit, tone: 'teal' };
    case 'pick-one':
      return item.areas.some((a) => a !== 'underarm')
        ? { label: t.roleFaceOnly, tone: 'pink' }
        : { label: answerCopy.label['pick-one'], tone: 'pink' };
    case 'wait':
      return { label: t.roleGap, tone: 'amber' };
    case 'stop-ask':
      return { label: answerCopy.label['stop-ask'], tone: 'pink' };
    default:
      return { label: t.roleFine, tone: 'teal' };
  }
}

/** Screen 06: Plan ready. The plan opens from the box QR or a saved link, her cast lined up. */
export default function PlanReady() {
  const s = useRightStart();
  const [params] = useSearchParams();
  const src = params.get('src');
  const plan = s.plan;

  useEffect(() => {
    if (!plan) return;
    const source = src === 'box-qr' ? 'box-qr' : src === 'shared-link' ? 'link' : 'saved';
    if (!firstTime(`plan:${plan.planCode}:${source}`)) return;
    track('plan_opened', '06', { source });
  }, [plan, src]);

  if (!s.ready) return null;
  if (!plan) return <Fallback />;

  return <Ready plan={plan} fromBox={src === 'box-qr'} />;
}

/** No plan on this phone (a box QR opened on a new device): the 2-minute check is the way in. */
function Fallback() {
  return (
    <AppShell screen="06" header={{ title: t.runningHead }}>
      <div className={styles.intro}>
        <div className={styles.introText}>
          <h1 className={styles.title}>{t.fallbackTitle}</h1>
        </div>
        <DrMehr pose="clipboard" size={104} alt="Dr. Mehr with a clipboard" />
      </div>
      <BottomBar>
        <PrimaryButton to="/check/1">{t.fallback}</PrimaryButton>
      </BottomBar>
    </AppShell>
  );
}

function Ready({ plan, fromBox }: { plan: Plan; fromBox: boolean }) {
  const product: BodywiseProductId = plan.trialProduct ?? plan.pick.pick ?? DEFAULT_ANCHOR_PRODUCT;
  const answerFor = new Map(plan.shelfAnswers.map((a) => [a.itemId, a]));
  const items = plan.shelf.filter((i) => i.catalogId !== product);

  return (
    <AppShell screen="06" header={{ title: t.runningHead, planCode: plan.planCode }}>
      <div className={styles.intro}>
        <div className={styles.introText}>
          <h1 className={styles.title}>{`Your plan from ${formatDayMonth(plan.checkedOn)} is ready.`}</h1>
          <p className={styles.lead}>{fromBox ? t.leadBox : t.leadSaved}</p>
        </div>
        <DrMehr pose="clipboard" size={104} alt="Dr. Mehr with a clipboard" />
      </div>

      <ul className={styles.roster} data-testid="roster">
        <li>
          <ResultCard ribbon={<CornerRibbon>1</CornerRibbon>} className={styles.cast} padding="none" data-testid="cast-card">
            <ProductArt id={product} size={74} />
            <span className={`${styles.plate} ${styles.blue}`}>{product.startsWith('bw-kit') ? 'Kit' : 'Roll-on'}</span>
            <span className={`${styles.chip} ${styles.mint}`}>{t.roleRollon}</span>
          </ResultCard>
        </li>
        {items.map((item, i) => {
          const r = role(item, answerFor.get(item.id));
          const mascot = mascotForItem(item);
          return (
            <li key={item.id}>
              <ResultCard ribbon={<CornerRibbon color={ribbonColor(r.tone)}>{i + 2}</CornerRibbon>} className={styles.cast} padding="none" data-testid="cast-card">
                <Mascot id={mascot} size={72} alt="" />
                <span className={`${styles.plate} ${styles[r.tone]}`}>{PLATE[mascot] ?? 'Product'}</span>
                <span className={`${styles.chip} ${styles[`chip-${r.tone}`]}`}>{r.label}</span>
              </ResultCard>
            </li>
          );
        })}
      </ul>

      <ResultCard className={styles.next} padding="none">
        <p className={styles.nextTitle}>{t.nextTitle}</p>
        <div className={styles.nextChips}>
          {t.next.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </ResultCard>

      <BottomBar>
        <PrimaryButton to="/start/routine">{t.primary}</PrimaryButton>
        {fromBox ? <TextLink to="/check/1">{t.fallback}</TextLink> : null}
      </BottomBar>
    </AppShell>
  );
}

function ribbonColor(tone: Tone): string {
  return tone === 'pink' ? 'var(--pink)' : tone === 'amber' ? 'var(--orange-text)' : tone === 'blue' ? 'var(--primary)' : 'var(--teal-deep)';
}
