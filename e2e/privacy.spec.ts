/**
 * Privacy check (E7): nothing personal or third-party ships in the app, and the example trial talks to nobody.
 *  - built dist/ and app/src hold no Indian mobile number (10 digits starting 6-9, optional +91 / 0 / spaces / dashes);
 *  - no real competitor brand name (from research/coded/aggregates.json when present, plus a fixed list);
 *  - during the whole example trial the only requests are the app itself, Google Fonts and /api/read-label.
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

  test('the example trial makes no request except the app, Google Fonts and /api/read-label', async ({ page }) => {
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
    const allowed = (s: string) => /^(GET|POST) (fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(s) || s === 'POST localhost/api/read-label' || s === 'POST 127.0.0.1/api/read-label';
    expect(seen.filter((s) => !allowed(s)), 'unexpected requests').toEqual([]);
  });
});
