/**
 * The example trial (Riya) and the screens reached through it (E5): screen 22 and its jump keys, every verdict,
 * Keep Going, the insights page, and the promise that the example never touches her own plan.
 * Acceptance criteria referenced in comments are in docs/prd/PRD.md section 10.
 */
import { expect, test, type Page } from '@playwright/test';

const JUMP_ROUTE: Record<string, RegExp> = {
  check: /\/check\/match$/,
  'day-0': /\/start\/routine$/,
  'day-9': /\/help$/,
  'day-23': /\/trial$/,
  halfway: /\/trial$/,
  'day-40': /\/trial$/,
  'day-56-working': /\/verdict\/pick$/,
  'day-56-not-for-you': /\/verdict$/,
  'not-yet': /\/verdict$/,
  'cant-call': /\/verdict$/,
  'see-doctor': /\/verdict$/,
  'keep-going': /\/keep$/,
  insights: /\/insights$/,
};

async function jump(page: Page, key: string): Promise<void> {
  await page.goto(`/example?jump=${key}`);
  await page.waitForURL(JUMP_ROUTE[key] ?? /./);
}

test.describe('Example trial', () => {
  test('AC-22-1: the moment cards, the Example tag', async ({ page }) => {
    await page.goto('/example');
    await expect(page.getByTestId('example-tag')).toHaveText('Example trial');
    await expect(page.getByRole('heading', { name: 'See the whole trial in a minute' })).toBeVisible();
    expect(await page.locator('[data-testid^="moment-"]').count()).toBeGreaterThanOrEqual(10);
    for (const text of ['Day 9', 'It stings', 'Day 56', 'Verdict: working', 'Day 56, the other ending', 'Verdict: not for you', 'More endings']) {
      await expect(page.getByTestId(/^moment-/).filter({ hasText: text }).first()).toBeVisible();
    }
    await expect(page.getByText('Concept for Be Bodywise')).toBeVisible();
  });

  test('AC-22-2: Day 23 opens the trial home with the Example tag, fast', async ({ page }) => {
    await page.goto('/example');
    await expect(page.getByTestId('moment-day-23')).toBeVisible();
    const start = Date.now();
    await page.getByTestId('moment-day-23').click();
    await expect(page.getByText('23 / 56 days')).toBeVisible();
    expect(Date.now() - start).toBeLessThan(1000);
    await expect(page).toHaveURL(/\/trial$/);
    await expect(page.getByTestId('example-tag')).toHaveText('Example');
    // AC-11-1, AC-11-2
    await expect(page.getByTestId('running-head')).toHaveText('Fair Trial · Day 23 of 56');
    await expect(page.getByText('Judge on 15 Dec')).toBeVisible();
    await expect(page.getByTestId('timeline').getByRole('img')).toHaveAttribute('aria-label', /Day 23 of 56\./);
    await expect(page.getByTestId('timeline').locator('[role="img"] > span')).toHaveCount(56);
    await expect(page.getByTestId('plan-code')).toHaveText('FT-4K7Q');
    await expect(page.getByTestId('feels-off')).toBeVisible();
    await expect(page.getByTestId('next-step')).toContainText('Nothing to do today.');
  });

  test('AC-22-5: every jump key works as /example?jump=<key>', async ({ page }) => {
    for (const key of Object.keys(JUMP_ROUTE)) {
      await jump(page, key);
      await expect(page).toHaveURL(JUMP_ROUTE[key] ?? /./);
    }
  });

  test('AC-11-6: halfway card at use-day 28; AC-S-HALF-1: the result is never a verdict', async ({ page }) => {
    await jump(page, 'halfway');
    await expect(page.getByTestId('running-head')).toHaveText('Fair Trial · Day 28 of 56');
    await expect(page.getByTestId('next-step')).toContainText('Halfway. Want to take a check-in photo?');
    await page.getByText('Take a halfway photo').click();
    await page.getByTestId('primary').click(); // staged example shot, underarm
    await page.waitForURL(/site=inner-arm/);
    await page.getByTestId('primary').click(); // inner arm
    await expect(page.getByTestId('halfway-result')).toHaveText("Too early to judge. Here's your progress so far.");
    await expect(page.locator('body')).not.toContainText(/Working\.|Not for you\./);
  });

  test('AC-14: bottle running out at use-day 40, no price, stop path', async ({ page }) => {
    await jump(page, 'day-40');
    await expect(page.getByText('Your bottle is almost empty.')).toBeVisible();
    await expect(page.getByText('Your verdict is in 16 days.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Rs\s?\d/);
    await page.getByTestId('secondary').click();
    await page.getByTestId('stop-reaction').click();
    await expect(page).toHaveURL(/\/verdict\/share\?stop=1/);
    await expect(page.getByText('Help the next woman understand why?')).toBeVisible();
    await expect(page.getByTestId('example-tag')).toBeVisible();
  });

  test('AC-12-2, AC-13-1..3, AC-13-6: Day 9 opens filled in; amber moves the date to 15 Dec', async ({ page }) => {
    await jump(page, 'day-9');
    await expect(page.getByTestId('example-tag')).toBeVisible();
    await expect(page.getByTestId('follow-up')).toContainText('Did you use your glycolic toner there?');
    await expect(page.getByTestId('chip-stinging')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('primary').click();
    await expect(page.getByText('Pause for 3 days.')).toBeVisible();
    await expect(page.getByText('Your judge-by date moves to 15 Dec.')).toBeVisible();
    await expect(page.getByTestId('likely-cause')).toContainText('Likely cause: toner on the same skin. Face only from now.');
    await expect(page.getByTestId('escalation')).toBeVisible();
    await expect(page.getByTestId('placeholder-rules')).toBeVisible();
  });

  test('AC-07-1: Day 0 routine for Riya', async ({ page }) => {
    await jump(page, 'day-0');
    await expect(page.getByText('Your usual deodorant.')).toBeVisible();
    await expect(page.getByTestId('keep-apart').first()).toContainText('face only while you use the roll-on');
    await expect(page.getByTestId('placeholder-rules')).toBeVisible();
    await expect(page.getByTestId('running-head')).toHaveText('Day 0 · 1 of 3');
  });

  test('AC-15-1: Riya skin file at use-day 23', async ({ page }) => {
    await jump(page, 'day-23');
    await page.getByTestId('home-file').click();
    const file = page.getByTestId('skin-file');
    await expect(file).toContainText('4% AHA BHA Underarm Roll On');
    await expect(file).toContainText('17 Oct · 23 days used');
    await expect(file).toContainText('Darker underarms, a year or more · razor');
    await expect(file).toContainText('Day 9: stinging, bothering. Paused 3 days.');
    await expect(file).toContainText('15 December');
    await expect(page.getByTestId('example-tag')).toBeVisible();
  });

  test('example photos: blind pick shows two images labelled "Example photo"; photo screens carry the label', async ({ page }) => {
    await jump(page, 'day-56-working');
    await expect(page.getByRole('img', { name: /^Photo [AB]$/ })).toHaveCount(2);
    await expect(page.getByTestId('example-photo')).toHaveCount(2);
    await expect(page.getByTestId('example-photo-label')).toHaveText(['Example photo', 'Example photo']);
    await expect(page.getByTestId('pick-A')).toBeVisible();
    await expect(page.getByTestId('pick-B')).toBeVisible();
    await jump(page, 'day-0');
    await page.goto('/start/photo');
    await expect(page.getByTestId('example-photo-label')).toHaveText('Example photo');
    await page.goto('/start/photo/check');
    await expect(page.getByTestId('example-photo-label')).toHaveText(['Example photo', 'Example photo']);
  });

  test('AC-22-4, AC-17, AC-18, AC-V-*: all five verdicts, and the step-up line, in under a minute', async ({ page }) => {
    const started = Date.now();
    await page.goto('/example');

    // Working (16 then 17)
    await page.getByTestId('moment-day-56-working').click();
    await expect(page).toHaveURL(/\/verdict\/pick$/);
    await expect(page.getByText('Which one looks lighter?')).toBeVisible();
    await page.getByTestId('pick-A').click();
    await expect(page.getByRole('heading', { name: 'Working.' })).toBeVisible();
    await expect(page.getByText('Keep going. Check again in 8 weeks.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Rs\s?\d|add to cart|discount/i);
    await expect(page.getByTestId('placeholder-rules')).toBeVisible();

    // Not for you, the other ending (Riya paused after Day 9, so no step-up)
    await jump(page, 'day-56-not-for-you');
    await expect(page.getByRole('heading', { name: 'Not for you.' })).toBeVisible();
    await expect(page.getByText('You gave it a fair trial. You can stop here.')).toBeVisible();
    await expect(page.getByText('This is about the product and your skin, not you.')).toBeVisible();
    await expect(page.getByTestId('step-up')).toHaveCount(0);

    // Not for you after a calm trial: one step-up line, no price, a text link to the 6% check
    await page.goto('/example');
    await page.getByTestId('moment-more').click();
    await page.getByTestId('ending-not-for-you-calm').click();
    await expect(page.getByRole('heading', { name: 'Not for you.' })).toBeVisible();
    await expect(page.getByText('No clear change on the 4% at 8 weeks.')).toBeVisible();
    await expect(page.getByTestId('step-up')).toContainText('Your skin stayed calm. Some people see more on the stronger 6%. Trying it would be a new fair trial.');
    await expect(page.locator('body')).not.toContainText(/Rs\s?\d|add to cart|discount/i);
    await expect(page.getByTestId('step-up-link')).toHaveAttribute('href', '/check/1');

    // Not yet, Can't call it, See a doctor
    await jump(page, 'not-yet');
    await expect(page.getByRole('heading', { name: 'Not yet.' })).toBeVisible();
    await expect(page.getByText('Not enough use-days yet. New date: 3 January.')).toBeVisible(); // AC-V-NY-1
    await jump(page, 'cant-call');
    await expect(page.getByRole('heading', { name: "Can't call it." })).toBeVisible();
    await expect(page.getByText('The light was too different. Retake in daylight near a window.')).toBeVisible(); // AC-V-CC-1
    await expect(page.getByTestId('primary')).toHaveText('Retake photos');
    await jump(page, 'see-doctor');
    await expect(page.getByRole('heading', { name: 'See a doctor.' })).toBeVisible();
    await expect(page.getByText("You had a reaction that needs a doctor's eye. Show them your skin file.")).toBeVisible(); // AC-V-SD-1
    await expect(page.getByText('Talk to the Bodywise in-app doctor')).toBeVisible();
    await expect(page.getByText('Open my skin file')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Rs\s?\d|stronger 6%/);

    expect(Date.now() - started).toBeLessThan(60_000);
  });

  test('AC-20-1, AC-20-2, AC-20-3, AC-20-5, AC-20-4: Keep Going, and none after Not for you', async ({ page }) => {
    await jump(page, 'keep-going');
    await expect(page.getByTestId('running-head')).toHaveText('Keep Going · week 9');
    await expect(page.getByTestId('next-check')).toHaveText('9 Feb');
    await expect(page.getByTestId('next-bottle')).toHaveText('around 8 Jan');
    await expect(page.getByTestId('working-plate')).toHaveText('Working');
    await expect(page.getByTestId('roster')).toContainText('Deodorant');
    await expect(page.getByTestId('roster')).toContainText('Face only');
    await expect(page.getByTestId('shelf-answer')).toHaveText('Fine together');
    await expect(page.getByText('Serum in the morning, roll-on at night.')).toBeVisible();
    const reorder = page.getByTestId('reorder');
    await expect(reorder).toHaveText('Order another bottle on Be Bodywise');
    await expect(reorder).toHaveAttribute('target', '_blank');
    await expect(page.getByTestId('feels-off')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Rs\s?\d/);

    // The reorder link is on no other screen (B10).
    for (const key of ['day-56-working', 'day-56-not-for-you', 'day-23', 'day-40']) {
      await jump(page, key);
      await expect(page.getByTestId('reorder')).toHaveCount(0);
    }

    await jump(page, 'day-56-not-for-you');
    await page.goto('/keep');
    await expect(page).toHaveURL(/\/trial$/);
  });

  test('AC-19: share screen lists what is and is not shared; Yes prepares the payload on the phone', async ({ page }) => {
    await jump(page, 'day-56-working');
    await page.goto('/verdict/share');
    await expect(page.getByTestId('shared-list')).toContainText('Your verdict');
    await expect(page.getByTestId('shared-list')).toContainText('Days used');
    await expect(page.getByTestId('shared-list')).toContainText('Week of the year');
    await expect(page.getByTestId('never-list')).toContainText('Photos');
    await expect(page.getByTestId('never-list')).toContainText('Your number');
    const requests: string[] = [];
    page.on('request', (r) => r.method() !== 'GET' && requests.push(r.url()));
    await page.getByText('Yes, share anonymously').click();
    await expect(page.getByTestId('share-thanks')).toContainText('In this concept, nothing is sent.');
    await page.getByTestId('see-shared').click();
    const text = await page.getByTestId('payload-list').innerText();
    expect(text).not.toMatch(/\b(name|phone|email|photo|lat|lng)\b\s*:/i); // AC-19-3
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toContain('FT-4K7Q');
    expect(requests).toEqual([]);
  });

  test('AC-22-3: running the example leaves her own plan exactly as it was', async ({ page }) => {
    await page.goto('/trial');
    await page.waitForFunction(async () => (await indexedDB.databases()).some((d) => d.name === 'fair-trial'));
    await page.waitForTimeout(150);
    const mine = { planCode: 'FT-MINE', trialId: 'a', mode: 'live', checkedOn: '2026-10-14', channel: 'direct', fit: {}, fitResult: { outcome: 'good', hormoneNote: false }, shelf: [], shelfAnswers: [], pick: { pick: 'bw-rollon-4', ruleRow: 8, baseRow: 8, headline: 'x', why: [], whyNot: [], doctorFirst: false, hormoneNote: false }, dayLog: [], reactions: [], photoIds: [], photosSkipped: false, rulesVersion: 'x' };
    const read = () =>
      page.evaluate(
        () =>
          new Promise<string>((resolve, reject) => {
            const open = indexedDB.open('fair-trial');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const get = db.transaction('plan').objectStore('plan').get('live');
              get.onsuccess = () => {
                db.close();
                resolve(JSON.stringify(get.result));
              };
            };
          }),
      );
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
          };
        }),
      mine,
    );
    const before = await read();
    expect(before).toContain('FT-MINE');

    await jump(page, 'day-23');
    await page.getByTestId('used-toggle').check();
    await page.getByTestId('example-leave').click();
    await page.waitForURL((u) => ['/', '/start'].includes(u.pathname)); // the welcome page sends her on to her saved plan
    expect(await read()).toBe(before);

    // Back on her own trial, nothing of Riya's is there.
    await page.goto('/trial');
    await expect(page.getByTestId('example-tag')).toHaveCount(0);
  });

  test('AC-21: insights on sample data, labelled; stacks on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/insights');
    await expect(page.getByTestId('sample-tag')).toContainText('Sample data, illustrative only');
    await expect(page.getByText('Only anonymous answers customers chose to share. No photos, names, numbers or locations.')).toBeVisible();
    await expect(page.getByText('3,390')).toBeVisible(); // from insights-sample.json
    await expect(page.locator('body')).not.toContainText('24h'); // AC-21-3
    await expect(page.getByRole('columnheader', { name: 'No change at verdict' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/insights');
    await expect(page.getByTestId('sample-tag')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0); // AC-21-4
  });

  test('AC-21: missing sample data shows no numbers', async ({ page }) => {
    await page.route('**/data/insights-sample.json', (r) => r.fulfill({ status: 404, body: '' }));
    await page.goto('/insights');
    await expect(page.getByTestId('insights-missing')).toContainText('Sample data unavailable.');
    await expect(page.getByText('3,390')).toHaveCount(0);
  });

  test('AC-G-1, AC-G-4: no horizontal scroll on the example screens, no banned words', async ({ page }) => {
    for (const key of ['day-0', 'day-9', 'day-23', 'day-40', 'day-56-working', 'day-56-not-for-you', 'not-yet', 'cant-call', 'see-doctor', 'keep-going']) {
      await jump(page, key);
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, key).toBeLessThanOrEqual(0);
      const text = await page.locator('body').innerText();
      expect(text, key).not.toMatch(/you have|diagnos|!|₹|streak|coins|discount|add to cart/i);
    }
  });

  test('Jump to day control lists the moments and moves the example', async ({ page }) => {
    await jump(page, 'day-23');
    await page.getByTestId('example-jump').click();
    await page.getByTestId('jump-day-40').click();
    await expect(page.getByText('Your bottle is almost empty.')).toBeVisible();
  });
});
