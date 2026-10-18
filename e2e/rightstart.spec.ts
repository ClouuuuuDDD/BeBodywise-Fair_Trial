/**
 * Right Start (screens 01-06, 03b, 04a, 04b, 05b): acceptance criteria from docs/prd/PRD.md section 10.
 * Owner: E4. Every test starts with a fresh browser context (empty IndexedDB, empty localStorage), mocks
 * POST /api/read-label with page.route, uses the file-input fallback for label photos, and blocks every
 * non-local host so nothing waits on a CDN (fonts, Tesseract data).
 */
import { expect, test, type Page, type Request } from '@playwright/test';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

interface Fixture {
  name: string;
  brand: string;
  ingredients: string;
}

/** The three fictional shelf products of the worked example (solution/shelf-check-spec.md). */
const FIXTURES: Record<'toner' | 'spray' | 'cream', Fixture> = {
  toner: {
    name: 'Glow 7% Glycolic Toner',
    brand: 'Glow',
    ingredients:
      'Aqua, Glycolic Acid, Hamamelis Virginiana (Witch Hazel) Water, Aloe Barbadensis Leaf Juice, Glycerin, Sodium Hydroxide, Panthenol, Parfum, Phenoxyethanol, Ethylhexylglycerin',
  },
  spray: { name: 'Fresh Bloom Deo Spray', brand: 'Fresh Bloom', ingredients: 'Alcohol Denat., Butane, Aluminium Chlorohydrate, Parfum' },
  cream: { name: 'Silk Hair Removal Cream', brand: 'Silk', ingredients: 'Aqua, Potassium Thioglycolate, Calcium Hydroxide, Parfum' },
};

type Mock = { current: Fixture; delayMs: number; status: number; requests: number; gate?: Promise<void> };

/** Blocks non-local hosts and mocks the label reader. */
async function setup(page: Page): Promise<Mock> {
  const mock: Mock = { current: FIXTURES.toner, delayMs: 0, status: 200, requests: 0 };
  await page.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname), (route) => route.abort());
  await page.route('**/api/read-label', async (route) => {
    mock.requests += 1;
    if (mock.delayMs) await new Promise((r) => setTimeout(r, mock.delayMs));
    if (mock.gate) await mock.gate; // a test holds the reply until it has looked at the loading state
    if (mock.status !== 200) {
      await route.fulfill({ status: mock.status, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'boom' }) });
      return;
    }
    const kind = (JSON.parse(route.request().postData() ?? '{}') as { kind?: string }).kind;
    const f = mock.current;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        kind === 'front'
          ? { ok: true, kind: 'front', name: f.name, brand: f.brand, provider: 'gemini' }
          : { ok: true, kind: 'ingredients', ingredientsText: f.ingredients, provider: 'gemini' },
      ),
    });
  });
  return mock;
}

const photo = { name: 'label.png', mimeType: 'image/png', buffer: PNG };

async function readEvents(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(
    () =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const open = indexedDB.open('fair-trial');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('events').objectStore('events').getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result as Array<Record<string, unknown>>);
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

async function eventsNamed(page: Page, name: string) {
  return (await readEvents(page)).filter((e) => e.event === name);
}

async function savedPlan(page: Page): Promise<Record<string, unknown> | undefined> {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const open = indexedDB.open('fair-trial');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('plan').objectStore('plan').get('live');
          get.onsuccess = () => {
            db.close();
            resolve(get.result as Record<string, unknown> | undefined);
          };
        };
      }),
  );
}

async function patchPlan(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    (p) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('fair-trial');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const store = db.transaction('plan', 'readwrite').objectStore('plan');
          const get = store.get('live');
          get.onsuccess = () => {
            store.put({ ...get.result, ...p }, 'live');
            db.close();
            resolve();
          };
        };
      }),
    patch,
  );
}

/** Taps one answer on a fit question and waits for the next route. */
async function tap(page: Page, value: string, next: RegExp | string) {
  await page.getByTestId(`option-${value}`).click();
  await expect(page).toHaveURL(next);
}

async function fitCheck(page: Page, a: { shade: string; duration: string; hair: string; neck: string; periods: string }) {
  await page.goto('/check/1');
  await tap(page, a.shade, /\/check\/2$/);
  await tap(page, a.duration, /\/check\/3$/);
  await tap(page, a.hair, /\/check\/4$/);
  await tap(page, a.neck, /\/check\/5$/);
  await tap(page, a.periods, /\/check\/shelf$/);
}

const RIYA = { shade: 'moderate', duration: 'year-plus', hair: 'razor', neck: 'no', periods: 'yes' };

