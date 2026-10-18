import { useMemo, useState } from 'react';
import { analyseBlob } from './client';
import { fixLines } from './copy';
import { killTestReport, reportToCsv, shotsToCsv, type LabShot, type Lighting, type Site } from './killTestStats';
import { KILL_TEST_MAX_BAND_ITA_DEG, KILL_TEST_MIN_SESSIONS } from '../engine/config';

/** One staged photo with its labels and (after measuring) its result. */
interface Row {
  id: number;
  file: File;
  tone: string;
  light: Lighting;
  session: string;
  site: Site;
  ita: number | null;
  failures: string[];
  error: string | null;
}

const LIGHTS: { value: Lighting; label: string }[] = [
  { value: 'daylight', label: 'Daylight' },
  { value: 'indoor-warm', label: 'Indoor warm' },
  { value: 'indoor-cool', label: 'Indoor cool' },
];

/** Guess labels from a file name such as "t2_daylight_s3_underarm.jpg". Everything stays editable. */
function guess(name: string): Pick<Row, 'tone' | 'light' | 'session' | 'site'> {
  const n = name.toLowerCase();
  const light: Lighting = /warm/.test(n) ? 'indoor-warm' : /cool/.test(n) ? 'indoor-cool' : 'daylight';
  const site: Site = /inner/.test(n) ? 'inner-arm' : 'underarm';
  const session = /(?:^|[^a-z])s(\d+)/.exec(n)?.[1] ?? '1';
  const tone = /(?:^|[^a-z])(t\d+)/.exec(n)?.[1]?.toUpperCase() ?? 'T1';
  return { tone, light, session, site };
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const cell = { padding: '6px 8px', borderBottom: '1px solid var(--line)', textAlign: 'left', fontSize: 14 } as const;
const field = { minHeight: 44, font: 'inherit', padding: '0 8px', border: '1px solid var(--lilac-line)', borderRadius: 8, background: 'var(--surface)' } as const;
const btn = {
  minHeight: 44,
  padding: '0 20px',
  borderRadius: 999,
  border: 0,
  background: 'var(--primary)',
  color: '#fff',
  font: '700 var(--fs-body) var(--font-display)',
  cursor: 'pointer',
} as const;
const btn2 = { ...btn, background: 'var(--surface)', color: 'var(--primary)', border: '2px solid var(--primary)' } as const;

/**
 * Kill-test harness at /lab (not linked from the app). Load staged photos, label them, measure on
 * this device, read the spread per condition. Nothing is uploaded. Owner: E3.
 * Decides whether measurement or the blind pick leads the verdict (architecture, pipeline 2).
 */
export default function KillTest() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [threshold, setThreshold] = useState(KILL_TEST_MAX_BAND_ITA_DEG);
  const [bulkTone, setBulkTone] = useState('');
  const [bulkLight, setBulkLight] = useState<Lighting | ''>('');

  const patch = (id: number, p: Partial<Row>): void => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const onFiles = (files: FileList | null): void => {
    if (!files) return;
    const start = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
    const added = [...files]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((file, i): Row => ({ id: start + i, file, ...guess(file.name), ita: null, failures: [], error: null }));
    setRows((rs) => [...rs, ...added]);
  };

  const measureAll = async (): Promise<void> => {
    setBusy(true);
    for (const r of rows) {
      try {
        const res = await analyseBlob(r.file);
        patch(r.id, { ita: res.itaDeg, failures: res.quality.failures, error: null });
      } catch (e) {
        patch(r.id, { ita: null, error: String(e) });
      }
    }
    setBusy(false);
  };

  const shots: LabShot[] = useMemo(
    () =>
      rows.flatMap((r) =>
        r.ita === null ? [] : [{ file: r.file.name, tone: r.tone.trim() || 'T1', light: r.light, session: r.session.trim() || '1', site: r.site, itaDeg: r.ita, failures: r.failures }],
      ),
    [rows],
  );
  const report = useMemo(() => killTestReport(shots, threshold), [shots, threshold]);
  const allRows = [...report.rows, ...(report.overall ? [report.overall] : [])];

  return (
    <main style={{ paddingBlock: 'var(--space-6)' }} data-screen="lab">
      <p className="micro-label">Fair Trial · Photo lab · Kill test</p>
      <h1 style={{ fontSize: 'var(--fs-title)', marginBlock: 'var(--space-4)' }}>Does measurement hold up?</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Photos are read on this device only. Nothing is uploaded. How to stage them: engineering/notes/kill-test.md.
      </p>

      <section aria-label="Load photos" style={{ display: 'grid', gap: 12, marginBlock: 16 }}>
        <label style={{ ...btn, display: 'inline-flex', alignItems: 'center', justifySelf: 'start', position: 'relative' }}>
          Choose photos
          <input
            data-testid="lab-files"
            type="file"
            accept="image/*"
            multiple
            style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)' }}>
          Name files like <code>t2_daylight_s3_underarm.jpg</code> (tone, light, session, site) and labels fill in. Several photos with the same labels count as one burst.
        </p>
        {rows.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label>
              Set tone for all{' '}
              <input style={{ ...field, width: 80 }} value={bulkTone} onChange={(e) => setBulkTone(e.target.value)} />
            </label>
            <label>
              Set light for all{' '}
              <select style={field} value={bulkLight} onChange={(e) => setBulkLight(e.target.value as Lighting | '')}>
                <option value="">(leave)</option>
                {LIGHTS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              style={btn2}
              onClick={() =>
                setRows((rs) => rs.map((r) => ({ ...r, tone: bulkTone.trim() || r.tone, light: bulkLight || r.light })))
              }
            >
              Apply
            </button>
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section aria-label="Photos" style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                {['File', 'Tone', 'Light', 'Session', 'Site', 'ITA°', 'Gate'].map((h) => (
                  <th key={h} style={cell}>
                    {h}
                  </th>
                ))}
                <th style={cell} aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={cell}>{r.file.name}</td>
                  <td style={cell}>
                    <input aria-label={`Tone for ${r.file.name}`} style={{ ...field, width: 72 }} value={r.tone} onChange={(e) => patch(r.id, { tone: e.target.value })} />
                  </td>
                  <td style={cell}>
                    <select aria-label={`Light for ${r.file.name}`} style={field} value={r.light} onChange={(e) => patch(r.id, { light: e.target.value as Lighting })}>
                      {LIGHTS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={cell}>
                    <input aria-label={`Session for ${r.file.name}`} style={{ ...field, width: 56 }} value={r.session} onChange={(e) => patch(r.id, { session: e.target.value })} />
                  </td>
                  <td style={cell}>
                    <select aria-label={`Site for ${r.file.name}`} style={field} value={r.site} onChange={(e) => patch(r.id, { site: e.target.value as Site })}>
                      <option value="underarm">Underarm</option>
                      <option value="inner-arm">Inner arm</option>
                    </select>
                  </td>
                  <td style={cell}>{r.error ? 'error' : r.ita === null ? '-' : r.ita.toFixed(1)}</td>
                  <td style={cell}>
                    {r.ita === null ? '' : r.failures.length === 0 ? 'ok' : fixLines(r.failures as Parameters<typeof fixLines>[0]).join(' ')}
                  </td>
                  <td style={cell}>
                    <button type="button" style={{ ...btn2, minWidth: 44, padding: '0 12px' }} aria-label={`Remove ${r.file.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                      x
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginBlock: 16, flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={measureAll} disabled={busy} data-testid="lab-measure">
              {busy ? 'Measuring…' : 'Measure all'}
            </button>
            <button type="button" style={btn2} onClick={() => setRows([])}>
              Clear
            </button>
          </div>
        </section>
      )}

      <section aria-label="Result" data-testid="lab-result" style={{ marginBlock: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-card-title)' }}>Result</h2>
        <label style={{ display: 'block', marginBlock: 8 }}>
          Pass threshold, noise band in ITA° (placeholder, default {KILL_TEST_MAX_BAND_ITA_DEG}){' '}
          <input type="number" min={0} step={0.5} style={{ ...field, width: 80 }} value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 0)} />
        </label>
        <p
          role="status"
          style={{
            padding: 12,
            borderRadius: 12,
            fontWeight: 700,
            background: report.passed === null ? 'var(--surface-muted)' : report.passed ? 'var(--light-green-bg)' : 'var(--light-red-bg)',
            color: report.passed === null ? 'var(--ink)' : report.passed ? 'var(--light-green-fg)' : 'var(--light-red-fg)',
          }}
        >
          {report.passed === null ? 'Not enough data' : report.passed ? 'PASS' : 'FAIL'}: {report.note}
        </p>
        {allRows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  {['Condition', 'Sessions', 'Mean gap', 'SD of gap', 'Noise band', 'Band from bursts only', `Pass (${KILL_TEST_MIN_SESSIONS}+ sessions)`].map((h) => (
                    <th key={h} style={cell}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRows.map((r) => (
                  <tr key={r.scope + r.label} style={{ fontWeight: r.scope === 'overall' ? 700 : 400 }}>
                    <td style={cell}>{r.label}</td>
                    <td style={cell}>{r.n}</td>
                    <td style={cell}>{r.meanGap.toFixed(1)}°</td>
                    <td style={cell}>{r.sigmaGap.toFixed(2)}°</td>
                    <td style={cell}>±{r.band.toFixed(1)}°</td>
                    <td style={cell}>{r.burstBand === null ? '-' : `±${r.burstBand.toFixed(1)}°`}</td>
                    <td style={cell}>{r.pass === null ? 'too few' : r.pass ? 'pass' : 'FAIL'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBlock: 16, flexWrap: 'wrap' }}>
          <button type="button" style={btn2} disabled={shots.length === 0} onClick={() => download('kill-test.json', JSON.stringify({ shots, report }, null, 2), 'application/json')}>
            Export JSON
          </button>
          <button type="button" style={btn2} disabled={shots.length === 0} onClick={() => download('kill-test-photos.csv', shotsToCsv(shots), 'text/csv')}>
            Export photos CSV
          </button>
          <button type="button" style={btn2} disabled={allRows.length === 0} onClick={() => download('kill-test-spread.csv', reportToCsv(report), 'text/csv')}>
            Export spread CSV
          </button>
        </div>
      </section>
    </main>
  );
}
