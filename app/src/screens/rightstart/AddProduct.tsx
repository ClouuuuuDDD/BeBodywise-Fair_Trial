import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { BodywiseProductId, CatalogId } from '../../contracts';
import { catalog, catalogInci, classifyIngredients, productName, productPrice } from '../../engine';
import { eventStatus, readLabelPhoto, readTypedIngredients } from '../../label';
import type { LabelReadResult } from '../../label';
import { track } from '../../state';
import { setDraft, type ShelfDraft } from '../../state/rightStart';
import { AppShell, DrMehr, Icon, Mascot, PrimaryButton, Sheet, TextLink } from '../../ui';
import { CameraCard } from './components/CameraCard';
import { mascotForCatalog } from './components/mascotFor';
import { add } from './copy';
import styles from './AddProduct.module.css';

type Step = 'front' | 'ingredients';
type Phase = 'idle' | 'reading' | 'retake' | 'error';

const BUCKETS = (ms: number) => (ms < 2000 ? 'lt2s' : ms < 5000 ? '2to5s' : ms < 10000 ? '5to10s' : 'gt10s');

const UNDERARM_IDS = new Set(['bw-rollon-4', 'bw-rollon-6', 'bw-repair-cream', 'bw-kit-4', 'bw-kit-6']);

interface CatalogRow {
  id: string;
  name: string;
}

/** The five underarm products, then the niacinamide lotion and the glycolic stick (FR-M3-02). */
const CATALOG_ROWS: CatalogRow[] = [...catalog.products, ...catalog.related_not_for_underarm_darkness].map((p) => ({ id: p.id, name: p.name }));

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
}

/** A typed Bodywise name finds its catalog product (FR-M3-02), or undefined. */
function catalogMatch(typed: string): CatalogRow | undefined {
  const t = normalise(typed);
  if (t.length < 4) return undefined;
  return CATALOG_ROWS.find((r) => {
    const n = normalise(r.name);
    return n === t || n.includes(t) || t.includes(n);
  });
}

function catalogDraft(id: CatalogId): ShelfDraft {
  return {
    product: productName(id),
    source: 'catalog',
    inci: classifyIngredients(catalogInci(id)).map((i) => i.inci),
    catalogId: id,
    fromPhotos: false,
  };
}

