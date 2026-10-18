/**
 * Fair Trial screens 07-20, real path (E5). Her own plan is seeded straight into IndexedDB (the Right Start
 * screens belong to E4), then the trial is walked with the file-input photo fallback and a fixed clock.
 * Acceptance criteria referenced in comments are in docs/prd/PRD.md section 10.
 */
import { deflateSync, crc32 } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';

/* ---------- synthetic photos: grey wall, skin in the guide oval with texture, white card bottom right ---------- */

type RGB = [number, number, number];

function rnd(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A PNG of the staged scene. `dim` scales exposure (0.15 = far too dark). */
function photo(skin: RGB, dim = 1): Buffer {
  const w = 240;
  const h = 320;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w - 0.5;
      const dy = (y + 0.5) / h - 0.5;
      const inOval = (dx * dx) / 0.3 ** 2 + (dy * dy) / 0.36 ** 2 <= 1;
      const inCard = x > w * 0.72 && y > h * 0.8 && x < w * 0.97 && y < h * 0.97;
      let base: RGB = [90, 100, 95];
      if (inOval) base = skin;
      if (inCard) base = [235, 235, 235];
      const n = inOval ? rnd(x * 7 + y * 131) * 6 : 0;
      for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.max(0, Math.min(255, Math.round(((base[c] as number) + n) * dim)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const UNDERARM_DARK: RGB = [150, 105, 85];
const INNER_ARM: RGB = [195, 148, 120];
const UNDERARM_LIGHTER: RGB = [188, 140, 115];

/* ---------- seeding her plan ---------- */

const PLAN = {
  planCode: 'FT-9TST',
  trialId: '11111111-1111-4111-8111-111111111111',
  mode: 'live',
  checkedOn: '2026-10-14',
  channel: 'direct',
  fit: { shade: 'moderate', duration: 'year-plus', hairRemoval: 'razor', darkNeck: 'no', regularPeriods: 'yes' },
  fitResult: { outcome: 'good-with-habit', habit: 'Wait after shaving.', hormoneNote: false },
  shelf: [
    {
      id: 'toner-1',
      product: 'Glow 7% Glycolic Toner',
      source: 'typed',
      ingredients: [{ inci: 'Glycolic Acid', normalised: 'glycolic acid', classes: ['aha'], position: 1 }],
      classes: ['aha'],
      areas: ['face', 'underarm'],
      times: 'night',
      stung: false,
      mascot: 'toner',
    },
  ],
  shelfAnswers: [{ itemId: 'toner-1', answer: 'pick-one', ruleId: 'test', reason: 'Glow toner has Glycolic Acid.', ingredient: 'Glycolic Acid', priority: 2 }],
  pick: { pick: 'bw-rollon-4', ruleRow: 8, baseRow: 8, headline: 'Start gentle.', why: [], whyNot: [], doctorFirst: false, hormoneNote: false, priceInr: 329 },
  dayLog: [],
  reactions: [],
  photoIds: [],
  photosSkipped: false,
  rulesVersion: 'test',
};

type PlanOverrides = Record<string, unknown>;

/** Puts her plan in IndexedDB (the app opens the database on first use) and reloads. */
async function seedPlan(page: Page, overrides: PlanOverrides = {}): Promise<void> {
  await page.goto('/trial'); // the app opens the vault on first use
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
    { ...PLAN, ...overrides },
  );
}

async function readPlan(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('fair-trial');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('plan').objectStore('plan').get('live');
          get.onsuccess = () => {
            db.close();
            resolve(get.result as Record<string, unknown>);
          };
        };
      }),
  );
}

/** Waits until her saved plan satisfies a check (saves are asynchronous). */
async function planWhen(page: Page, check: (plan: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
  await expect.poll(async () => check(await readPlan(page))).toBe(true);
  return readPlan(page);
}

async function countPhotos(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('fair-trial');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('photos').objectStore('photos').count();
          all.onsuccess = () => {
            db.close();
            resolve(all.result);
          };
        };
      }),
  );
}