/** Adds one label-read product through 04a and 04b. */
async function addLabelProduct(
  page: Page,
  mock: Mock,
  key: 'toner' | 'spray' | 'cream',
  o: { areas: string[]; time: string; stung?: boolean; antiperspirant?: 'sweat' | 'smell' | 'both' },
) {
  mock.current = FIXTURES[key];
  await page.getByTestId('add-product').click();
  await page.getByTestId('photo-upload').setInputFiles(photo);
  await expect(page.getByRole('heading', { name: 'Now the ingredient list' })).toBeVisible();
  await page.getByTestId('photo-upload').setInputFiles(photo);
  await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
  for (const a of o.areas) await page.getByTestId(`chip-${a}`).click();
  await page.getByTestId(`chip-${o.time}`).click();
  if (o.stung) await page.getByTestId('chip-stung').click();
  await page.getByTestId('primary').click();
  if (o.antiperspirant) await page.getByTestId(`sweat-${o.antiperspirant}`).click();
  await expect(page).toHaveURL(/\/check\/shelf$/);
}

async function addCatalogProduct(page: Page, id: string, o: { areas: string[]; time: string }) {
  await page.getByTestId('add-product').click();
  await page.getByTestId('bodywise-one').click();
  await page.getByTestId(`catalog-${id}`).click();
  await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
  for (const a of o.areas) await page.getByTestId(`chip-${a}`).click();
  await page.getByTestId(`chip-${o.time}`).click();
  await page.getByTestId('primary').click();
  await expect(page).toHaveURL(/\/check\/shelf$/);
}

/** A typed product (no network): name plus the ingredient list. */
async function addTypedProduct(page: Page, name: string, list: string, o: { areas: string[]; time: string }) {
  await page.getByTestId('add-product').click();
  await page.getByTestId('type-name').click();
  await page.getByTestId('typed-name').fill(name);
  await page.getByTestId('typed-ingredients').fill(list);
  await page.getByTestId('type-continue').click();
  await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
  for (const a of o.areas) await page.getByTestId(`chip-${a}`).click();
  await page.getByTestId(`chip-${o.time}`).click();
  await page.getByTestId('primary').click();
  await expect(page).toHaveURL(/\/check\/shelf$/);
}

/** Riya's worked example: four products, answers per solution/shelf-check-spec.md. Ends on 04 with four rows. */
async function riyaShelf(page: Page, mock: Mock) {
  await fitCheck(page, RIYA);
  await addLabelProduct(page, mock, 'toner', { areas: ['face', 'underarm'], time: 'night' });
  await addLabelProduct(page, mock, 'spray', { areas: ['underarm'], time: 'morning', stung: true, antiperspirant: 'smell' });
  await addLabelProduct(page, mock, 'cream', { areas: ['underarm'], time: 'now-and-then' });
  await addCatalogProduct(page, 'bw-niacinamide-lotion', { areas: ['body'], time: 'morning' });
  await expect(page.getByTestId('shelf-row')).toHaveCount(4);
}

/* ------------------------------------------------------------------ 01, 02 */

test.describe('01 Product page door and 02 Welcome', () => {
  test('AC-01-1..3: Add to cart, the card, the price and the concept label', async ({ page }) => {
    await setup(page);
    await page.goto('/door');
    await expect(page.locator('[data-screen="01"]')).toBeVisible();
    await expect(page.getByTestId('add-to-cart')).toBeVisible();
    await expect(page.getByText("Not sure it's right for you?")).toBeVisible();
    await expect(page.getByText('Rs 329', { exact: true })).toBeVisible();
    // Decisions "AC-01-1 product page order": Add to cart directly under the price, the card below it.
    const y = async (loc: ReturnType<Page['locator']>) => (await loc.boundingBox())!.y;
    const price = await y(page.getByText('Rs 329', { exact: true }));
    const cart = await y(page.getByTestId('add-to-cart'));
    const card = await y(page.getByTestId('door-card'));
    expect(price).toBeLessThan(cart);
    expect(cart).toBeLessThan(card);
    await expect(page.getByText('Concept for Be Bodywise')).toBeVisible();
    // AC-01-2: the card leads to the welcome with the door stored on the session.
    await page.getByTestId('door-card').click();
    await expect(page).toHaveURL(/\/\?src=bodywise-product-page$/);
    await expect.poll(async () => (await eventsNamed(page, 'door_opened')).map((e) => e.channel)).toEqual(['bodywise-product-page']);
  });

  test('AC-02-1..3: welcome facts, one primary, the example link', async ({ page }) => {
    await setup(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Is this roll-on right for you?' })).toBeVisible();
    for (const fact of ['2 minutes', 'No login', 'Skin photos stay on your phone']) await expect(page.getByText(fact, { exact: true })).toBeVisible();
    await expect(page.getByTestId('primary')).toHaveCount(1);
    await expect(page.getByTestId('primary')).toHaveText("Check if it's right for me");
    await expect(page.getByText('Concept for Be Bodywise')).toBeVisible();
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/1$/);
    await expect(page.getByTestId('running-head')).toHaveText('Right Start · 1 of 5');
    await expect.poll(async () => (await eventsNamed(page, 'check_started')).length).toBe(1);
    await page.goto('/');
    await page.getByText('See an example trial').click();
    await expect(page).toHaveURL(/\/example$/);
  });

  test('AC-02-4 and FR-M1-04: a saved plan routes on; box QR with no plan shows the fallback', async ({ page }) => {
    const mock = await setup(page);
    await page.goto('/?src=box-qr');
    await expect(page).toHaveURL(/\/start\?src=box-qr$/);
    await riyaShelf(page, mock);
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    await page.getByTestId('save-plan').click();
    await expect(page).toHaveURL(/\/start$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/start$/); // no Day 0 yet: 06
    await patchPlan(page, { day0: '2026-10-17' });
    await page.goto('/');
    await expect(page).toHaveURL(/\/trial$/); // trial running: 11
  });
});

