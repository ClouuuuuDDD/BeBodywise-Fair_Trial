import { useState } from 'react';
import { LABEL_FIXTURES, cachedRead, eventStatus, useLabelRead, type LabelKind, type LabelReadResult } from './index';

/** Dev-only test page at /dev/label (not linked). Not a product screen: E4 builds 04a/04b. */
export default function LabelDev() {
  const { state, read, reset } = useLabelRead();
  const [kind, setKind] = useState<LabelKind>('ingredients');
  const [cached, setCached] = useState<LabelReadResult | null>(null);
  const result = cached ?? (state.phase === 'done' ? state.result : null);

  return (
    <section style={{ paddingBlock: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--fs-title)' }}>Label reader (dev)</h1>
      <p>
        <label>
          Side{' '}
          <select value={kind} onChange={(e) => setKind(e.target.value as LabelKind)}>
            <option value="ingredients">Ingredients</option>
            <option value="front">Front</option>
          </select>
        </label>
      </p>
      <p>
        <label>
          Photo{' '}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setCached(null);
              if (f) void read(f, kind);
            }}
          />
        </label>
      </p>
      <p>
        Cached example reads:{' '}
        {LABEL_FIXTURES.map((f) => (
          <button
            key={f.id}
            type="button"
            style={{ minHeight: 44, marginRight: 8 }}
            onClick={() => {
              reset();
              setCached(cachedRead(f.id));
            }}
          >
            {f.name}
          </button>
        ))}
      </p>
      {state.phase === 'reading' && <p>Reading the label…</p>}
      {result && (
        <>
          <p>
            status {result.status} · source {result.source ?? 'none'} · event {eventStatus(result)} · {result.latencyMs} ms · http{' '}
            {result.httpStatus ?? '-'}
          </p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(
              {
                name: result.name,
                brand: result.brand,
                ingredientsText: result.ingredientsText,
                retake: result.parse?.retakeReason ?? null,
                chips: result.parse?.ingredients.map((i) => `${i.inci}${i.classes.length ? ` [${i.classes.join(',')}]` : ''}`),
              },
              null,
              2,
            )}
          </pre>
        </>
      )}
    </section>
  );
}
