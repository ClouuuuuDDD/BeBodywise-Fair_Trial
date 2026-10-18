/**
 * Cameras with a real (fake-device) stream: the preview is live in the box and the shutter captures.
 * Regression: the label camera mounted its <video> only after "live", so the stream was never attached
 * (black box, dead shutter); the skin camera hid its <video> with display:none while starting.
 */
import { expect, test, type Page } from '@playwright/test';

test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['camera'],
});

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390', 'one project is enough');
});

async function preview(page: Page) {
  return page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? { stream: !!v.srcObject, width: v.videoWidth, playing: !v.paused, opacity: getComputedStyle(v).opacity } : null;
  });
}

test('label camera: live preview in the box, the shutter takes the front photo', async ({ page }) => {
  await page.goto('/check/shelf/add');
  await expect.poll(async () => (await preview(page))?.width ?? 0).toBeGreaterThan(0);
  expect(await preview(page)).toMatchObject({ stream: true, playing: true, opacity: '1' });
  await page.getByTestId('shutter').click();
  await expect(page.getByRole('heading', { name: 'Now the ingredient list' })).toBeVisible();
});

test('skin camera: live preview after "Take photo", then a capture is measured', async ({ page }) => {
  const tid = (id: string) => page.getByTestId(id);
  await page.goto('/check/1');
  const answers: Array<[string, RegExp]> = [
    ['moderate', /check\/2$/],
    ['year-plus', /check\/3$/],
    ['razor', /check\/4$/],
    ['no', /check\/5$/],
    ['yes', /check\/shelf$/],
  ];
  for (const [o, next] of answers) {
    await tid(`option-${o}`).click();
    await page.waitForURL(next);
  }
  await tid('primary').click();
  await page.waitForURL(/shelf\/answer/);
  await tid('primary').click();
  await page.waitForURL(/check\/match/);
  await tid('save-plan').click();
  await page.waitForURL(/\/start$/);
  await tid('primary').click();
  await page.waitForURL(/routine/);
  await tid('primary').click();
  await page.waitForURL(/start\/photo/);

  await tid('primary').click(); // starts the camera
  await expect.poll(async () => (await preview(page))?.width ?? 0).toBeGreaterThan(0);
  expect(await preview(page)).toMatchObject({ stream: true, playing: true, opacity: '1' });
  await tid('primary').click(); // takes the burst
  // The fake feed is a test pattern (no skin, no white card), so the quality gate asks for a retake: proof it was measured.
  await expect(tid('photo-fail')).toBeVisible();
});

test.describe('in an app\'s built-in browser (play only from a tap)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Instagram 350.0' });

  test('label camera: a frozen preview offers "Tap to start the camera", then the shutter works', async ({ page }) => {
    await page.addInitScript(() => {
      // Like an Android WebView with mediaPlaybackRequiresUserGesture: play() only within a tap on the page.
      let tappedAt = -1e9;
      addEventListener('pointerdown', () => (tappedAt = performance.now()), true);
      const real = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (performance.now() - tappedAt > 1000) return Promise.reject(new DOMException('needs a tap', 'NotAllowedError'));
        return real.call(this);
      };
      new MutationObserver(() => document.querySelectorAll('video[autoplay]').forEach((v) => v.removeAttribute('autoplay'))).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['autoplay'] });
    });
    await page.goto('/check/shelf/add');
    // The fake camera can take a few seconds to warm up on a cold start.
    await expect(page.getByTestId('camera-tap-start')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Camera not working? Open this page in Chrome.')).toBeVisible();
    await page.getByTestId('camera-tap-start').click();
    await expect.poll(async () => (await preview(page))?.playing).toBe(true);
    await expect(page.getByTestId('camera-tap-start')).toHaveCount(0);
    await page.getByTestId('shutter').click();
    await expect(page.getByRole('heading', { name: 'Now the ingredient list' })).toBeVisible();
  });
});

test('upload fallback: "Upload a photo" opens a picker that allows the gallery, on both photo screens', async ({ page }) => {
  const tid = (id: string) => page.getByTestId(id);
  const label = await import('node:fs').then((fs) => fs.readFileSync('e2e/fixtures/label-test.jpg'));
  await page.goto('/check/shelf/add');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tid('upload-photo').click()]);
  // No `capture` attribute: the phone offers the gallery and files, not only the camera.
  expect(await chooser.element().evaluate((e) => e.hasAttribute('capture'))).toBe(false);
  await chooser.setFiles({ name: 'label.jpg', mimeType: 'image/jpeg', buffer: label });
  await expect(page.getByRole('heading', { name: 'Now the ingredient list' })).toBeVisible();

  await page.goto('/check/1');
  for (const [o, next] of [['moderate', /check\/2$/], ['year-plus', /check\/3$/], ['razor', /check\/4$/], ['no', /check\/5$/], ['yes', /check\/shelf$/]] as const) {
    await tid(`option-${o}`).click();
    await page.waitForURL(next);
  }
  await tid('primary').click();
  await page.waitForURL(/shelf\/answer/);
  await tid('primary').click();
  await page.waitForURL(/check\/match/);
  await tid('save-plan').click();
  await page.waitForURL(/\/start$/);
  await tid('primary').click();
  await page.waitForURL(/routine/);
  await tid('primary').click();
  await page.waitForURL(/start\/photo/);
  const [skin] = await Promise.all([page.waitForEvent('filechooser'), tid('upload-photo').click()]);
  expect(await skin.element().evaluate((e) => e.hasAttribute('capture'))).toBe(false);
  await skin.setFiles({ name: 'u.jpg', mimeType: 'image/jpeg', buffer: label });
  // A label is not skin: it is measured and sent back for a retake, which proves the upload went through.
  await expect(tid('photo-fail')).toBeVisible();
});