/** Screen 04a: Add a product. Two label photos (front, ingredients), or type the name, or pick a Be Bodywise one. */
export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const search = params.get('return') ? `?return=${params.get('return')}` : '';

  const [step, setStep] = useState<Step>('front');
  const [phase, setPhase] = useState<Phase>('idle');
  const [justCaptured, setJustCaptured] = useState(false);
  const [sheet, setSheet] = useState<'type' | 'catalog' | undefined>();
  const [typedName, setTypedName] = useState('');
  const [typedList, setTypedList] = useState('');
  const [typedMessage, setTypedMessage] = useState<string | undefined>();
  const front = useRef<Promise<LabelReadResult | null> | undefined>(undefined);
  const run = useRef(0);
  const started = useRef(false);

  function announceStart(method: 'label' | 'typed' | 'catalog') {
    if (started.current && method === 'label') return;
    started.current = true;
    track('shelf_add_started', '04a', { method });
  }

  function toConfirm(draft: ShelfDraft) {
    setDraft(draft);
    void navigate(`/check/shelf/confirm${search}`);
  }

  function flashCaptured() {
    setJustCaptured(true);
    window.setTimeout(() => setJustCaptured(false), 1600);
  }

  function onPhoto(photo: Blob) {
    announceStart('label');
    if (step === 'front') {
      front.current = readLabelPhoto(photo, 'front').catch(() => null);
      flashCaptured();
      setStep('ingredients');
      setPhase('idle');
      return;
    }
    flashCaptured();
    void readIngredients(photo);
  }

  async function readIngredients(photo: Blob) {
    const id = ++run.current;
    setPhase('reading');
    const result = await readLabelPhoto(photo, 'ingredients');
    const frontRead = await (front.current ?? Promise.resolve(null));
    if (id !== run.current) return; // cancelled
    track('label_read_completed', '04a', {
      status: eventStatus(result),
      ingredient_count: result.parse?.count ?? 0,
      latency_bucket: BUCKETS(result.latencyMs),
      http_status: result.httpStatus ?? 0,
    });
    if (result.status === 'manual') {
      setPhase('error');
      return;
    }
    if (result.status === 'retake' || !result.parse) {
      setPhase('retake');
      return;
    }
    const name = frontRead?.name ?? frontRead?.brand ?? '';
    toConfirm({
      product: name,
      source: 'label',
      inci: result.parse.ingredients.map((i) => i.inci),
      fromPhotos: true,
    });
  }

  function cancelRead() {
    run.current++;
    setPhase('idle');
  }

  function openType() {
    announceStart('typed');
    setTypedMessage(undefined);
    setSheet('type');
  }

  function submitTyped() {
    const match = catalogMatch(typedName);
    if (typedList.trim() === '' && match) {
      setSheet(undefined);
      toConfirm(catalogDraft(match.id as CatalogId));
      return;
    }
    const result = readTypedIngredients(typedList);
    if (result.status !== 'ok' || !result.parse) {
      setTypedMessage(add.retake);
      return;
    }
    setSheet(undefined);
    toConfirm({
      product: typedName.trim(),
      source: 'typed',
      inci: result.parse.ingredients.map((i) => i.inci),
      fromPhotos: false,
    });
  }

  function pickCatalog(id: CatalogId) {
    track('shelf_add_started', '04a', { method: 'catalog' });
    setSheet(undefined);
    toConfirm(catalogDraft(id));
  }

  const frontStep = step === 'front';
  const reading = phase === 'reading';

  return (
    <AppShell screen="04a" header={{ back: '/check/shelf', title: add.runningHead }}>
      <h1 className={styles.title}>{frontStep ? add.titleFront : add.titleIngredients}</h1>
      <ol className={styles.steps} aria-label="Photos">
        <li className={[styles.step, frontStep ? styles.on : styles.done].join(' ')}>
          <b>{frontStep ? '1' : <Icon name="check" size={14} />}</b>
          {add.step1}
        </li>
        <li className={[styles.step, frontStep ? '' : styles.on].filter(Boolean).join(' ')}>
          <b>2</b>
          {add.step2}
        </li>
      </ol>

      <CameraCard label={frontStep ? add.titleFront : add.titleIngredients} onPhoto={onPhoto} busy={reading} captured={justCaptured}>
      <div className={styles.tipRow}>
        <DrMehr pose="camera" size={62} alt="Dr. Mehr with a camera" />
        <p className={styles.tip} role={reading ? 'status' : phase === 'retake' || phase === 'error' ? 'alert' : undefined}>
          {reading ? add.reading : phase === 'retake' ? add.retake : phase === 'error' ? add.error : frontStep ? add.tipFront : add.tipIngredients}
        </p>
      </div>
      </CameraCard>

      {reading ? (
        <div className={styles.status}>
          <TextLink onClick={cancelRead} data-testid="cancel-read">
            {add.cancel}
          </TextLink>
        </div>
      ) : null}
      {phase === 'error' ? (
        <div className={styles.errorRow}>
          <PrimaryButton size="sm" onClick={() => setPhase('idle')} data-testid="try-again">
            {add.errorTry}
          </PrimaryButton>
          <PrimaryButton size="sm" variant="secondary" onClick={openType} data-testid="type-name-error">
            {add.typeName}
          </PrimaryButton>
        </div>
      ) : null}

      <div className={styles.alts}>
        <button type="button" className={styles.alt} onClick={openType} data-testid="type-name">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
          </svg>
          {add.typeName}
        </button>
        <button
          type="button"
          className={styles.alt}
          onClick={() => setSheet('catalog')}
          data-testid="bodywise-one"
        >
          <Mascot id="rollon" size={26} alt="" />
          {add.bodywise}
        </button>
      </div>

      <p className={styles.privacy}>{add.geminiPrivacy}</p>

      <Sheet open={sheet === 'catalog'} onClose={() => setSheet(undefined)} title={add.bodywise}>
        <ul className={styles.catalog}>
          {CATALOG_ROWS.map((r) => {
            const id = r.id as CatalogId;
            return (
              <li key={r.id}>
                <button type="button" className={styles.catalogRow} onClick={() => pickCatalog(id)} data-testid={`catalog-${r.id}`}>
                  <Mascot id={mascotForCatalog(id)} size={44} alt="" />
                  <span className={styles.catalogName}>{r.name}</span>
                  <span className={styles.catalogPrice}>{UNDERARM_IDS.has(r.id) ? `Rs ${productPrice(id as BodywiseProductId)}` : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>

      <Sheet
        open={sheet === 'type'}
        onClose={() => setSheet(undefined)}
        title={add.typeName}
        footer={
          <PrimaryButton size="md" onClick={submitTyped} disabled={typedName.trim() === '' && typedList.trim() === ''} data-testid="type-continue">
            Continue
          </PrimaryButton>
        }
      >
        <div className={styles.form}>
          <label className={styles.field}>
            <span>{add.typeNameField}</span>
            <input
              type="text"
              value={typedName}
              autoComplete="off"
              onChange={(e) => {
                setTypedName(e.target.value);
                setTypedMessage(undefined);
              }}
              data-testid="typed-name"
            />
          </label>
          <label className={styles.field}>
            <span>{add.typeIngredients}</span>
            <textarea
              rows={5}
              value={typedList}
              onChange={(e) => {
                setTypedList(e.target.value);
                setTypedMessage(undefined);
              }}
              data-testid="typed-ingredients"
            />
          </label>
          {typedMessage ? (
            <p className={styles.formMessage} role="alert">
              {typedMessage}
            </p>
          ) : null}
        </div>
      </Sheet>
    </AppShell>
  );
}
