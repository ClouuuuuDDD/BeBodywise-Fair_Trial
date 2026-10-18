/**
 * Guided demo ("Play the whole journey"): chapter cards between phases and the day control that moves her
 * own trial forward. Her plan is seeded into IndexedDB as in trial.spec.ts; the clock is fixed.
 */
import { expect, test, type Page } from '@playwright/test';

const PLAN = {
  planCode: 'FT-9DMO',
  trialId: '22222222-2222-4222-8222-222222222222',
  mode: 'live',
  checkedOn: '2026-10-14',
  channel: 'direct',
  fit: { shade: 'moderate', duration: 'year-plus', hairRemoval: 'razor', darkNeck: 'no', regularPeriods: 'yes' },
  fitResult: { outcome: 'good-with-habit', habit: 'Wait after shaving.', hormoneNote: false },
  shelf: [],
  shelfAnswers: [],
  pick: { pick: 'bw-rollon-4', ruleRow: 8, baseRow: 8, headline: 'Start gentle.', why: [], whyNot: [], doctorFirst: false, hormoneNote: false, priceInr: 329 },
  trialProduct: 'bw-rollon-4',
  day0: '2026-10-17',
  dayLog: [],
  reactions: [],
  photoIds: [],
  photosSkipped: true,
  rulesVersion: 'test',
};

async function seedPlan(page: Page): Promise<void> {
  await page.goto('/trial');
  await page.waitForFunction(async () => (await indexedDB.databases()).some((d) => d.name === 'fair-trial'));
  await page.waitForTimeout(150);
  await page.evaluate(
    (plan) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('fair-trial');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('plan', 'readwrite');
          tx.objectStore('plan').put(plan, 'live');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    PLAN,
  );
}

test.describe('Guided demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-17T10:00:00+05:30'));
  });

  test('starts from the welcome screen with the chapter 1 card', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-demo').click();
    await expect(page.getByTestId('tour-card-before')).toBeVisible();
    await page.getByRole('button', { name: 'Start this chapter' }).click();
    await expect(page.getByTestId('tour-card-before')).toBeHidden();
    await expect(page.getByTestId('tour-bar')).toContainText('1/5 · Before she buys');
  });

  test('the day control moves her trial from Day 0 to the verdict', async ({ page }) => {
    await seedPlan(page);
    await page.goto('/trial?demo=1');
    await expect(page.getByTestId('tour-card-using')).toBeVisible();
    await page.getByRole('button', { name: 'Start this chapter' }).click();

    const days = page.getByTestId('tour-days');
    await expect(days).toContainText('Day 0 of 56');
    await days.getByRole('button', { name: 'Day 40' }).click();
    await expect(page.getByTestId('refill-card')).toBeVisible();
    await expect(days).toContainText('Day 40 of 56');

    await days.getByRole('button', { name: 'Day 56' }).click();
    await expect(page.getByText("It's your judge-by date. Let's see if it worked.")).toBeVisible();

    // The demo is per session and only shifts "today": ending it puts her back on the real date.
    await page.getByTestId('tour-bar').getByRole('button', { name: 'End' }).click();
    await expect(page.getByTestId('tour-bar')).toBeHidden();
    await expect(page.getByText('Too early to judge.', { exact: false })).toBeVisible();
  });
});
