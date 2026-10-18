import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExample } from '../../state/example';
import { DrMehr, Mascot, Sparkle, CONCEPT_LABEL, type MascotId } from '../../ui';
import { ExampleBar } from '../../ui/ExampleBar';
import styles from './insights.module.css';

interface Sample {
  kpis: { trialsStarted: number; reachedJudgeBy: number; working: number; shared: number };
  shelf: { id: string; label: string; mascot: MascotId; pct: number }[];
  stop: { label: string; pct: number }[];
  patterns: { id: string; trials: number; working: number; noChange: number; highlight?: boolean }[];
  signals: { value: string; tone: 'pink' | 'violet' | 'rose' }[];
}

const PATTERN_LABEL: Record<string, string> = {
  pattern1: 'Shaves, waits before applying',
  pattern2: 'Shaves, applies right after',
  pattern3: 'Waxes',
  pattern4: 'Dark neck + irregular cycles',
};

const SIGNAL_TEXT: { head: string; act: string }[] = [
  {
    head: 'More reactions when an acid toner is also used on underarms.',
    act: 'Act: say "toner on face only" at the fit check, not after the sting.',
  },
  {
    head: 'Few trials use a sunscreen, though sun can undo the result.',
    act: 'Act: test a sunscreen pairing card on the start plan.',
  },
  {
    head: 'No change at verdict, in the dark neck + irregular cycles pattern.',
    act: 'This can point to insulin resistance or PCOS. Act: route this group to a Be Bodywise doctor and the PCOS range early, as an offer, never a gate.',
  },
];

const n = (v: number) => v.toLocaleString('en-IN');

/** Screen 21: what Bodywise would see, on labelled sample data. Every number comes from insights-sample.json. */
/** Phone tabs: one section per screen on a phone; desktop shows the whole dashboard (docs/fit-plan.md). */
const TABS = [
  { id: 'numbers', label: 'Numbers' },
  { id: 'shelf', label: 'Shelf' },
  { id: 'stops', label: 'Stops' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'act', label: 'Act' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function Insights() {
  const [tab, setTab] = useState<TabId>('numbers');
  const example = useExample();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: Sample } | { kind: 'missing' }>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/insights-sample.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Sample>) : Promise.reject(new Error('missing'))))
      .then((data) => alive && setState({ kind: 'ready', data }))
      .catch(() => alive && setState({ kind: 'missing' }));
    return () => {
      alive = false;
    };
  }, []);

  const d = state.kind === 'ready' ? state.data : undefined;

  return (
    <div className={styles.page} data-screen="21" data-tab={tab}>
      {example ? <ExampleBar /> : null}
      <div className={styles.inner}>
        <header className={styles.head}>
          <DrMehr pose="clipboard" size={96} alt="" className={styles.mehr} />
          <div className={styles.headText}>
            <p className={styles.brand}>
              Fair Trial · {CONCEPT_LABEL}
            </p>
            <h1 className={styles.h1}>What the shelf is telling us</h1>
            <p className={styles.lead}>Underarm roll-on, from fit check to verdict. For the Be Bodywise product and care teams.</p>
          </div>
          <span className={styles.sample} data-testid="sample-tag">
            <Sparkle size={14} /> Sample data, illustrative only
          </span>
        </header>

        {state.kind === 'missing' ? (
          <section className={styles.card} data-testid="insights-missing">
            <p className={styles.unavailable}>Sample data unavailable.</p>
          </section>
        ) : null}

        {d ? (
          <>
            <nav className={styles.tabs} aria-label="Sections" data-scroll-x>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.tab}
                  aria-pressed={tab === t.id}
                  onClick={() => setTab(t.id)}
                  data-testid={`insights-tab-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <section className={styles.kpis} aria-label="Key numbers" data-section="numbers">
              <div className={styles.kpi}><span>Trials started</span><b>{n(d.kpis.trialsStarted)}</b></div>
              <div className={styles.kpi}><span>Reached judge-by date</span><b>{d.kpis.reachedJudgeBy}%</b></div>
              <div className={styles.kpi}><span>Verdict: working</span><b className={styles.good}>{d.kpis.working}%</b></div>
              <div className={styles.kpi}><span>Chose to share</span><b>{d.kpis.shared}%</b></div>
            </section>

            <section className={styles.card} data-section="shelf">
              <h2 className={styles.h2}>Who sits on the shelf next to it</h2>
              <p className={styles.sub}>Share of trials where she already owned each product.</p>
              <ol className={styles.cast}>
                {d.shelf.map((p, i) => (
                  <li key={p.id} className={styles.castCard}>
                    <span className={styles.rib}>{i + 1}</span>
                    <Mascot id={p.mascot} size={76} alt="" />
                    <b>{p.pct}%</b>
                    <span>{p.label}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className={styles.two}>
              <section className={styles.card} data-section="stops">
                <h2 className={styles.h2}>Why people stop</h2>
                <p className={styles.sub}>From the one-tap question when a trial ends early.</p>
                <ul className={styles.bars}>
                  {d.stop.map((r) => (
                    <li key={r.label}>
                      <span>{r.label}</span>
                      <span className={styles.track} aria-hidden="true">
                        <span className={styles.fill} style={{ width: `${(r.pct / Math.max(...d.stop.map((x) => x.pct))) * 100}%` }} />
                      </span>
                      <b>{r.pct}%</b>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={styles.card} data-section="outcomes">
                <h2 className={styles.h2}>Outcomes by pattern</h2>
                <p className={styles.sub}>Grouped by her fit-check answers.</p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Pattern</th><th>Trials</th><th>Working</th><th>No change at verdict</th></tr>
                    </thead>
                    <tbody>
                      {d.patterns.map((p) => (
                        <tr key={p.id} className={p.highlight ? styles.hl : undefined}>
                          <td>{PATTERN_LABEL[p.id] ?? p.id}</td>
                          <td>{n(p.trials)}</td>
                          <td className={styles.good}>{p.working}%</td>
                          <td className={p.highlight ? styles.rose : undefined}>{p.noChange}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className={styles.card} data-section="act">
              <h2 className={styles.h2}>Signals worth acting on</h2>
              <ul className={styles.signals} data-scroll-x>
                {d.signals.map((sig, i) => (
                  <li key={i}>
                    <b className={styles[sig.tone]}>{sig.value}</b>
                    <div>
                      <p className={styles.sigHead}>{SIGNAL_TEXT[i]?.head}</p>
                      <p className={styles.sigAct}>{SIGNAL_TEXT[i]?.act}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}

        <p className={styles.footer}>Only anonymous answers customers chose to share. No photos, names, numbers or locations.</p>
        <p className={styles.back}>
          <Link to="/example">Back to the example</Link>
        </p>
      </div>
    </div>
  );
}