/** Takes one photo through the camera card: no camera in the test browser, so the upload fallback appears. */
async function takePhoto(page: Page, image: Buffer): Promise<void> {
  const upload = page.getByTestId('photo-upload');
  if (!(await upload.isVisible().catch(() => false))) {
    await page.getByTestId('primary').click();
  }
  await upload.setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: image });
}

async function dayZeroPhotos(page: Page): Promise<void> {
  await page.goto('/start/photo?site=underarm');
  await takePhoto(page, photo(UNDERARM_DARK));
  await page.waitForURL('**/start/photo?site=inner-arm');
  await takePhoto(page, photo(INNER_ARM));
  await page.waitForURL('**/start/photo/check');
}

test.describe('Fair Trial, real path', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-17T10:00:00+05:30'));
  });

  test('AC-07: routine for her own shelf, rules, placeholder label, share link', async ({ page }) => {
    await seedPlan(page);
    await page.goto('/start/routine');
    await expect(page.locator('[data-screen="07"]')).toBeVisible();
    await expect(page.getByTestId('running-head')).toHaveText('Day 0 · 1 of 3');
    await expect(page.getByText('Roll-on. One swipe, on clean, dry skin.')).toBeVisible();
    await expect(page.getByText('Nothing else needed.')).toBeVisible();
    await expect(page.getByTestId('keep-apart')).toContainText('face only while you use the roll-on');
    await expect(page.getByText('Shaved? Wait 10-15 minutes. Waxed? Wait 6-12 hours. If it stings, use it at night instead.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('24 hours');
    await expect(page.getByText(/wait a day/)).toBeVisible();
    await expect(page.getByText(/sunscreen/)).toBeVisible();
    await expect(page.getByTestId('placeholder-rules')).toHaveText('Placeholder rules, to be signed by a dermatologist.');
    const share = page.getByTestId('share-routine');
    const href = (await share.getAttribute('href')) ?? '';
    expect(href).toContain('wa.me');
    expect(decodeURIComponent(href)).not.toMatch(/moderate|razor|year-plus/);
  });

  test('AC-08, AC-09: guided photos, quality gate, nothing leaves the phone', async ({ page, baseURL }) => {
    await seedPlan(page);
    const outbound: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(baseURL ?? 'http://localhost') && !/^(data|blob):|fonts\.(googleapis|gstatic)\.com/.test(r.url())) outbound.push(r.url());
    });
    await page.goto('/start/photo?site=underarm');
    await expect(page.getByTestId('running-head')).toHaveText('Day 0 · Photo 1 of 2');
    await expect(page.getByText('CARD', { exact: true })).toBeVisible();
    await expect(page.getByTestId('privacy-chip')).toHaveText('Photos never leave this phone');

    // AC-08-3: too dark -> the fix line and Retake, and the flow does not advance.
    await takePhoto(page, photo(UNDERARM_DARK, 0.15));
    await expect(page.getByTestId('photo-fail')).toContainText('Too dark. Move closer to a window.');
    await expect(page.getByTestId('retake')).toBeVisible();
    await expect(page).toHaveURL(/site=underarm/);
    expect(await countPhotos(page)).toBe(0);

    // AC-08-5: no camera in this browser, so the upload fallback is offered.
    await page.getByTestId('retake').click();
    await expect(page.getByTestId('photo-upload')).toBeAttached();

    // AC-08-2: a good photo is stored as a Blob; two photos reach the check.
    await takePhoto(page, photo(UNDERARM_DARK));
    await page.waitForURL('**/start/photo?site=inner-arm');
    await expect(page.getByTestId('running-head')).toHaveText('Day 0 · Photo 2 of 2');
    await takePhoto(page, photo(INNER_ARM));
    await page.waitForURL('**/start/photo/check');
    expect(await countPhotos(page)).toBe(2);

    // AC-09-1
    await expect(page.getByText('Underarm', { exact: true })).toBeVisible();
    await expect(page.getByText('Inner arm', { exact: true })).toBeVisible();
    await expect(page.getByText('Even light, no flash')).toBeVisible();
    await expect(page.getByText('In focus')).toBeVisible();
    await expect(page.getByText('White card in both')).toBeVisible();
    // AC-09-3
    await page.getByTestId('secondary').click();
    await expect(page).toHaveURL(/\/start\/photo\?site=underarm/);
    expect(outbound).toEqual([]);
  });

  test('AC-08-4: skip for now shows the consequence and continues to the date', async ({ page }) => {
    await seedPlan(page);
    await page.goto('/start/photo?site=underarm');
    await page.getByText('Skip for now').click();
    await expect(page.getByTestId('skip-note')).toHaveText("Without photos, I can still give you a date to decide, but I can't measure the change.");
    await page.getByRole('button', { name: 'Continue without photos' }).click();
    await expect(page).toHaveURL(/\/start\/date/);
  });

  test('AC-10: judge-by date, cost, calendar, event mode; Day 0 set on leaving', async ({ page }) => {
    await seedPlan(page);
    await page.goto('/start/date');
    await expect(page.getByTestId('judge-date')).toHaveText('12 Dec');
    await expect(page.getByText('56 days of use')).toBeVisible();
    await expect(page.getByText('2 bottles')).toBeVisible();
    await expect(page.getByText('Rs 658 to know')).toBeVisible();
    await expect(page.getByText('At the Bodywise list price of Rs 329.')).toBeVisible();
    await expect(page.getByText(/Skipped days move the date back\./)).toBeVisible();

    // AC-10-4
    await page.getByTestId('event-row').click();
    await page.getByTestId('event-date').fill('2026-11-20');
    await expect(page.getByTestId('sheet').getByText("By 20 Nov you'll be about 5 weeks in. Some change is possible, a full result is not.")).toBeVisible();
    await page.getByTestId('sheet').getByTestId('primary').click();
    await expect(page.getByTestId('sheet')).toHaveCount(0);

    // AC-10-3: an .ics download whose DTSTART is the judge-by date
    await page.getByRole('button', { name: 'Add to my calendar' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('cal-ics').click()]);
    const stream = await download.createReadStream();
    let text = '';
    for await (const part of stream) text += part.toString();
    expect(text).toContain('DTSTART;VALUE=DATE:20261212');
    await expect(page).toHaveURL(/\/trial$/);
    await planWhen(page, (p) => p['day0'] === '2026-10-17');
  });

  test('AC-10-5: the 6% pick reads Rs 798 with the Rs 399 line', async ({ page }) => {
    await seedPlan(page, { pick: { ...PLAN.pick, pick: 'bw-rollon-6', priceInr: 399 }, trialProduct: 'bw-rollon-6' });
    await page.goto('/start/date');
    await expect(page.getByText('Rs 798 to know')).toBeVisible();
    await expect(page.getByText('At the Bodywise list price of Rs 399.')).toBeVisible();
  });

  test('AC-11: home, use-day log, no streaks, halfway card', async ({ page }) => {
    await seedPlan(page, { day0: '2026-09-19', trialProduct: 'bw-rollon-4' }); // 28 days before the fixed clock
    await page.goto('/trial');
    await expect(page.getByTestId('running-head')).toHaveText('Fair Trial · Day 28 of 56');
    await expect(page.getByText('28 / 56 days')).toBeVisible();
    await expect(page.getByText('Judge on 14 Nov')).toBeVisible();
    await expect(page.getByTestId('timeline')).toBeVisible();
    // AC-11-6: use-day 28 swaps in the halfway card
    await expect(page.getByTestId('next-step')).toContainText('Halfway. Want to take a check-in photo?');
    await expect(page.getByTestId('feels-off')).toBeVisible();
    // AC-11-4
    await expect(page.getByText("Counting days you didn't log as used.")).toBeHidden(); // halfway replaces the quiet state's note
    // AC-11-3: the toggle stores a used log for today and turning it off removes it
    await page.getByTestId('used-toggle').check();
    await planWhen(page, (p) => (p['dayLog'] as { date: string; status: string }[]).some((e) => e.date === '2026-10-17' && e.status === 'used'));
    await page.getByTestId('used-toggle').uncheck();
    await planWhen(page, (p) => (p['dayLog'] as unknown[]).length === 0);
    await expect(page.locator('body')).not.toContainText(/streak/i);
  });

  test('AC-11-4 and AC-14: quiet home with a note, refill state only from use-day 40', async ({ page }) => {
    await seedPlan(page, { day0: '2026-09-27', trialProduct: 'bw-rollon-4' }); // use-day 20
    await page.goto('/trial');
    await expect(page.getByTestId('next-step')).toContainText('Nothing to do today.');
    await expect(page.getByText("Counting days you didn't log as used.")).toBeVisible();
    await seedPlan(page, { day0: '2026-09-08', trialProduct: 'bw-rollon-4' }); // use-day 39
    await page.goto('/trial');
    await expect(page.getByTestId('refill-card')).toHaveCount(0); // AC-14-5
    await seedPlan(page, { day0: '2026-09-07', trialProduct: 'bw-rollon-4' }); // use-day 40
    await page.goto('/trial');
    await expect(page.getByText('Your bottle is almost empty.')).toBeVisible();
    await expect(page.getByText('Your verdict is in 16 days.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Rs\s?\d/); // AC-14-2: no price
    await expect(page.locator('a[href*="bebodywise.com"]')).toHaveCount(0);
    await page.getByTestId('primary').click(); // AC-14-3
    await expect(page.getByTestId('refill-card')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('refill-card')).toHaveCount(0);
  });

  test('AC-14-4, AC-S-STOP-1: stop reason, stop variant of the share screen, stopped home', async ({ page }) => {
    await seedPlan(page, { day0: '2026-09-07', trialProduct: 'bw-rollon-4' });
    await page.goto('/trial');
    await page.getByTestId('secondary').click();
    await expect(page.getByTestId('sheet').locator('button[data-testid^="stop-"]')).toHaveCount(7); // six reasons and Skip
    await page.getByTestId('stop-price').click();
    await expect(page).toHaveURL(/\/verdict\/share\?stop=1/);
    await expect(page.getByText('Help the next woman understand why?')).toBeVisible();
    await expect(page.getByTestId('shared-list')).toContainText('Why you stopped');
    expect((await readPlan(page))['consent']).toBeUndefined(); // nothing prepared before her Yes
    await page.getByTestId('secondary').click(); // No thanks
    await expect(page.getByText("You've stopped.")).toBeVisible();
    await expect(page.getByText('My skin file')).toBeVisible();
  });

  test('AC-12, AC-13: reaction desk lights', async ({ page }) => {
    await seedPlan(page, { day0: '2026-10-17', trialProduct: 'bw-rollon-4' });
    await page.clock.setFixedTime(new Date('2026-10-26T20:00:00+05:30')); // use-day 9
    await page.goto('/help');
    // AC-12-1 and AC-12-2
    await expect(page.getByTestId('primary')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('follow-up')).toContainText('Did you use your glycolic toner there?');
    await expect(page.getByTestId('follow-up')).toContainText("Asked because it's on your shelf.");
    await page.getByTestId('chip-stinging').click();
    await page.getByTestId('option-bothering').click();
    await page.getByTestId('follow-yes').click();
    await expect(page.getByTestId('primary')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('primary').click();
    // AC-13-1, AC-13-2, AC-13-3, AC-13-6
    await expect(page.getByText('Pause for 3 days.')).toBeVisible();
    await expect(page.getByText('Then use it every other night for a week before going back to every night.')).toBeVisible();
    await expect(page.getByTestId('likely-cause')).toContainText('Likely cause: toner on the same skin. Face only from now.');
    await expect(page.getByText('Your judge-by date moves to 15 Dec.')).toBeVisible();
    await expect(page.getByTestId('escalation')).toContainText('If it becomes painful, blisters or spreads, stop and show your skin file to a doctor.');
    await expect(page.getByTestId('placeholder-rules')).toBeVisible();
    const saved = await planWhen(page, (p) => (p['dayLog'] as { status: string }[]).filter((e) => e.status === 'paused').length === 3);
    expect((saved['reactions'] as unknown[]).length).toBe(1);
    await page.getByTestId('primary').click();
    await expect(page.getByText('Judge on 15 Dec')).toBeVisible();
    await expect(page.getByText('Moved 3 days for your pause')).toBeVisible();

    // AC-13-4: painful is red, with the doctor link and the skin file
    await page.goto('/help');
    await page.getByTestId('chip-redness').click();
    await page.getByTestId('option-painful').click();
    await expect(page.getByTestId('primary')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('primary').click();
    await expect(page.getByText('Stop using it.')).toBeVisible();
    await expect(page.getByText('Show this to a doctor. Bring your skin file.')).toBeVisible();
    await expect(page.getByText('Talk to the Bodywise in-app doctor')).toBeVisible();
    await expect(page.getByText('Open my skin file')).toBeVisible();
    await expect(page.getByTestId('placeholder-rules')).toBeVisible();
    await planWhen(page, (p) => (p['reactions'] as unknown[]).length === 2);
    await page.goto('/trial');
    await expect(page.getByTestId('next-step')).toContainText('Paused after a reaction. See a doctor before restarting.');
  });

  test('AC-13-5: mild on use-day 5 is green', async ({ page }) => {
    await seedPlan(page, { day0: '2026-10-12', trialProduct: 'bw-rollon-4' });
    await page.goto('/help');
    await page.getByTestId('chip-flaking').click();
    await page.getByTestId('option-mild').click();
    await page.getByTestId('follow-no').click();
    await expect(page.getByTestId('primary')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('primary').click();
    await expect(page.getByText('Common in the first 2 weeks. Skip a day if needed.')).toBeVisible();
    await expect(page.getByTestId('escalation')).toBeVisible();
  });

  test('AC-12-3: a shelf with only the lotion has no follow-up', async ({ page }) => {
    await seedPlan(page, {
      day0: '2026-10-12',
      trialProduct: 'bw-rollon-4',
      shelf: [{ id: 'lot', product: 'Niacinamide Body Lotion', catalogId: 'bw-niacinamide-lotion', source: 'catalog', ingredients: [], classes: ['soothing'], areas: ['body'], times: 'morning', stung: false, mascot: 'lotion' }],
      shelfAnswers: [],
    });
    await page.goto('/help');
    await expect(page.getByTestId('follow-up')).toHaveCount(0);
  });

  test('AC-15: skin file lists the plan, makes the PDF on the phone, deletes everything', async ({ page }) => {
    await seedPlan(page, { day0: '2026-09-24', trialProduct: 'bw-rollon-4' });
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed++;
      };
    });
    await page.goto('/file');
    await expect(page.getByTestId('skin-file')).toContainText('Plan FT-9TST');
    await expect(page.getByTestId('skin-file')).toContainText('4% AHA BHA Underarm Roll On');
    await expect(page.getByTestId('skin-file')).toContainText('24 Sep · 23 days used');
    await expect(page.getByTestId('skin-file')).toContainText('Darker underarms, a year or more · razor');
    await expect(page.getByTestId('skin-file')).toContainText('None logged');
    await expect(page.getByTestId('include-photos')).not.toBeChecked(); // AC-15-3
    const before = requests.length;
    await page.getByText('Share as PDF').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    expect(requests.slice(before).filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'))).toEqual([]); // AC-15-2
    await expect(page.locator('p', { hasText: 'Concept for Be Bodywise · Not a diagnosis.' })).toBeAttached();

    // AC-15-4
    await page.getByTestId('delete-all').click();
    await page.getByTestId('delete-confirm').click();
    await page.waitForURL((u) => u.pathname === '/');
    await page.goto('/trial');
    await expect(page).toHaveURL(/\/check\/1/);
  });

  test('AC-16: the blind pick shuffles, stores what she says, and hides which is which', async ({ page }) => {
    await seedPlan(page, { day0: '2026-09-19', trialProduct: 'bw-rollon-4' });
    // Four photo records, so the pick screen has both verdict-day photos (the Blobs are blank on purpose).
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('fair-trial');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('photos', 'readwrite');
            const blob = new Blob(['x'], { type: 'image/jpeg' });
            const rows: [string, string][] = [['day0', 'underarm'], ['day0', 'inner-arm'], ['verdict', 'underarm'], ['verdict', 'inner-arm']];
            rows.forEach(([moment, region], i) =>
              tx.objectStore('photos').put({ id: `${moment}-${region}`, region, moment, takenAt: `2026-10-1${i}T10:00:00Z`, blob, width: 1, height: 1, pairId: moment }),
            );
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
    );
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      await page.addInitScript((v) => {
        sessionStorage.removeItem('ft-blind-order');
        Math.random = () => v;
      }, i / 20 + 0.01);
      await page.goto('/verdict/pick');
      await expect(page.getByTestId('pick-A')).toBeVisible();
      const order = await page.evaluate(() => sessionStorage.getItem('ft-blind-order')); // which photo is shown as A
      orders.add(String(order));
      await page.getByTestId('pick-A').click();
      await page.waitForURL('**/verdict');
      // AC-16-2: choosing A stores what A was
      await planWhen(page, (p) => (p['blindPick'] as { says?: string } | undefined)?.says === (order === 'now' ? 'now-lighter' : 'day0-lighter'));
    }
    expect([...orders].sort()).toEqual(['day0', 'now']);

    // AC-16-2: "They look the same to me" stores 'same'; AC-16-3: nothing on screen says which is which
    await page.goto('/verdict/pick');
    await expect(page.locator('body')).not.toContainText(/Day 0 photo|Today's photo|EXIF|2026/i);
    await page.getByTestId('secondary').click();
    await page.waitForURL('**/verdict');
    await planWhen(page, (p) => (p['blindPick'] as { says: string } | undefined)?.says === 'same');
  });

  async function verdictDay(page: Page, plan: PlanOverrides = {}): Promise<void> {
    // Day 0 photos on 17 Oct, then the verdict on 14 Dec (use-day 58, so the 56 are met).
    await seedPlan(page, { day0: '2026-10-17', trialProduct: 'bw-rollon-4', ...plan });
    await page.clock.setFixedTime(new Date('2026-10-17T10:00:00+05:30'));
    await dayZeroPhotos(page);
    await page.clock.setFixedTime(new Date('2026-12-13T10:00:00+05:30'));
  }

  async function verdictPhotos(page: Page): Promise<void> {
    await page.goto('/verdict/photo');
    await expect(page.getByTestId('running-head')).toHaveText('Judge-by date · 12 Dec');
    await takePhoto(page, photo(UNDERARM_LIGHTER));
    await page.waitForURL('**/verdict/photo?site=inner-arm');
    await takePhoto(page, photo(INNER_ARM));
    await page.waitForURL('**/verdict/pick');
  }

  test('AC-17, AC-19, AC-20: Working leads with the blind pick, then share and Keep Going', async ({ page }) => {
    await page.addInitScript(() => {
      Math.random = () => 0.9; // today's photo is shown as A
    });
    await verdictDay(page);
    await verdictPhotos(page);
    await page.getByTestId('pick-A').click();
    await expect(page.getByRole('heading', { name: 'Working.' })).toBeVisible();
    await expect(page.getByText('Keep going. Check again in 8 weeks.')).toBeVisible();
    await expect(page.getByText(/Your blind pick agrees: you chose today's photo\./)).toBeVisible(); // pick leads (G1-1)
    await expect(page.getByText(/days of use, /)).toBeVisible();
    await expect(page.getByTestId('placeholder-rules')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Rs\s?\d|add to cart|discount/i); // AC-17-2
    expect(await page.locator('a[href*="bebodywise.com"]').count()).toBe(0);

    // AC-17-3 and AC-19
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/verdict\/share/);
    await expect(page.getByTestId('shared-list')).toContainText('Whether your pick agreed');
    await expect(page.getByTestId('never-list')).toContainText('Your location');
    await page.getByText('Yes, share anonymously').click();
    await expect(page.getByTestId('share-thanks')).toContainText('In this concept, nothing is sent.');
    await page.getByTestId('see-shared').click();
    const payload = await page.getByTestId('payload-list').innerText();
    expect(payload).not.toMatch(/\b(name|phone|email|photo|lat|lng)\b\s*:/i);
    expect(payload).not.toMatch(/\d{4}-\d{2}-\d{2}/); // ISO week only
    expect(payload).toContain('outcome: working');
    await planWhen(page, (p) => (p['consent'] as { shared: boolean } | undefined)?.shared === true);
    await page.keyboard.press('Escape');
    await page.getByTestId('primary').click();

    // AC-20: Keep Going
    await expect(page).toHaveURL(/\/keep/);
    await expect(page.getByTestId('running-head')).toContainText('Keep Going · week');
    await expect(page.getByTestId('working-plate')).toHaveText('Working');
    await expect(page.getByTestId('reorder')).toHaveText('Order another bottle on Be Bodywise');
    await expect(page.getByTestId('feels-off')).toBeVisible();
    await expect(page.getByTestId('reorder')).toHaveAttribute('target', '_blank');
    await expect(page.locator('body')).not.toContainText(/Rs\s?\d/);
  });

  test('AC-18-5: a calm trial with no change is Not for you, with the step-up line', async ({ page }) => {
    await verdictDay(page);
    await verdictPhotos(page);
    await page.getByTestId('secondary').click(); // They look the same to me
    await expect(page.getByRole('heading', { name: 'Not for you.' })).toBeVisible();
    await expect(page.getByText('You gave it a fair trial. You can stop here.')).toBeVisible();
    await expect(page.getByText('This is about the product and your skin, not you.')).toBeVisible();
    await expect(page.getByText('No clear change on the 4% at 8 weeks.')).toBeVisible();
    await expect(page.getByTestId('step-up')).toContainText('Your skin stayed calm. Some people see more on the stronger 6%. Trying it would be a new fair trial.');
    await expect(page.getByTestId('placeholder-rules')).toBeVisible();
    await page.getByTestId('step-up-link').click();
    await expect(page).toHaveURL(/\/check\/1/);
  });

  test('AC-18-5: an amber reaction or the hormone note removes the step-up line', async ({ page }) => {
    await verdictDay(page, { fitResult: { ...PLAN.fitResult, hormoneNote: true } });
    await verdictPhotos(page);
    await page.getByTestId('secondary').click();
    await expect(page.getByRole('heading', { name: 'See a doctor.' })).toBeVisible(); // AC-18-2
    await expect(page.getByTestId('step-up')).toHaveCount(0);
    await expect(page.getByText('Open my skin file')).toBeVisible();
  });

  test('AC-V-4: no photos, the shade question replaces the blind pick', async ({ page }) => {
    await seedPlan(page, { day0: '2026-10-17', trialProduct: 'bw-rollon-4', photosSkipped: true });
    await page.clock.setFixedTime(new Date('2026-12-13T10:00:00+05:30'));
    await page.goto('/trial');
    await page.getByTestId('primary').click(); // Take my verdict photos -> straight to the verdict
    await expect(page).toHaveURL(/\/verdict$/);
    await expect(page.getByText('Next to your inner arm, your underarm looks…')).toBeVisible();
    await page.getByTestId('option-mild').click(); // one step lighter than "Clearly darker"
    await expect(page.getByRole('heading', { name: 'Working.' })).toBeVisible();
    await expect(page.getByText(/No photos, so nothing was measured\./)).toBeVisible();
  });

  test('AC-V-NY-1: too few use-days is Not yet with a new date', async ({ page }) => {
    await seedPlan(page, { day0: '2026-10-17', trialProduct: 'bw-rollon-4', photosSkipped: true });
    await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+05:30')); // use-day 30
    await page.goto('/verdict');
    await expect(page.getByRole('heading', { name: 'Not yet.' })).toBeVisible();
    await expect(page.getByText('Not enough use-days yet. New date: 12 December.')).toBeVisible();
  });

  test('AC-20-4: Keep Going redirects home without a Working verdict', async ({ page }) => {
    await seedPlan(page, { day0: '2026-09-19', trialProduct: 'bw-rollon-4' });
    await page.goto('/keep');
    await expect(page).toHaveURL(/\/trial$/);
  });
});