/* ------------------------------------------------------------------ 03b, 03 */

test.describe('03b and 03 Fit questions', () => {
  test('AC-03b-1..3: shade options, store, advance, and the answer is shown on return', async ({ page }) => {
    await setup(page);
    await page.goto('/check/1');
    await expect(page.getByTestId('running-head')).toHaveText('Right Start · 1 of 5');
    const labels = await page.locator('[data-testid^="option-"]').allInnerTexts();
    expect(labels.map((l) => l.trim())).toEqual(['About the same', 'A little darker', 'Clearly darker', 'Much darker, 3+ shades']);
    await page.getByTestId('option-moderate').click();
    await expect(page).toHaveURL(/\/check\/2$/);
    await page.getByTestId('back').click();
    await expect(page).toHaveURL(/\/check\/1$/);
    await expect(page.getByTestId('option-moderate')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await eventsNamed(page, 'fit_answered')).map((e) => [e.question, e.answer])).toEqual([[1, 'moderate']]);
  });

  test('AC-03-1, 03-2, 03-5: hair removal question, razor hint, no text input', async ({ page }) => {
    await setup(page);
    await page.goto('/check/3');
    await expect(page.getByRole('heading', { name: 'How do you usually remove underarm hair?' })).toBeVisible();
    await expect(page.getByTestId('running-head')).toHaveText('Right Start · 3 of 5');
    await expect(page.locator('[data-testid^="option-"]')).toHaveCount(5);
    await expect(page.locator('input, textarea')).toHaveCount(0);
    await page.getByTestId('option-razor').click();
    await expect(page.getByText('Shaving can darken underarm skin on its own, so this changes how you start.')).toBeVisible();
    await expect(page).toHaveURL(/\/check\/4$/);
  });

  test('AC-03-3 and 03-4: fit_completed with the fit outcome; the hormone pattern is stored as the note', async ({ page }) => {
    const mock = await setup(page);
    await fitCheck(page, { shade: 'mild', duration: 'months', hair: 'razor', neck: 'yes', periods: 'no' });
    await expect.poll(async () => (await eventsNamed(page, 'fit_completed')).length).toBe(1);
    const [done] = await eventsNamed(page, 'fit_completed');
    expect(done).toMatchObject({ fit_outcome: 'good-with-habit', hormone_note: true, neck: 'yes', periods: 'no', shade: 'mild' });
    expect(mock.requests).toBe(0);
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    await expect(page.getByTestId('hormone-note')).toBeVisible();
  });

  test('no hormone note when the neck is not darker', async ({ page }) => {
    await setup(page);
    await fitCheck(page, { shade: 'moderate', duration: 'months', hair: 'laser', neck: 'no', periods: 'no' });
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    await expect(page.getByTestId('hormone-note')).toHaveCount(0);
    await expect(page.getByTestId('your-skin')).toContainText('Your skin: good fit.');
  });

  test('guard: /check/match and /check/shelf/answer without answers go to /check/1', async ({ page }) => {
    await setup(page);
    await page.goto('/check/match');
    await expect(page).toHaveURL(/\/check\/1$/);
    await page.goto('/check/shelf/answer');
    await expect(page).toHaveURL(/\/check\/1$/);
  });
});

/* ------------------------------------------------------------------ 04, 04a, 04b */

