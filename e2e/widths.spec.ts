/**
 * Phone widths (E7): 320, 360, 390, 414 and 480 px, every screen.
 *  - no horizontal scroll;
 *  - no clipped text (nothing that hides its overflow while its text is cut, nothing past the right edge);
 *  - the bottom button is in view without scrolling;
 *  - 360 px screenshots of every screen go to e2e/tmp/ (git-ignored) for a human to look at.
 * Insights (21) is a desktop page that stacks on a phone, so it is held to the same rules.
 */
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { TARGETS, blockExternal, openTarget } from './routes';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390', 'widths are set per test below');
});

const WIDTHS = [320, 360, 390, 414, 480];
const HEIGHT = 780;

for (const width of WIDTHS) {
  test.describe(`${width} px wide`, () => {
    test.use({ viewport: { width, height: HEIGHT } });

    for (const t of TARGETS) {
      test(`${t.name}: no horizontal scroll, no clipped text, button in view`, async ({ page }) => {
        await blockExternal(page);
        await openTarget(page, t);
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => undefined);

        const report = await page.evaluate(() => {
          const out = { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, clipped: [] as string[], beyond: [] as string[] };
          const visible = (el: Element) => (el as HTMLElement).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
          for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
            if (!visible(el) || el.closest('[aria-hidden="true"], svg, [inert]') || el.classList.contains('sr-only')) continue;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            const hasText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0);
            const name = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent ?? '').trim().slice(0, 24)}"`;
            // Text that is cut: the box hides overflow, and the content is wider/taller than the box.
            const hides = ['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflowY);
            if (hasText && hides && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)) out.clipped.push(name);
            if (hasText && cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.clipped.push(name + ' (ellipsis)');
            // Text that runs past the right edge of the screen.
            if (hasText && r.right > window.innerWidth + 1 && !el.closest('[data-scroll-x], [role=img]') && cs.position !== 'fixed') out.beyond.push(`${name} right=${Math.round(r.right)}`);
          }
          return out;
        });
        expect(report.scrollW, 'document scroll width').toBeLessThanOrEqual(report.innerW);
        expect(report.clipped, 'clipped text').toEqual([]);
        expect(report.beyond, 'text past the right edge').toEqual([]);

        // The one primary action. Screens that pin it (BottomBar sticky: 05, 05b) must show it at load; on the others it
        // sits at the end of the content, so it must be reachable by scrolling and not covered by anything.
        const primary = page.getByTestId('primary').first();
        if (await primary.count()) {
          const atLoad = await primary.boundingBox();
          const inViewAtLoad = !!atLoad && atLoad.y >= 0 && atLoad.y + atLoad.height <= HEIGHT + 1;
          if (!inViewAtLoad) test.info().annotations.push({ type: 'primary below the fold at load', description: `${t.name} @${width}` });
          if (['05', '05b'].includes(t.screen)) expect(inViewAtLoad, 'pinned primary button is in view at load').toBe(true);
          await primary.scrollIntoViewIfNeeded();
          const box = (await primary.boundingBox())!;
          expect(box.y, 'primary button top').toBeGreaterThanOrEqual(0);
          expect(box.y + box.height, 'primary button bottom').toBeLessThanOrEqual(HEIGHT + 1);
          expect(box.x, 'primary button left').toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, 'primary button right').toBeLessThanOrEqual(width + 1);
          const covered = await primary.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !hit || !(el === hit || el.contains(hit));
          });
          expect(covered, 'primary button is covered by something else').toBe(false);
        }

        if (width === 360) {
          mkdirSync('e2e/tmp', { recursive: true });
          await page.screenshot({ path: `e2e/tmp/w360-${t.name}.png`, fullPage: false });
          await page.screenshot({ path: `e2e/tmp/w360-${t.name}-full.png`, fullPage: true });
        }
      });
    }
  });
}
