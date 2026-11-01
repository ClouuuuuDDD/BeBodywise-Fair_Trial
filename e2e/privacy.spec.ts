/**
 * Privacy check (E7): nothing personal or third-party ships in the app, and the example trial talks to nobody.
 *  - built dist/ and app/src hold no Indian mobile number (10 digits starting 6-9, optional +91 / 0 / spaces / dashes);
 *  - no real competitor brand name (from research/coded/aggregates.json when present, plus a fixed list);
 *  - during the whole example trial the only requests are the app itself and Google Fonts (no AI call).
 */
import { expect, test } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TARGETS, openTarget } from './routes';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (['node_modules', 'data'].includes(name) && dir.endsWith('src')) continue; // app/src/data = synced catalog and rules
      walk(p, out);
    } else if (/\.(ts|tsx|css|js|html|json|svg|md|txt)$/.test(name)) out.push(p);
  }
  return out;
}

/** 10-digit Indian mobiles, with the usual separators; not part of a longer digit run. */
const PHONE = /(?<![\d.])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d.])/g;

function competitorBrands(): string[] {
  const fixed = ['traya', 'plix', 'nua', 'veera', 'gynoveda', 'minimalist', 'derma co', 'mamaearth', 'dot & key', 'nivea', 'veet', 'vaseline', 'fiama', 'himalaya', 'sebamed'];
  const p = 'research/coded/aggregates.json';
  if (!existsSync(p)) return fixed;
  const agg = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
  const fromData = Object.keys((agg.competitor_tags ?? {}) as object).concat(Object.keys((agg.competitor_sentiment ?? {}) as object));
  return Array.from(new Set([...fixed, ...fromData.map((b) => b.toLowerCase())]));
}