test.describe('04 Your shelf, 04a Add a product, 04b Check what we read', () => {
  test('AC-04-1 and 04-4: empty shelf, Add a product visible, the check is enabled', async ({ page }) => {
    await setup(page);
    await fitCheck(page, RIYA);
    await expect(page.getByTestId('running-head')).toHaveText('Right Start · Your shelf');
    await expect(page.getByTestId('add-product')).toBeVisible();
    await expect(page.getByTestId('primary')).toHaveText('Check how they get along');
    await expect(page.getByTestId('primary')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText("Nothing here yet. If you use nothing else, that's fine too.")).toBeVisible();
  });

  test('AC-04a-1: two steps, the Gemini privacy line, no barcode', async ({ page }) => {
    await setup(page);
    await page.goto('/check/shelf/add');
    const steps = page.getByRole('list', { name: 'Photos' });
    await expect(steps).toContainText('Front');
    await expect(steps).toContainText('Ingredients');
    await expect(
      page.getByText("Label photos are read by Google Gemini to get the ingredients. We don't keep them. Photos of your skin never leave your phone."),
    ).toBeVisible();
    await expect(page.getByText(/barcode/i)).toHaveCount(0);
  });

  test('AC-04a-2 and AC-04b-1: a 10-ingredient read shows a loading state, then 10 chips with the glycolic line', async ({ page }) => {
    const mock = await setup(page);
    // The reader's reply is held until the loading state has been seen, so no timing is involved.
    let release!: () => void;
    mock.gate = new Promise<void>((resolve) => (release = resolve));
    await fitCheck(page, RIYA);
    await page.getByTestId('add-product').click();
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await expect(page.getByRole('heading', { name: 'Now the ingredient list' })).toBeVisible();
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await expect(page.getByText('Reading the label…')).toBeVisible();
    await expect(page).toHaveURL(/\/check\/shelf\/add$/);
    release();
    await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
    await expect(page.getByRole('heading', { name: 'Glow 7% Glycolic Toner' })).toBeVisible();
    await expect(page.getByText('Read from your 2 photos · 10 ingredients')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Ingredients' }).getByRole('listitem')).toHaveCount(10);
    await expect(page.locator('[data-active="true"]')).toHaveText('Glycolic Acid');
    await expect(page.getByText('Glycolic acid: an exfoliating acid, like the roll-on')).toBeVisible();
    await expect(page.getByText('Parfum: fragrance')).toBeVisible();
    // The add button stays off until where and when are chosen, and says so.
    await expect(page.getByTestId('confirm-hint')).toHaveText('Pick where and when you use it to add it.');
    await page.getByTestId('chip-underarm').click();
    await expect(page.getByTestId('confirm-hint')).toHaveText('Pick when you use it to add it.');
    await page.getByTestId('chip-night').click();
    await expect(page.getByTestId('confirm-hint')).toHaveCount(0);
  });

  test('AC-04a-3: three ingredients ask for a retake and 04b does not load', async ({ page }) => {
    const mock = await setup(page);
    mock.current = { name: 'Thin label', brand: 'X', ingredients: 'Aqua, Glycerin, Parfum' };
    await page.goto('/check/shelf/add');
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await expect(page.getByText('Hold it flat, closer, in daylight.')).toBeVisible();
    await expect(page).toHaveURL(/\/check\/shelf\/add$/);
  });

  test('AC-04a-4: a failed read offers Try again and Type the name', async ({ page }) => {
    const mock = await setup(page);
    mock.status = 500;
    await page.goto('/check/shelf/add');
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await expect(page.getByText("We couldn't read this label just now.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('try-again')).toHaveText('Try again');
    await expect(page.getByTestId('type-name-error')).toHaveText('Type the name');
  });

  test('AC-04a-5: a Be Bodywise product from the catalog needs no network and shows its ingredients', async ({ page }) => {
    const mock = await setup(page);
    const seen: string[] = [];
    page.on('request', (r: Request) => seen.push(r.url()));
    await page.goto('/check/shelf/add');
    seen.length = 0;
    await page.getByTestId('bodywise-one').click();
    await page.getByTestId('catalog-bw-niacinamide-lotion').click();
    await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
    await expect(page.getByRole('heading', { name: '10% Niacinamide Body Lotion' })).toBeVisible();
    await expect(page.getByText('Niacinamide: a brightener')).toBeVisible();
    expect(mock.requests).toBe(0);
    expect(seen.filter((u) => u.includes('/api/'))).toEqual([]);
  });

  test('AC-04b-2 and 04b-4: add is disabled until a place and a time; an antiperspirant asks sweat or smell first', async ({ page }) => {
    const mock = await setup(page);
    mock.current = FIXTURES.spray;
    await fitCheck(page, RIYA);
    await page.getByTestId('add-product').click();
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
    const add = page.getByTestId('primary');
    await expect(add).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('chip-underarm').click();
    await expect(add).toHaveAttribute('aria-disabled', 'true'); // still no time
    await page.getByTestId('chip-morning').click();
    await expect(add).not.toHaveAttribute('aria-disabled', 'true');
    await add.click();
    await expect(page.getByRole('dialog')).toContainText('Do you use Fresh Bloom Deo Spray to stop sweat, or for smell?');
    await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
    await page.getByTestId('sweat-smell').click();
    await expect(page).toHaveURL(/\/check\/shelf$/);
    await expect(page.getByTestId('shelf-row')).toHaveCount(1);
    await expect.poll(async () => (await eventsNamed(page, 'conditional_answered')).map((e) => [e.question, e.answer])).toEqual([['sweat-or-smell', 'smell']]);
  });

  test('AC-04b-3: an edited word is what gets classified', async ({ page }) => {
    const mock = await setup(page);
    mock.current = { name: 'Plain toner', brand: 'Plain', ingredients: 'Aqua, Glycerin, Panthenol, Phenoxyethanol, Parfum' };
    await fitCheck(page, RIYA);
    await page.getByTestId('add-product').click();
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await page.getByTestId('photo-upload').setInputFiles(photo);
    await expect(page).toHaveURL(/\/check\/shelf\/confirm/);
    await expect(page.getByText('Lactic acid: an exfoliating acid, like the roll-on')).toHaveCount(0);
    await page.getByText("Something's off? Fix a word or retake").click();
    await page.getByLabel('Ingredient 2').fill('Lactic Acid');
    await expect(page.getByText('Lactic acid: an exfoliating acid, like the roll-on')).toBeVisible();
    await page.getByTestId('chip-face').click();
    await page.getByTestId('chip-night').click();
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/shelf$/);
    await expect(page.getByTestId('shelf-row')).toContainText('Lactic acid');
    await expect.poll(async () => (await eventsNamed(page, 'label_read_confirmed')).map((e) => e.edited)).toEqual([true]);
  });

  test('AC-04-3: tapping a row edits where and when, or removes the product', async ({ page }) => {
    await setup(page);
    await fitCheck(page, RIYA);
    await addCatalogProduct(page, 'bw-niacinamide-lotion', { areas: ['body'], time: 'morning' });
    await page.getByTestId('shelf-row').click();
    await page.getByRole('dialog').getByTestId('chip-face').click();
    await page.getByRole('dialog').getByTestId('chip-night').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shelf-row')).toContainText('Body, face · Night');
    await expect
      .poll(async () => (await eventsNamed(page, 'shelf_item_edited')).map((e) => e.field).sort())
      .toEqual(['areas', 'time']);
    await page.getByTestId('shelf-row').click();
    await page.getByTestId('remove-item').click();
    await expect(page.getByTestId('shelf-row')).toHaveCount(0);
    await expect.poll(async () => (await eventsNamed(page, 'shelf_item_removed')).length).toBe(1);
  });
});

/* ------------------------------------------------------------------ 05, 05b, 06: Riya */

test.describe("Riya's worked example, 05, 05b and 06", () => {
  test('AC-04-2, AC-05-1..3, AC-05-6: four rows in order, each naming its product and ingredient', async ({ page }) => {
    const mock = await setup(page);
    await riyaShelf(page, mock);
    const rows = page.getByTestId('shelf-row');
    await expect(rows.nth(0)).toContainText('Glow 7% Glycolic Toner');
    await expect(rows.nth(0)).toContainText('Glycolic acid');
    await expect(rows.nth(0)).toContainText('Face, underarms · Night');
    await expect(rows.nth(1)).toContainText('Underarms · Morning · stung once');
    await expect(rows.nth(3)).toContainText('Niacinamide');
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/shelf\/answer$/);
    await expect(page.getByTestId('running-head')).toHaveText('Right Start · Your shelf');
    await expect(page.getByRole('heading', { name: 'One swap, two habits.' })).toBeVisible();
    const answer = page.getByTestId('answer-row');
    await expect(answer).toHaveCount(4);
    const expected: Array<[string, string, string]> = [
      ['Pick one here', 'Glow 7% Glycolic Toner', 'glycolic'],
      ['Different times', 'Fresh Bloom Deo Spray', 'alcohol'],
      ['Leave a gap', 'Silk Hair Removal Cream', 'Thioglycolate'],
      ['Fine together', '10% Niacinamide Body Lotion', 'Niacinamide'],
    ];
    for (const [i, [label, product, ingredient]] of expected.entries()) {
      await expect(answer.nth(i)).toContainText(label);
      await expect(answer.nth(i)).toContainText(product);
      await expect(answer.nth(i).locator('b').first()).toContainText(ingredient);
    }
    await expect(answer.nth(1)).not.toContainText(/\d+\s*hours?/i); // AC-05-3
    await expect(page.getByTestId('placeholder-rules')).toHaveText('Placeholder rules, to be signed by a dermatologist.');
    await expect(page.getByTestId('primary')).toHaveText('See your best Be Bodywise match');
    await expect.poll(async () => (await eventsNamed(page, 'shelf_checked')).length).toBe(1);
    const [checked] = await eventsNamed(page, 'shelf_checked');
    expect(checked).toMatchObject({ item_count: 4, n_fine: 1, n_split_time: 1, n_pick_one: 1, n_wait: 1, n_stop_ask: 0 });
  });

  test('AC-05b-1..3: 4% No Fragrance, cost strip, list price, four other products', async ({ page }) => {
    const mock = await setup(page);
    await riyaShelf(page, mock);
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/match$/);
    await expect(page.getByTestId('running-head')).toHaveText('Right Start · Your match');
    await expect(page.getByRole('heading', { name: 'Start gentle. Step up later.' })).toBeVisible();
    await expect(page.getByTestId('best-name')).toHaveText('4% AHA BHA Underarm Roll On');
    await expect(page.getByTestId('best-meta')).toHaveText(/No Fragrance · 50 ml · Rs\s329/);
    const card = page.getByTestId('best-card');
    await expect(card).toContainText('Best');
    await expect(card.getByRole('listitem')).toHaveCount(3);
    await expect(card).toContainText('Clearly darker, not 3+ shades: a roll-on is enough.');
    await expect(card).toContainText('stung you once, so: gentler acids, no fragrance.');
    await expect(card).toContainText('You use hair removal cream, which leaves skin sensitive.');
    const strip = page.getByTestId('cost-strip');
    await expect(strip).toContainText('8 weeks to judge');
    await expect(strip).toContainText('2 bottles');
    await expect(strip).toContainText('Rs 658 to know');
    await expect(page.getByText('At the Bodywise list price of Rs 329.', { exact: false })).toBeVisible();
    const range = page.getByTestId('range-row');
    await expect(range).toHaveCount(4);
    const expectedRange: Array<[string, string]> = [
      ['6% AHA BHA Roll On', 'Rs 399'],
      ['Underarm Pigmentation Kit', 'Rs 799'],
      ['Pigmentation Repair Cream', 'Rs 549'],
      ['Advanced Underarm Pigmentation Kit', 'Rs 859'],
    ];
    for (const [i, [name, price]] of expectedRange.entries()) {
      await expect(range.nth(i)).toContainText(name);
      await expect(range.nth(i)).toContainText(price);
    }
    await expect(page.getByTestId('your-skin')).toContainText('Your skin: good fit, and one habit will make it work better.');
    await expect(page.getByTestId('your-skin')).toContainText('Shaved? Wait 10-15 minutes before the roll-on. If it stings, use it at night instead.');
    await expect(page.getByTestId('placeholder-rules')).toBeVisible();
    await expect.poll(async () => (await eventsNamed(page, 'pick_shown')).length).toBeGreaterThan(0);
    const [shown] = await eventsNamed(page, 'pick_shown');
    expect(shown).toMatchObject({ product_id: 'bw-rollon-4', variant: 'no-fragrance', rule_row: 8, base_row: 8, hormone_note: false });
  });

  test('AC-05b-6: Buy on Be Bodywise opens a new tab on the catalog URL and logs buy_clicked', async ({ page, context }) => {
    const mock = await setup(page);
    await riyaShelf(page, mock);
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    const buy = page.getByTestId('primary');
    await expect(buy).toHaveAttribute('href', 'https://bebodywise.com/product/4-aha-bha-underarm-roll-on');
    await expect(buy).toHaveAttribute('target', '_blank');
    const popup = context.waitForEvent('page');
    await buy.click();
    await (await popup).close();
    await expect.poll(async () => (await eventsNamed(page, 'buy_clicked')).map((e) => [e.store, e.product_id])).toEqual([['bodywise', 'bw-rollon-4']]);
    await expect(page.getByTestId('amazon')).toHaveAttribute('href', /^https:\/\/www\.amazon\.in\/s\?k=/);
    await expect(page.getByTestId('amazon')).not.toHaveAttribute('href', /tag=/);
  });

  test('AC-05b-7, AC-06-1, 06-2, 06-4: Save my plan stores FT-code, then 06 shows her cast', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-14T10:00:00'));
    const mock = await setup(page);
    await riyaShelf(page, mock);
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    await page.getByTestId('save-plan').click();
    await expect(page).toHaveURL(/\/start$/);
    const plan = await savedPlan(page);
    expect(plan?.planCode).toMatch(/^FT-[A-HJ-NP-Z2-9]{4}$/);
    await expect(page.getByTestId('plan-code')).toHaveText(plan?.planCode as string);
    await expect(page.getByRole('heading', { name: 'Your plan from 14 October is ready.' })).toBeVisible();
    await expect(page.getByTestId('running-head')).toHaveText('Right Start · Day 0');
    const cast = page.getByTestId('cast-card');
    await expect(cast).toHaveCount(5);
    await expect(cast.nth(0)).toContainText('Roll-on');
    await expect(cast.nth(0)).toContainText('New arrival');
    await expect(cast.nth(1)).toContainText('Toner');
    await expect(cast.nth(1)).toContainText('Face only');
    await expect(cast.nth(2)).toContainText('Mornings only');
    await expect(cast.nth(3)).toContainText('2 days apart');
    await expect(cast.nth(4)).toContainText('Fine together');
    await expect(page.getByText('Next, about 5 minutes')).toBeVisible();
    await expect(page.getByTestId('primary')).toHaveText('Start my plan');
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/start\/routine$/);
    await expect.poll(async () => (await eventsNamed(page, 'plan_saved')).length).toBe(1);
    await expect.poll(async () => (await eventsNamed(page, 'plan_opened')).map((e) => e.source)).toEqual(['saved']);
    // The saved plan carries what the routine needs (E5 reads it).
    expect((plan?.pick as { pick: string }).pick).toBe('bw-rollon-4');
    expect((plan?.startPlan as { keepApart: unknown[] }).keepApart).toHaveLength(2);
  });

  test('AC-06-3: a box QR with no plan offers the 2-minute check', async ({ page }) => {
    await setup(page);
    await page.goto('/start?src=box-qr');
    await expect(page.getByTestId('primary')).toHaveText("Didn't do the check? It takes 2 minutes");
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/1$/);
  });
});

