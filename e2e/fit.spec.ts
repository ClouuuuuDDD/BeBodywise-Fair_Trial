/**
 * Fit (docs/fit-plan.md): on the shortest target phone (OnePlus Nord 4 in Chrome, about 412 x 760 visible) every
 * screen fits without page scroll. Riya's example covers the heaviest states; ?demo=1 adds the demo bar as shipped.
 */
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 412, height: 760 } });

async function overflow(page: Page): Promise<number> {
  // Measure once images and fonts are in: text reflows when the display font arrives.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
}

async function closeCard(page: Page): Promise<void> {
  const b = page.getByRole('button', { name: /Start this chapter|Show me/ });
  if (await b.isVisible().catch(() => false)) await b.click();
}

const EXAMPLE_STOPS = ['check', 'day-0', 'day-9', 'day-23', 'day-40', 'day-56-working', 'day-56-not-for-you', 'not-for-you-calm', 'not-yet', 'cant-call', 'see-doctor', 'keep-going'];

test.describe('Every screen fits a short phone', () => {
  test.beforeEach(({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-390', 'one project is enough: the viewport is fixed here');
  });

  for (const stop of EXAMPLE_STOPS) {
    test(`example: ${stop}`, async ({ page }) => {
      await page.goto(`/example?jump=${stop}`);
      await page.waitForURL((u) => !u.pathname.startsWith('/example'));
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test('example index and skin file', async ({ page }) => {
    await page.goto('/example');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.goto('/example?jump=day-56-working');
    await page.waitForURL(/\/verdict/);
    await page.goto('/file');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('welcome, fit questions and the shelf, with the demo bar', async ({ page }) => {
    await page.goto('/?demo=1');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    for (const path of ['/check/1', '/check/2', '/check/3', '/check/4', '/check/5', '/check/shelf', '/check/shelf/add']) {
      await page.goto(path);
      await closeCard(page);
      expect(await overflow(page), path).toBeLessThanOrEqual(0);
    }
  });

  test('insights: every phone tab fits', async ({ page }) => {
    await page.goto('/insights');
    for (const tab of ['numbers', 'shelf', 'stops', 'outcomes', 'act']) {
      await page.getByTestId(`insights-tab-${tab}`).click();
      expect(await overflow(page), tab).toBeLessThanOrEqual(0);
    }
  });
});
