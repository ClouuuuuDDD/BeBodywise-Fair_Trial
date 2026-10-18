import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { BodyArea, ShelfItem, UseTime } from '../../contracts';
import { classesOf, classifyIngredients, makeShelfItem } from '../../engine';
import { track } from '../../state';
import { addShelfItem, newItemId, useRightStart } from '../../state/rightStart';
import { AppShell, BottomBar, CheckChip, Icon, Mascot, PrimaryButton, ResultCard, Sheet, TextLink } from '../../ui';
import { activeLines, chipClass, toneOf } from './components/activeInfo';
import { mascotForItem } from './components/mascotFor';
import { add, confirm } from './copy';
import styles from './LabelRead.module.css';

interface Row {
  key: number;
  text: string;
}

/** Screen 04b: Check what we read. She confirms the read, then says where and when, before any rule runs. */
export default function LabelRead() {
  const s = useRightStart();
  const [params] = useSearchParams();
  const draft = s.draft;

  if (!s.ready) return null;
  if (!draft) return <Navigate to="/check/shelf/add" replace />;
  // The draft is fixed for this screen's life; the form below owns everything she edits.
  return <ConfirmForm key={draft.product + draft.inci.length} draft={draft} returnTo={params.get('return')} />;
}

type Draft = NonNullable<ReturnType<typeof useRightStart>['draft']>;