/* ------------------------------------------------------------------ pick variants */

test.describe('05 and 05b variants', () => {
  test('AC-05-5 and AC-05b-8: a steroid on underarms is listed first, the doctor link leads, buy still works', async ({ page }) => {
    await setup(page);
    await fitCheck(page, RIYA);
    await addCatalogProduct(page, 'bw-niacinamide-lotion', { areas: ['body'], time: 'morning' });
    await addTypedProduct(page, 'Derma steroid cream', 'Aqua, Mometasone Furoate, Glycerin, Cetyl Alcohol, Paraffin', { areas: ['underarm'], time: 'night' });
    await page.getByTestId('primary').click();
    const rows = page.getByTestId('answer-row');
    await expect(rows.nth(0)).toContainText('Stop and ask a doctor');
    await expect(rows.nth(0)).toContainText('Derma steroid cream');
    await expect(page.getByTestId('doctor-link')).toHaveText('Talk to the Bodywise in-app doctor');
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/match$/);
    await expect(page.getByRole('heading', { name: 'Sort this first.' })).toBeVisible();
    await expect(page.getByTestId('best-card')).toHaveCount(0);
    await expect(page.getByText('Derma steroid cream should be stopped on your underarms before any acid. You can still buy now.')).toBeVisible();
    await expect(page.getByTestId('range-row').first()).toContainText("After you've stopped Derma steroid cream.");
    const doctor = page.getByTestId('doctor-link');
    await expect(doctor).toHaveAttribute('href', 'https://bebodywise.com/schedule-appointment');
    const buy = page.getByTestId('primary');
    await expect(buy).toBeEnabled();
    const doctorY = (await doctor.boundingBox())?.y ?? 0;
    const firstRangeY = (await page.getByTestId('range-row').first().boundingBox())?.y ?? 0;
    expect(doctorY).toBeLessThan(firstRangeY);
  });

  test('AC-05b-4: shade severe asks the pregnancy question first; Prefer not to say gives the 4% No Fragrance', async ({ page }) => {
    await setup(page);
    await fitCheck(page, { shade: 'severe', duration: 'always', hair: 'none', neck: 'no', periods: 'yes' });
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Are you pregnant, trying, or breastfeeding?');
    await expect(sheet).toContainText('Asked only because this option has retinol.');
    await sheet.getByTestId('pregnancy-prefer-not').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('best-name')).toHaveText('4% AHA BHA Underarm Roll On');
    await expect(page.getByTestId('best-meta')).toContainText('No Fragrance');
    await expect(page.getByTestId('range-row').filter({ hasText: 'Underarm Pigmentation Kit' }).first()).toContainText('Has retinol. Ask a doctor first.');
    await expect.poll(async () => (await eventsNamed(page, 'conditional_answered')).map((e) => [e.question, e.answer])).toEqual([['pregnancy', 'prefer-not']]);
  });

  test('AC-05b-9: shade "about the same" says you may not need it, lists the range, keeps buy enabled', async ({ page }) => {
    await setup(page);
    await fitCheck(page, { shade: 'same', duration: 'months', hair: 'none', neck: 'no', periods: 'yes' });
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    await expect(page.getByRole('heading', { name: 'For darkness, you may not need it.' })).toBeVisible();
    await expect(page.getByText('If smell is the reason, the 4% roll-on works as a deodorant.')).toBeVisible();
    await expect(page.getByTestId('best-card')).toHaveCount(0);
    await expect(page.getByTestId('range-row')).toHaveCount(5);
    await expect(page.getByTestId('primary')).toHaveAttribute('href', /bebodywise\.com/);
  });

  test('AC-05b-5: the hormone note is one collapsed line that opens, with the doctor link, and never blocks buying', async ({ page }) => {
    await setup(page);
    await fitCheck(page, { shade: 'moderate', duration: 'year-plus', hair: 'none', neck: 'yes', periods: 'no' });
    await page.getByTestId('primary').click();
    await page.getByTestId('primary').click();
    const note = page.getByTestId('hormone-note');
    await expect(note).toHaveText('One thing worth knowing about your neck and periods');
    await expect(note).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('hormone-body')).toHaveCount(0);
    await expect(page.getByTestId('primary')).toBeEnabled();
    await note.click();
    await expect(note).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('hormone-body')).toContainText('insulin resistance or PCOS');
    await expect(page.getByTestId('hormone-body').getByTestId('doctor-link')).toHaveText('Talk to the Bodywise in-app doctor');
    await expect.poll(async () => (await eventsNamed(page, 'hormone_note_expanded')).length).toBe(1);
  });
});

