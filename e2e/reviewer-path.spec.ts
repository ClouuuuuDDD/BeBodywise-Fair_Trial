/**
 * The reviewer path (E7): from the landing page, one tap on "See an example trial", then the story
 * Day 0 -> Day 23 -> reaction -> verdict -> every other outcome, using "Jump to day".
 * Asserts the "Example" tag is on every screen after the first tap, counts taps (target: the story to a
 * Working verdict in <= 12 taps; about 60 seconds of human clicking) and logs the time.
 */
import { expect, test, type Page } from '@playwright/test';

/** Counts every tap the reviewer makes. Wraps click so the count cannot drift from what the test does. */
function tapper(page: Page) {
  let taps = 0;
  return {
    get taps() {
      return taps;
    },
    async tap(testId: string) {
      taps += 1;
      await page.getByTestId(testId).click();
    },
    async jumpTo(key: string, url: RegExp) {
      await this.tap('example-jump'); // open the Jump to day sheet
      await this.tap(`jump-${key}`);
      await expect(page).toHaveURL(url);
      await expect(page.getByTestId('example-tag')).toBeVisible();
    },
  };
}

test.describe('Reviewer path', () => {
  test('one tap from the landing page, then the whole story with the Example tag always visible', async ({ page }) => {
    const started = Date.now();
    const t = tapper(page);

    // Tap 1: the landing page to the example.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Is this roll-on right for you?' })).toBeVisible();
    const seeExample = page.getByRole('link', { name: 'See an example trial' });
    await expect(seeExample).toBeVisible();
    // 44 px target on the very first control a reviewer meets.
    expect((await seeExample.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await seeExample.click();
    let taps = 1;
    await expect(page).toHaveURL(/\/example$/);
    await expect(page.getByTestId('example-tag')).toHaveText('Example trial');

    // Day 0 via its moment card (the example page lists them), then Jump to day for everything else.
    await t.tap('moment-day-0');
    taps += 1;
    await expect(page).toHaveURL(/\/start\/routine$/);
    await expect(page.getByTestId('example-tag')).toHaveText('Example');

    await t.jumpTo('day-23', /\/trial$/);
    await expect(page.getByText('23 / 56 days')).toBeVisible();

    await t.jumpTo('day-9', /\/help$/);
    await expect(page.getByTestId('follow-up')).toContainText('Did you use your glycolic toner there?');

    await t.jumpTo('day-56-working', /\/verdict\/pick$/);
    await t.tap('pick-A');
    await expect(page.getByRole('heading', { name: 'Working.' })).toBeVisible();
    await expect(page.getByTestId('example-tag')).toBeVisible();

    const storyTaps = taps + t.taps;
    test.info().annotations.push({ type: 'taps to the Working verdict', description: String(storyTaps) });
    expect(storyTaps, 'taps from the landing page to a Working verdict').toBeLessThanOrEqual(12);

    // Every other outcome, two taps each from wherever she is.
    const outcomes: Array<[string, RegExp, string]> = [
      ['day-56-not-for-you', /\/verdict$/, 'Not for you.'],
      ['not-for-you-calm', /\/verdict$/, 'Not for you.'],
      ['not-yet', /\/verdict$/, 'Not yet.'],
      ['cant-call', /\/verdict$/, "Can't call it."],
      ['see-doctor', /\/verdict$/, 'See a doctor.'],
    ];
    for (const [key, url, headline] of outcomes) {
      const before = t.taps;
      await t.jumpTo(key, url);
      await expect(page.getByRole('heading', { name: headline })).toBeVisible();
      expect(t.taps - before, `taps to reach ${key}`).toBe(2);
    }

    // After the verdict, and the page for Be Bodywise.
    await t.jumpTo('keep-going', /\/keep$/);
    await t.jumpTo('insights', /\/insights$/);

    const seconds = (Date.now() - started) / 1000;
    const all = taps + t.taps;
    test.info().annotations.push({ type: 'taps for the whole walk', description: String(all) });
    test.info().annotations.push({ type: 'machine time (s)', description: seconds.toFixed(1) });
    console.log(`reviewer path: ${storyTaps} taps to a Working verdict, ${all} taps for every outcome, ${seconds.toFixed(1)} s machine time`);
    // Machine time is far below human time; this only catches a stall.
    expect(seconds).toBeLessThan(60);
  });

  test('the Example tag is visible on every screen a reviewer can reach from the example', async ({ page }) => {
    const t = tapper(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'See an example trial' }).click();
    await expect(page).toHaveURL(/\/example$/);
    await t.tap('moment-check');
    await expect(page).toHaveURL(/\/check\/match$/);
    await expect(page.getByTestId('example-tag')).toBeVisible();
    for (const [key, url] of [
      ['day-0', /\/start\/routine$/],
      ['day-9', /\/help$/],
      ['day-23', /\/trial$/],
      ['day-40', /\/trial$/],
      ['day-56-working', /\/verdict\/pick$/],
      ['keep-going', /\/keep$/],
    ] as Array<[string, RegExp]>) {
      await t.jumpTo(key, url);
    }
  });
});
