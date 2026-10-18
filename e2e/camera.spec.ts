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
