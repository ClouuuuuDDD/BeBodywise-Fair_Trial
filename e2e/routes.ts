/**
 * Shared by the QA specs (E7): every route a person can reach, with the state it needs.
 * Example-mode screens are reached with /example?jump=<key>, which seeds Riya's trial and survives a
 * full page load (sessionStorage), so a plain page.goto(path) afterwards shows the screen filled in.
 */
import { expect, type Page } from '@playwright/test';

export interface Target {
  /** Short name used in test titles and screenshot file names. */
  name: string;
  /** Screen number, as in SCREENS.md. */
  screen: string;
  /** Path to open. */
  path: string;
  /** Example jump key to seed first (null: open the path on a clean browser). */
  jump: string | null;
  /** Taps needed to reach the screen from `path` (screens that only exist after an action). */
  act?: (page: Page) => Promise<void>;
}

/** Blocks every non-local host (fonts, calendar, CDNs) so nothing waits on the network. */
export async function blockExternal(page: Page): Promise<void> {
  await page.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname), (route) => route.abort());
}

/** Opens a target: seeds the example if needed, then loads the path and waits for the screen. */
export async function openTarget(page: Page, t: Target): Promise<void> {
  if (t.jump) {
    await page.goto(`/example?jump=${t.jump}`);
    await page.waitForURL((u) => u.pathname !== '/example');
    if (new URL(page.url()).pathname !== t.path) await page.goto(t.path);
  } else {
    await page.goto(t.path);
  }
  await t.act?.(page);
  await expect(page.locator('[data-screen]').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Every screen, in SCREENS.md order. Live (no state) where the screen allows it, otherwise through the example. */
export const TARGETS: Target[] = [
  { name: '01-door', screen: '01', path: '/door', jump: null },
  { name: '02-welcome', screen: '02', path: '/', jump: null },
  { name: '03b-shade', screen: '03b', path: '/check/1', jump: null },
  { name: '03-fit-2', screen: '03', path: '/check/2', jump: null },
  { name: '03-fit-5', screen: '03', path: '/check/5', jump: null },
  { name: '04-shelf-empty', screen: '04', path: '/check/shelf', jump: null },
  { name: '04a-add', screen: '04a', path: '/check/shelf/add', jump: null },
  { name: '04-shelf-riya', screen: '04', path: '/check/shelf', jump: 'check' },
  { name: '05-answers', screen: '05', path: '/check/shelf/answer', jump: 'check' },
  { name: '05b-match', screen: '05b', path: '/check/match', jump: 'check' },
  { name: '06-plan', screen: '06', path: '/start', jump: 'day-0' },
  { name: '07-routine', screen: '07', path: '/start/routine', jump: 'day-0' },
  { name: '08-photo', screen: '08', path: '/start/photo', jump: 'day-0' },
  { name: '10-date', screen: '10', path: '/start/date', jump: 'day-0' },
  { name: '11-home-day23', screen: '11', path: '/trial', jump: 'day-23' },
  { name: '12-feels-off', screen: '12', path: '/help', jump: 'day-9' },
  {
    name: '13-reaction-answer',
    screen: '13',
    path: '/help',
    jump: 'day-9',
    act: async (page) => {
      await page.getByTestId('primary').click();
      await expect(page).toHaveURL(/\/help\/answer$/);
    },
  },
  {
    name: '09-photo-check',
    screen: '09',
    path: '/start/photo',
    jump: 'day-0',
    act: async (page) => {
      await page.getByTestId('primary').click(); // staged example shot, underarm
      await page.waitForURL(/site=inner-arm/);
      await page.getByTestId('primary').click(); // inner arm
      await expect(page).toHaveURL(/\/start\/photo\/check$/);
    },
  },
  { name: '14-bottle', screen: '14', path: '/trial', jump: 'day-40' },
  { name: '15-skin-file', screen: '15', path: '/file', jump: 'day-23' },
  { name: '16-blind-pick', screen: '16', path: '/verdict/pick', jump: 'day-56-working' },
  { name: '17-working', screen: '17', path: '/verdict', jump: 'day-56-working' },
  { name: '18-not-for-you', screen: '18', path: '/verdict', jump: 'day-56-not-for-you' },
  { name: '18-not-yet', screen: '18', path: '/verdict', jump: 'not-yet' },
  { name: '18-cant-call', screen: '18', path: '/verdict', jump: 'cant-call' },
  { name: '18-see-doctor', screen: '18', path: '/verdict', jump: 'see-doctor' },
  { name: '19-share', screen: '19', path: '/verdict/share', jump: 'day-56-working' },
  { name: '20-keep-going', screen: '20', path: '/keep', jump: 'keep-going' },
  { name: '21-insights', screen: '21', path: '/insights', jump: 'insights' },
  { name: '22-example', screen: '22', path: '/example', jump: null },
  { name: '404', screen: '404', path: '/no-such-page', jump: null },
  { name: 'lab-kill-test', screen: 'lab', path: '/lab/kill-test', jump: null },
];
