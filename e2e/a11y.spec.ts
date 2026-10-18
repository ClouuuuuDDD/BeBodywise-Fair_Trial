/**
 * Accessibility pass (E7), every route at 390 px wide:
 *  - axe-core (WCAG 2.0/2.1 A and AA): no serious or critical violations;
 *  - 44 x 44 px tap targets for every control that is not a link inside a sentence;
 *  - a visible focus indicator on every control reached with the keyboard;
 *  - prefers-reduced-motion: only the 150 ms cross-fade that global.css allows keeps running (no movement, no loops).
 * Runs once, in the 390 project (the viewport is set here anyway).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TARGETS, blockExternal, openTarget } from './routes';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390', 'one project is enough; the viewport is fixed below');
});
test.use({ viewport: { width: 390, height: 844 } });

/** Known, accepted findings with the reason. Empty means every serious and critical issue fails the test. */
const ACCEPTED: Record<string, string> = {};

async function settle(page: Page): Promise<void> {
  // Entrance animations (framer-motion, CSS) finish before axe measures contrast.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => undefined);
}

for (const t of TARGETS) {
  test.describe(`a11y ${t.name}`, () => {
    test('axe: no serious or critical violations', async ({ page }) => {
      await blockExternal(page);
      await openTarget(page, t);
      await settle(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const bad = results.violations.filter((v) => (v.impact === 'serious' || v.impact === 'critical') && !ACCEPTED[v.id]);
      const minor = results.violations.filter((v) => v.impact === 'moderate' || v.impact === 'minor');
      if (minor.length) test.info().annotations.push({ type: 'moderate/minor', description: minor.map((v) => `${v.id} x${v.nodes.length}`).join(', ') });
      expect(
        bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`),
        'serious/critical axe violations',
      ).toEqual([]);
    });

    test('44 px tap targets', async ({ page }) => {
      await blockExternal(page);
      await openTarget(page, t);
      await settle(page);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=checkbox], [role=switch], [tabindex]:not([tabindex="-1"])';
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0) continue;
          if (el.closest('[aria-hidden="true"]') || (el as HTMLInputElement).disabled) continue;
          // A visually hidden input whose label is the target (radio tiles, file inputs).
          if (el instanceof HTMLInputElement && (r.width < 4 || r.height < 4 || cs.opacity === '0' || cs.clip !== 'auto')) continue;
          // WCAG 2.5.8 exempts a link that sits inside a sentence.
          const inline = el.tagName === 'A' && cs.display === 'inline' && !!el.closest('p, li, span:not([class*=link])') && el.parentElement?.childNodes.length !== 1;
          if (inline) continue;
          // Scrollable regions are focusable on purpose and are not tap targets.
          if (el.scrollHeight > el.clientHeight + 1 && cs.overflowY !== 'visible' && el.tagName === 'DIV') continue;
          // A switch or checkbox is tapped through its label row: that row is the target.
          const box = el instanceof HTMLInputElement && el.closest('label') ? el.closest('label')!.getBoundingClientRect() : r;
          if (box.width < 43.5 || box.height < 43.5) {
            const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30);
            out.push(`${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }
        return out;
      });
      expect(small, 'controls under 44 px').toEqual([]);
    });

    test('visible keyboard focus', async ({ page }) => {
      await blockExternal(page);
      await openTarget(page, t);
      await settle(page);
      const failures: string[] = [];
      let last = '';
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 && cs.outlineColor !== 'rgba(0, 0, 0, 0)';
          const shadow = cs.boxShadow !== 'none';
          // A focused option inside a labelled tile shows the ring on its label/parent.
          const parent = el.closest('label, [role=radio], [role=checkbox]');
          const pcs = parent ? getComputedStyle(parent) : null;
          const parentRing = pcs ? (pcs.outlineStyle !== 'none' && parseFloat(pcs.outlineWidth) >= 2) || pcs.boxShadow !== 'none' : false;
          const sibling = el.nextElementSibling ? getComputedStyle(el.nextElementSibling as HTMLElement) : null;
          const siblingRing = sibling ? sibling.boxShadow !== 'none' || sibling.outlineStyle !== 'none' : false;
          const r = el.getBoundingClientRect();
          return {
            id: `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? '[' + el.getAttribute('data-testid') + ']' : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}"`,
            ring: outline || shadow || parentRing || siblingRing,
            inView: r.width > 0 && r.bottom > 0 && r.top < innerHeight,
          };
        });
        if (!info) break;
        if (info.id === last) break;
        last = info.id;
        if (!info.ring) failures.push(info.id);
        expect(info.inView, `${info.id} scrolled into view when focused`).toBe(true);
      }
      expect(failures, 'focused controls without a visible ring').toEqual([]);
    });
  });
}

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const t of TARGETS) {
    test(`no long animation or transition on ${t.name}`, async ({ page }) => {
      await blockExternal(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openTarget(page, t);
      await page.waitForTimeout(150); // a frame or two so any animation that would start has started
      const found = await page.evaluate(() => {
        const out: string[] = [];
        if (matchMedia('(prefers-reduced-motion: reduce)').matches === false) out.push('media query not applied');
        if (getComputedStyle(document.documentElement).scrollBehavior === 'smooth') out.push('smooth scroll');
        for (const a of document.getAnimations()) {
          const t = a.effect?.getTiming();
          const dur = typeof t?.duration === 'number' ? t.duration : 0;
          if ((dur > 160 || t?.iterations === Infinity) && a.playState === 'running') out.push(`${(a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? 'animation'} ${dur}ms`);
        }
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
          const cs = getComputedStyle(el);
          const ms = (v: string) => Math.max(...v.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000)));
          if (cs.animationName !== 'none' && ms(cs.animationDuration) > 160) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} animation ${cs.animationDuration}`);
        }
        return out;
      });
      expect(found, 'motion that ignores prefers-reduced-motion').toEqual([]);
    });
  }
});
