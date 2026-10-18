// QA judge walk (docs/qa-plan.md): one unbroken journey through the built app in the guided demo, with the real
// label reader, then a sweep of every route with and without a plan.
// Usage: npm run build -w app; npm run dev:api (serves app/dist + the function on 8788); node scripts/judge-walk.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';

const OUT = process.argv[2];
const BASE = process.env.BASE ?? 'http://127.0.0.1:8788';
fs.mkdirSync(OUT, { recursive: true });

/* synthetic skin photo: grey wall, skin in the guide oval, white card bottom right (as e2e/trial.spec.ts) */
function rnd(seed) { const x = Math.sin(seed * 12.9898) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
function photo(skin) {
  const w = 240, h = 320, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w - 0.5, dy = (y + 0.5) / h - 0.5;
      const inOval = (dx * dx) / 0.09 + (dy * dy) / 0.1296 <= 1;
      const inCard = x > w * 0.72 && y > h * 0.8 && x < w * 0.97 && y < h * 0.97;
      let base = [90, 100, 95]; if (inOval) base = skin; if (inCard) base = [235, 235, 235];
      const n = inOval ? rnd(x * 7 + y * 131) * 6 : 0;
      for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.max(0, Math.min(255, Math.round(base[c] + n)));
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const UNDERARM_DARK = photo([150, 105, 85]);
const INNER_ARM = photo([195, 148, 120]);
const UNDERARM_LIGHTER = photo([188, 140, 115]);
const LABEL = fs.readFileSync('e2e/fixtures/label-test.jpg');

const browser = await chromium.launch();
// VIEW=WxH sets the visible browser area (default 390x844).
const [VW, VH] = (process.env.VIEW ?? '390x844').split('x').map(Number);
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const log = [];
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => { if (!/fonts\.g|analytics/.test(r.url())) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

let n = 0;
async function shot(name) {
  n++;
  const file = `${String(n).padStart(2, '0')}-${name}.png`;
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  return file;
}
async function step(name, fn) {
  const t0 = Date.now();
  const before = errors.length;
  let ok = true;
  let note;
  try { note = (await fn()) ?? ''; } catch (e) { ok = false; note = e.message.split('\n')[0]; }
  const file = await shot(name).catch(() => '');
  const height = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);
  // A sheet that scrolls inside itself also counts as not fitting.
  const sheetOverflow = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return 0;
    let worst = 0;
    for (const el of d.querySelectorAll('*')) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') worst = Math.max(worst, el.scrollHeight - el.clientHeight);
    }
    return worst;
  }).catch(() => 0);
  log.push({ sheetOverflow, n, name, ok, ms: Date.now() - t0, url: page.url().replace(BASE, ''), note, errors: errors.slice(before), file, height, overflow: height - VH });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${Date.now() - t0} ms) ${page.url().replace(BASE, '')} ${note}`);
  return ok;
}
const tid = (id) => page.getByTestId(id);
const closeCard = async () => { const b = page.getByRole('button', { name: /Start this chapter|Show me/ }); if (await b.isVisible().catch(() => false)) await b.click(); await page.waitForTimeout(350); };
const cardShown = async (id) => (await tid(`tour-card-${id}`).isVisible().catch(() => false)) ? `card ${id} shown` : `NO card ${id}`;
const dayBtn = (label) => tid('tour-days').getByRole('button', { name: label, exact: true });
async function upload(buf, name = 'p.png', mime = 'image/png') {
  const up = tid('photo-upload');
  // No camera in a headless browser: "Take photo" falls back to the file picker after the camera fails.
  if (!(await up.count())) await tid('primary').click();
  await up.waitFor({ state: 'attached', timeout: 20000 });
  await up.setInputFiles({ name, mimeType: mime, buffer: buf });
}

/* ---------------- the walk ---------------- */
await step('welcome', async () => { await page.goto(BASE + '/'); await tid('primary').waitFor(); return `demo already on: ${await tid('tour-bar').isVisible()}`; });
await step('ch1-card', async () => {
  // The shipped build opens in the demo; a VITE_GUIDED_DEMO=0 build needs the welcome link.
  if (await tid('start-demo').isVisible().catch(() => false)) await tid('start-demo').click();
  else await tid('primary').click(); await page.waitForURL(/check\/1/); return cardShown('before'); });
await closeCard();
await step('fit-1-shade', async () => { await tid('option-moderate').click(); await page.waitForURL(/check\/2$/); });
await step('fit-2', async () => { await tid('option-year-plus').click(); await page.waitForURL(/check\/3$/); });
await step('fit-3-hair', async () => { await tid('option-razor').click(); await page.waitForURL(/check\/4$/); });
await step('fit-4-neck', async () => { await tid('option-no').click(); await page.waitForURL(/check\/5$/); });
await step('fit-5-periods', async () => { await tid('option-yes').click(); await page.waitForURL(/check\/shelf$/); });
await step('shelf-empty', async () => { await tid('add-product').waitFor(); });
await step('label-front', async () => {
  await tid('add-product').click();
  await tid('photo-upload').setInputFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: LABEL });
  await page.getByRole('heading', { name: 'Now the ingredient list' }).waitFor({ timeout: 30000 });
});
await step('label-ingredients-real-read', async () => {
  await tid('photo-upload').setInputFiles({ name: 'ingr.jpg', mimeType: 'image/jpeg', buffer: LABEL });
  await page.waitForURL(/shelf\/confirm/, { timeout: 45000 });
});
await step('confirm-button-before-chips', async () => {
  const p = tid('primary');
  const dis = (await p.getAttribute('aria-disabled')) ?? (await p.isDisabled() ? 'disabled' : 'enabled');
  return `primary state with no chips: ${dis}; hint: ${await tid('confirm-hint').innerText().catch(() => 'none')}`;
});
await step('confirm-add', async () => {
  await tid('chip-underarm').click(); await tid('chip-night').click(); await tid('primary').click();
  if (await page.getByTestId(/^sweat-/).first().isVisible().catch(() => false)) await page.getByTestId(/^sweat-/).first().click();
  await page.waitForURL(/check\/shelf$/);
});
await step('typed-deo', async () => {
  await tid('add-product').click(); await tid('type-name').click();
  await tid('typed-name').fill('Fresh Bloom Deo Spray');
  await tid('typed-ingredients').fill('Butane, Alcohol Denat., Aluminum Chlorohydrate, Parfum, Isopropyl Myristate');
  await tid('type-continue').click(); await page.waitForURL(/shelf\/confirm/);
  await tid('chip-underarm').click(); await tid('chip-morning').click(); await tid('chip-stung').click(); await tid('primary').click();
  const sweat = page.locator('[data-testid^="sweat-"]');
  if (await sweat.first().isVisible({ timeout: 1500 }).catch(() => false)) { await page.screenshot({ path: path.join(OUT, `${String(n + 1).padStart(2, '0')}-sweat-question.png`) }); await sweat.first().click(); }
  await page.waitForURL(/check\/shelf$/);
  return `rows: ${await tid('shelf-row').count()}`;
});
await step('shelf-answer', async () => { await tid('primary').click(); await page.waitForURL(/shelf\/answer/); });
await step('match', async () => {
  await tid('primary').click(); await page.waitForURL(/check\/match/);
  if (await tid('pregnancy-no').isVisible().catch(() => false)) await tid('pregnancy-no').click();
  const buy = page.getByRole('link', { name: /Buy on Be Bodywise/ });
  return `best: ${await tid('best-name').innerText().catch(() => '?')}; buy href: ${await buy.getAttribute('href').catch(() => '?')}`;
});
await step('buy-demo-to-ch2', async () => { await page.getByText('Buy on Be Bodywise').click(); await page.waitForURL(/\/start$/); return cardShown('arrives'); });
await closeCard();
await step('plan-ready', async () => { await tid('primary').waitFor(); return await tid('primary').innerText(); });
await step('routine', async () => { await tid('primary').click(); await page.waitForURL(/start\/routine/); });
await step('photo-underarm', async () => { await tid('primary').click(); await page.waitForURL(/start\/photo/); });
await step('photo-uploaded-both', async () => {
  await upload(UNDERARM_DARK); await page.waitForURL(/site=inner-arm/, { timeout: 20000 });
  await upload(INNER_ARM); await page.waitForURL(/photo\/check/, { timeout: 20000 });
});
await step('your-date', async () => { await tid('primary').click(); await page.waitForURL(/start\/date/); return `judge-by: ${await tid('judge-date').innerText().catch(() => '?')}`; });
await step('trial-home-to-ch3', async () => { await tid('secondary').click(); await page.waitForURL(/\/trial$/); return cardShown('using'); });
await closeCard();
await step('day-0-home', async () => tid('tour-days').innerText());
await step('day-9', async () => { await dayBtn('Day 9').click(); return tid('tour-days').innerText(); });
await step('feels-off', async () => { await tid('feels-off').click(); await page.waitForURL(/\/help$/); });
await step('reaction-answer', async () => {
  await tid('chip-stinging').click(); await tid('option-mild').click();
  for (const f of ['follow-no']) if (await tid(f).isVisible().catch(() => false)) await tid(f).click();
  await tid('primary').click(); await page.waitForURL(/help\/answer/);
});
await step('back-home', async () => { await tid('primary').click(); await page.waitForURL(/\/trial$/); });
await step('day-28-halfway', async () => { await dayBtn('Day 28').click(); return tid('next-step').innerText().catch(() => '?'); });
await step('day-40-refill', async () => { await dayBtn('Day 40').click(); await tid('refill-card').waitFor(); });
await step('refill-ok', async () => { await tid('primary').click(); });
await step('day-56', async () => { await dayBtn('Day 56').click(); return tid('next-step').innerText().catch(() => '?'); });
await step('verdict-photo-to-ch4', async () => { await tid('primary').click(); await page.waitForURL(/verdict\/photo/); return cardShown('verdict'); });
await closeCard();
await step('verdict-photos-uploaded', async () => {
  await upload(UNDERARM_LIGHTER); await page.waitForURL(/site=inner-arm/, { timeout: 20000 });
  await upload(INNER_ARM); await page.waitForURL(/verdict\/pick|verdict$/, { timeout: 20000 });
});
await step('blind-pick', async () => {
  // A judge picks the photo that really is lighter: today's ("now").
  const aIs = await page.evaluate(() => sessionStorage.getItem('ft-blind-order'));
  await tid(aIs && aIs.includes('day0') ? 'pick-B' : 'pick-A').click();
  await page.waitForURL(/\/verdict$/, { timeout: 15000 });
  return `A was ${aIs}`;
});
await step('verdict', async () => `${await page.locator('h1').first().innerText().catch(() => '?')}; other-ending link: ${await tid('tour-other-ending').count()}`);
await step('share-to-ch5', async () => { const c = page.getByRole('button', { name: 'Continue', exact: true }); await ((await c.count()) ? c.first() : tid('primary')).click(); await page.waitForURL(/verdict\/share/); return cardShown('after'); });
await closeCard();
await step('share-screen', async () => {});
await step('share-yes', async () => { await page.getByText('Yes, share anonymously').click().catch(() => {}); await tid('primary').click(); await page.waitForURL(/\/keep|\/trial/); });
await step('after-landing', async () => page.url());
await step('insights-to-bodywise', async () => { await page.getByRole('link', { name: /what Bodywise learns/ }).click(); await page.waitForURL(/insights/); return cardShown('bodywise'); });
await closeCard();
await step('insights', async () => {});

/* dead-end sweep: every route with her finished plan, then with no plan */
const ROUTES = ['/', '/door', '/check/1', '/check/3', '/check/shelf', '/check/shelf/add', '/check/shelf/confirm', '/check/shelf/answer', '/check/match', '/start', '/start/routine', '/start/photo', '/start/photo/check', '/start/date', '/trial', '/help', '/help/answer', '/file', '/verdict/pick', '/verdict', '/verdict/share', '/keep', '/insights', '/example', '/nope'];
const sweep = [];
for (const phase of ['with-plan', 'no-plan']) {
  if (phase === 'no-plan') { await page.evaluate(async () => { for (const d of await indexedDB.databases()) indexedDB.deleteDatabase(d.name); sessionStorage.clear(); localStorage.clear(); }); }
  for (const r of ROUTES) {
    const before = errors.length;
    await page.goto(BASE + r);
    await page.waitForTimeout(700);
    const text = (await page.locator('body').innerText()).trim();
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const sheet = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? Math.round(d.getBoundingClientRect().height) : 0; });
    sweep.push({ phase, route: r, height, overflow: height - VH, sheet, landed: page.url().replace(BASE, ''), blank: text.length < 20, h1: (await page.locator('h1').first().innerText().catch(() => '')).slice(0, 60), errors: errors.slice(before) });
  }
}
fs.writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify({ log, sweep }, null, 1));
console.log('\nSWEEP');
for (const s of sweep) console.log(`${s.phase.padEnd(9)} ${s.route.padEnd(22)} -> ${s.landed.padEnd(22)} ${s.blank ? 'BLANK ' : ''}${s.h1} ${s.errors.length ? 'ERR ' + s.errors.join(' | ') : ''}`);
await browser.close();