/* ------------------------------------------------------------------ global rules */

test.describe('global rules on the Right Start screens', () => {
  test('AC-G-1: no horizontal scroll and 44 px targets on every screen of the path', async ({ page }) => {
    const mock = await setup(page);
    await riyaShelf(page, mock);
    const routes = ['/door', '/', '/check/1', '/check/3', '/check/shelf', '/check/shelf/add', '/check/shelf/answer', '/check/match'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForSelector('[data-screen]');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} scrolls sideways`).toBeLessThanOrEqual(0);
      const small = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('button, a[href], [role="checkbox"]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.closest('[data-testid="photo-upload"]')) continue;
          if (r.width < 43.5 || r.height < 43.5) bad.push(`${el.tagName} ${el.textContent?.trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return bad;
      });
      expect(small, `${route} has small targets`).toEqual([]);
    }
  });

  test('AC-G-2 and G-4: no image leaves the phone but label reads; no forbidden words', async ({ page }) => {
    const mock = await setup(page);
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && !r.url().includes('/api/read-label')) posts.push(r.url());
    });
    await riyaShelf(page, mock);
    const forbidden = [/you have/i, /diagnos/i, /!/, /₹/, /streak/i, /coins/i, /discount/i];
    for (const route of ['/', '/check/1', '/check/shelf', '/check/shelf/add', '/check/shelf/answer', '/check/match', '/start']) {
      await page.goto(route);
      await page.waitForSelector('[data-screen]');
      const text = await page.locator('[data-screen]').innerText();
      for (const bad of forbidden) expect(text, `${route} contains ${bad}`).not.toMatch(bad);
      expect(text).not.toMatch(/add to cart/i);
      expect(await page.locator('input[type="email"], input[type="tel"], input[name*="phone" i], input[name*="email" i]').count()).toBe(0);
    }
    expect(posts).toEqual([]);
    expect(mock.requests).toBeGreaterThan(0);
  });

  test('the event log holds no names, phone numbers, free text or photo data', async ({ page }) => {
    const mock = await setup(page);
    await riyaShelf(page, mock);
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/shelf\/answer$/);
    await page.getByTestId('primary').click();
    await expect(page).toHaveURL(/\/check\/match$/);
    await page.getByTestId('save-plan').click();
    await expect(page).toHaveURL(/\/start$/);
    // Events are written fire-and-forget: wait until the last one of the path is in the log, then read it all.
    await expect.poll(async () => (await eventsNamed(page, 'plan_saved')).length).toBe(1);
    expect((await readEvents(page)).length).toBeGreaterThan(20);
    const json = JSON.stringify(await readEvents(page));
    expect(json).not.toMatch(/Glow|Fresh Bloom|Silk|Niacinamide Body/i); // other brands' names stay out of events
    expect(json).not.toMatch(/data:image|base64/i);
  });
});