test.describe('privacy', () => {
  test('no phone numbers in the built dist or the source', () => {
    const files = [...walk('app/src'), ...(existsSync('app/dist') ? walk('app/dist') : []), ...walk('functions')];
    expect(files.length, 'files scanned').toBeGreaterThan(50);
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf-8');
      for (const m of text.matchAll(PHONE)) {
        // Ignore hex colours, hashes and SVG path data: require the digits not to sit inside a longer token.
        const around = text.slice(Math.max(0, (m.index ?? 0) - 3), (m.index ?? 0) + m[0].length + 3);
        if (/[A-Za-z_]\d|\d[A-Za-z_]/.test(around.replace(m[0], 'X'))) continue;
        hits.push(`${f}: ${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  test('no real competitor brand names in the built dist or the source', () => {
    const brands = competitorBrands();
    expect(brands.length).toBeGreaterThan(5);
    const files = [...walk('app/src'), ...(existsSync('app/dist') ? walk('app/dist') : [])].filter((f) => !/\.test\.ts$/.test(f));
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf-8').toLowerCase();
      for (const b of brands) {
        const re = new RegExp(`(?<![a-z])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`);
        if (re.test(text)) hits.push(`${f}: ${b}`);
      }
    }
    expect(hits).toEqual([]);
  });

  test('the example trial makes no request except the app and Google Fonts (no AI call)', async ({ page }) => {
    const seen: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol === 'data:' || u.protocol === 'blob:') return;
      const local = ['localhost', '127.0.0.1'].includes(u.hostname);
      if (local && !u.pathname.startsWith('/api/') ) return; // static files of the app itself
      seen.push(`${r.method()} ${u.hostname}${u.pathname}`);
    });
    // Walk every example moment, including the endings, the skin file, the share screen and the insights page.
    const jumps = Array.from(new Set(TARGETS.filter((t) => t.jump).map((t) => t))).filter((t, i, a) => a.findIndex((x) => x.jump === t.jump && x.path === t.path) === i);
    for (const t of jumps) await openTarget(page, t);
    // Yes on the share screen builds the payload on the phone: still no request.
    await openTarget(page, TARGETS.find((t) => t.name === '19-share')!);
    const yes = page.getByTestId('primary');
    if (await yes.count()) await yes.click();
    await page.waitForTimeout(300);
    const allowed = (s: string) => /^(GET|POST) (fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(s);
    expect(seen.filter((s) => !allowed(s)), 'unexpected requests').toEqual([]);
  });

  test('every /api/read-label body has only the documented keys, and her answers are only shade, duration, hair removal (spec 7, D7)', async ({ page }) => {
    const bodies: Record<string, unknown>[] = [];
    await page.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname), (r) => r.abort());
    await page.route('**/api/read-label', async (route) => {
      const b = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      bodies.push(b);
      const review = { status: 'ok', provider: 'gemini', model: 'm', promptVersion: 'shelf-review-v1', reviewedOn: '2026-10-31', productType: 'other', culprits: [], mayWorsenDarkness: false, action: 'keep', actionWhy: 'Gentle.', confidence: 'high' };
      const reply =
        b.kind === 'front' ? { ok: true, kind: 'front', name: 'Test Lotion', brand: 'Test', provider: 'gemini' }
        : b.kind === 'ingredients' ? { ok: true, kind: 'ingredients', ingredientsText: 'Aqua, Glycerin, Cetyl Alcohol, Parfum', review, provider: 'gemini' }
        : { ok: true, kind: 'review-text', review, provider: 'gemini' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
    });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.goto('/check/1');
    for (const [v, next] of [['moderate', /\/check\/2$/], ['year-plus', /\/check\/3$/], ['razor', /\/check\/4$/], ['yes', /\/check\/5$/], ['no', /\/check\/shelf$/]] as const) {
      await page.getByTestId(`option-${v}`).click();
      await expect(page).toHaveURL(next);
    }
    await page.getByTestId('add-product').click();
    await page.getByTestId('photo-upload').setInputFiles({ name: 'l.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('heading', { name: 'Now the ingredient list' })).toBeVisible();
    await page.getByTestId('photo-upload').setInputFiles({ name: 'l.png', mimeType: 'image/png', buffer: png });
    await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
    await page.getByTestId('chip-night').click();
    await page.getByTestId('chip-stung').click(); // forces a review-text call
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/shelf$/);

    // Second product (typed), so the review-text call carries the first product in shelfSoFar.
    await page.getByTestId('add-product').click();
    await page.getByTestId('type-name').click();
    await page.getByTestId('typed-name').fill('Second Cream');
    await page.getByTestId('typed-ingredients').fill('Aqua, Glycerin, Cetyl Alcohol, Dimethicone');
    await page.getByTestId('type-continue').click();
    await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
    await page.getByTestId('chip-morning').click();
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/shelf$/);

    // front + ingredients + review-text (stung) for product 1, review-text for the typed product.
    await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(4);
    expect(bodies.map((b) => b.kind).sort()).toEqual(['front', 'ingredients', 'review-text', 'review-text']);

    type Ctx = { her?: Record<string, unknown>; target?: Record<string, unknown>; shelfSoFar?: Record<string, unknown>[]; thisProduct?: Record<string, unknown> };
    const allowed: Record<string, string[]> = {
      front: ['kind', 'image', 'mime'],
      ingredients: ['kind', 'image', 'mime', 'context'],
      'review-text': ['kind', 'ingredientsText', 'productName', 'context'],
    };
    let sawShelf = false;
    for (const b of bodies) {
      const kind = b.kind as string;
      expect(Object.keys(b).every((k) => allowed[kind]!.includes(k)), JSON.stringify(Object.keys(b))).toBe(true);
      if (kind === 'front') {
        expect(b.context, 'front carries no context').toBeUndefined();
      } else {
        const ctx = b.context as Ctx | undefined;
        expect(ctx, `${kind} must carry context`).toBeDefined();
        expect(Object.keys(ctx!).sort()).toEqual(['her', 'shelfSoFar', 'target', 'thisProduct']);
        expect(ctx!.her).toEqual({ shade: 'moderate', duration: 'year-plus', hairRemoval: 'razor' });
        expect(Object.keys(ctx!.target ?? {}).sort()).toEqual(['ingredients', 'name']);
        for (const k of Object.keys(ctx!.thisProduct ?? {})) expect(['frontName', 'stung', 'when']).toContain(k);
        for (const item of ctx!.shelfSoFar ?? []) {
          sawShelf = true;
          expect(Object.keys(item).sort()).toEqual(['ingredients', 'name', 'stung', 'when']);
        }
      }
      const { image: _image, ...rest } = b;
      void _image;
      expect(JSON.stringify(rest)).not.toMatch(/darkNeck|regularPeriods|pregnan|planCode|trialId|"id"|[a-z]Id"/);
    }
    expect(sawShelf, 'some body has a non-empty shelfSoFar').toBe(true);
  });
});