function ConfirmForm({ draft, returnTo }: { draft: Draft; returnTo: string | null }) {
  const navigate = useNavigate();
  const [name, setName] = useState(draft.product);
  const [rows, setRows] = useState<Row[]>(() => draft.inci.map((text, key) => ({ key, text })));
  const [nextKey, setNextKey] = useState(draft.inci.length);
  const [newText, setNewText] = useState('');
  const [editing, setEditing] = useState(false);
  const [areas, setAreas] = useState<BodyArea[]>([]);
  const [time, setTime] = useState<UseTime | undefined>();
  const [stung, setStung] = useState(false);
  const [askSweat, setAskSweat] = useState(false);

  const list = rows.map((r) => r.text).filter((t) => t.trim() !== '');
  const classified = classifyIngredients(list.join(', '));
  const classes = classesOf(classified);
  const edited = name.trim() !== draft.product.trim() || list.join('|') !== draft.inci.join('|');
  const displayName = name.trim() || 'New product';

  const preview: ShelfItem = makeShelfItem({ id: 'draft', product: displayName, source: draft.source, inci: list, areas: [], times: 'night', catalogId: draft.catalogId });

  const meta = draft.fromPhotos ? `Read from your 2 photos · ${classified.length} ingredients` : `${classified.length} ingredients`;
  const ready = areas.length > 0 && time !== undefined;

  async function commit(antiperspirantFor?: 'sweat' | 'smell' | 'both') {
    if (!ready || !time) return;
    const item = makeShelfItem({
      id: newItemId(),
      product: displayName,
      source: draft.source,
      inci: list,
      areas,
      times: time,
      stung,
      catalogId: draft.catalogId,
      antiperspirantFor,
    });
    track('label_read_confirmed', '04b', { edited, classes: item.classes });
    track('shelf_item_added', '04b', {
      source: item.source,
      classes: item.classes,
      areas: item.areas,
      time: item.times,
      stung: item.stung,
      bodywise_id: item.catalogId ?? null,
    });
    if (antiperspirantFor) track('conditional_answered', '04b', { question: 'sweat-or-smell', answer: antiperspirantFor });
    await addShelfItem(item);
    void navigate(returnTo === 'keep' ? '/keep' : '/check/shelf', { state: { added: item.id } });
  }

  function primary() {
    if (!ready) return;
    if (classes.includes('antiperspirant') && areas.includes('underarm')) {
      setAskSweat(true);
      return;
    }
    void commit();
  }

  function addIngredient() {
    const text = newText.trim();
    if (!text) return;
    setRows((r) => [...r, { key: nextKey, text }]);
    setNextKey((k) => k + 1);
    setNewText('');
  }

  const lines = activeLines(classified);

  return (
    <AppShell screen="04b" header={{ back: '/check/shelf/add', title: confirm.runningHead }}>
      <ResultCard className={styles.card} padding="none">
        <div className={styles.head}>
          <Mascot id={mascotForItem(preview)} size={54} alt="" />
          <div className={styles.headText}>
            {editing ? (
              <input
                className={styles.nameInput}
                value={name}
                placeholder="Product name"
                aria-label={add.typeNameField}
                onChange={(e) => setName(e.target.value)}
                data-testid="product-name"
              />
            ) : (
              <h1 data-fit="keep" className={styles.name}>{displayName}</h1>
            )}
            <p className={styles.meta}>{meta}</p>
          </div>
        </div>

        <ul className={styles.chips} aria-label="Ingredients">
          {editing
            ? rows.map((r, i) => (
                <li key={r.key} className={styles.editChip}>
                  <input
                    value={r.text}
                    aria-label={`Ingredient ${i + 1}`}
                    onChange={(e) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, text: e.target.value } : x)))}
                    size={Math.max(6, r.text.length)}
                  />
                  <button type="button" aria-label={`Remove ${r.text}`} onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}>
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))
            : classified.map((ing) => {
                const cls = chipClass(ing);
                const tone = cls ? toneOf(cls) : undefined;
                const strong = cls !== null && cls !== 'soothing' && cls !== 'fragrance';
                return (
                  <li
                    key={`${ing.position}-${ing.inci}`}
                    className={[styles.chip, strong ? styles.active : ''].filter(Boolean).join(' ')}
                    style={tone ? { background: tone.bg, color: tone.fg, outlineColor: tone.dot } : undefined}
                    data-active={strong || undefined}
                  >
                    {ing.inci}
                  </li>
                );
              })}
        </ul>

        {editing ? (
          <div className={styles.addRow}>
            <input
              value={newText}
              placeholder="Add an ingredient"
              aria-label="Add an ingredient"
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addIngredient();
                }
              }}
            />
            <button type="button" onClick={addIngredient} aria-label="Add">
              <Icon name="plus" size={18} />
            </button>
          </div>
        ) : null}

        {lines.length > 0 ? (
          <ul className={styles.keys} aria-label="What the actives are">
            {lines.map((l) => (
              <li key={l.text} className={styles.key} data-testid="active-line">
                <i style={{ background: toneOf(l.cls).dot }} />
                {l.text}
              </li>
            ))}
          </ul>
        ) : null}
      </ResultCard>

      <section className={styles.block}>
        <h2 className={styles.q}>{confirm.where}</h2>
        <div className={styles.chipRow}>
          {confirm.whereOptions.map((o) => (
            <CheckChip
              key={o.value}
              value={o.value}
              label={o.label}
              checked={areas.includes(o.value as BodyArea)}
              onChange={(on) => setAreas((a) => (on ? [...a, o.value as BodyArea] : a.filter((x) => x !== o.value)))}
            />
          ))}
        </div>
      </section>
      <section className={styles.block}>
        <h2 className={styles.q}>{confirm.when}</h2>
        <div className={styles.chipRow}>
          {confirm.whenOptions.map((o) => (
            <CheckChip key={o.value} value={o.value} label={o.label} checked={time === o.value} onChange={() => setTime(o.value as UseTime)} />
          ))}
        </div>
      </section>
      <div className={styles.chipRow}>
        <CheckChip value="stung" label={confirm.stung} checked={stung} onChange={setStung} />
      </div>

      <BottomBar>
        {!ready ? (
          <p className={styles.needHint} role="status" data-testid="confirm-hint">
            {areas.length === 0 && time === undefined ? confirm.needBoth : areas.length === 0 ? confirm.needWhere : confirm.needWhen}
          </p>
        ) : null}
        <PrimaryButton onClick={primary} disabled={!ready} size="md">
          {confirm.primary}
        </PrimaryButton>
        {editing ? (
          <TextLink to="/check/shelf/add" data-testid="retake">
            Retake the photos
          </TextLink>
        ) : (
          <TextLink onClick={() => setEditing(true)} data-testid="secondary">
            {confirm.secondary}
          </TextLink>
        )}
      </BottomBar>

      <Sheet open={askSweat} onClose={() => setAskSweat(false)} title={confirm.sweatOrSmell(displayName)}>
        <div className={styles.sweat}>
          {(
            [
              ['sweat', confirm.sweat],
              ['smell', confirm.smell],
              ['both', confirm.both],
            ] as const
          ).map(([value, label]) => (
            <PrimaryButton
              key={value}
              variant="secondary"
              size="sm"
              data-testid={`sweat-${value}`}
              onClick={() => {
                setAskSweat(false);
                void commit(value);
              }}
            >
              {label}
            </PrimaryButton>
          ))}
        </div>
      </Sheet>
    </AppShell>
  );
}
