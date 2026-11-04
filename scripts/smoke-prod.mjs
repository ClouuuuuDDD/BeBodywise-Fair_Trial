/**
 * Live smoke test of the shelf check on a deployed site: real providers, real keys, no mocks.
 * Run before a demo:  npm run smoke  [-- https://preview-url.pages.dev] [-- runs]
 * Each run is one "review-text" call (the confirm-screen check), 10 s apart to stay under Groq's per-minute limit.
 * Prints the provider and time per run and exits 1 if any run fails. Spends free quota: up to 3 provider calls per run.
 */
const base = (process.argv[2] ?? 'https://bebodywise-fair-trial.pages.dev').replace(/\/$/, '');
const runs = Number(process.argv[3] ?? 3);

const body = {
  kind: 'review-text',
  productName: '6% AHA BHA Underarm Roll On',
  ingredientsText: 'Aqua, Glycolic Acid, Lactic Acid, Salicylic Acid, Propanediol, Glycerin, Niacinamide, Sodium Hydroxide, Hydroxyethylcellulose, Phenoxyethanol, Fragrance',
  context: {
    target: { name: '4% AHA BHA Underarm Roll On', ingredients: 'Aqua, Propylene Glycol, Lactic Acid, Mandelic Acid, Salicylic Acid, Alpha Arbutin, Perfume' },
    her: { shade: 'moderate', duration: 'year-plus', hairRemoval: 'razor' },
    shelfSoFar: [],
    thisProduct: { frontName: '6% AHA BHA Underarm Roll On', when: 'night', stung: false },
  },
};

let failed = 0;
console.log(`Smoke: ${runs} shelf check(s) against ${base}/api/read-label`);
for (let i = 1; i <= runs; i++) {
  const t0 = Date.now();
  let line;
  try {
    const res = await fetch(`${base}/api/read-label`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const j = await res.json().catch(() => ({}));
    const ok = res.ok && j.ok === true && j.review?.status === 'ok';
    if (!ok) failed++;
    line = `${ok ? 'OK  ' : 'FAIL'} ${res.status} ${((Date.now() - t0) / 1000).toFixed(1)}s ${j.provider ?? '-'}/${j.model ?? '-'} ${ok ? j.review.action : (j.error ?? 'no JSON')}`;
  } catch (e) {
    failed++;
    line = `FAIL ${((Date.now() - t0) / 1000).toFixed(1)}s ${e instanceof Error ? e.name : 'error'}`;
  }
  console.log(`run ${i}: ${line}`);
  if (i < runs) await new Promise((r) => setTimeout(r, 10_000));
}
console.log(failed === 0 ? 'All runs answered by an AI provider.' : `${failed} of ${runs} failed. The app falls back to the draft rules where a rule fires; check the provider keys and quotas.`);
process.exit(failed === 0 ? 0 : 1);
