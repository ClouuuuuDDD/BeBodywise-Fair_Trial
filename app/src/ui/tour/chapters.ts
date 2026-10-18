/** Guided demo chapters: where each one starts, and the card shown when she first reaches it. */
import type { ChapterId } from '../../state/tour';
import type { DrMehrPose } from '../art';

export interface Chapter {
  id: ChapterId;
  /** "Chapter 2 of 5". */
  label: string;
  /** Short name for the demo bar. */
  short: string;
  title: string;
  /** What goes wrong for her today, without the app. */
  problem: string;
  /** What this part of the app does about it. */
  solves: string;
  /** What to try in this chapter. */
  tryThis: string;
  /** Opening line, used from chapter 2 on to close the previous chapter. */
  bridge?: string;
  pose: DrMehrPose;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'before',
    label: 'Chapter 1 of 5',
    short: 'Before she buys',
    title: 'Before she buys',
    problem: 'She sees an underarm roll-on on Amazon or Instagram and guesses: which strength, and will it clash with her deo or hair removal cream?',
    solves: 'Right Start asks how dark it is next to her inner arm, reads the labels on what she already uses, and picks the Bodywise product that fits, even when the cheaper one is enough.',
    tryThis: 'Answer as yourself. On "Your shelf", add a product by photographing its front and its ingredient list.',
    pose: 'wave',
  },
  {
    id: 'arrives',
    label: 'Chapter 2 of 5',
    short: 'The day it arrives',
    bridge: 'That was the pre-purchase journey.',
    title: 'Now she has bought it',
    problem: 'Day one is where trials go wrong: the wrong time of day, a sting after shaving, and no "before" to compare with later.',
    solves: 'She scans the QR in the box. She gets a routine built around her own shelf, a starting photo of her underarm next to her inner arm, and a fair date to judge by.',
    tryThis: 'Take or upload the two starting photos. Keep the white paper in the corner, and look at your judge-by date and what it costs to know.',
    pose: 'camera',
  },
  {
    id: 'using',
    label: 'Chapter 3 of 5',
    short: 'While she uses it',
    bridge: 'Her trial has started.',
    title: 'The 8 weeks of use',
    problem: 'The middle is where people quit: nothing visible by week 3, a sting with no one to ask, a bottle running out before the answer.',
    solves: 'One quiet home screen: days of use, one next step, and "Something feels off" for any reaction. The halfway photo and a refill reminder arrive on their own days.',
    tryThis: 'In real life you would wait. Use the day buttons in the bar above to skip ahead: try Day 9 and tap "Something feels off", then Day 28 (halfway photo), Day 40 (bottle running low) and Day 56 (verdict).',
    pose: 'calendar',
  },
  {
    id: 'verdict',
    label: 'Chapter 4 of 5',
    short: 'The verdict',
    bridge: 'It is her judge-by date.',
    title: 'A fair answer',
    problem: 'Today she judges by looking in the mirror under different light, and "maybe a bit lighter?" turns into a guess.',
    solves: 'The same two photos, corrected by the white paper and measured against her own inner arm, plus a blind pick she makes without knowing which photo is which. The answer can be "Working", "Not yet", or "Not for you".',
    tryThis: 'Upload a lighter photo to see "Working", or the same photo again to see "Not for you".',
    pose: 'clipboard',
  },
  {
    id: 'after',
    label: 'Chapter 5 of 5',
    short: 'After the verdict',
    bridge: 'She has her answer.',
    title: 'Keep going, or stop well',
    problem: 'Today she reorders on a guess or quietly stops, and nobody learns why.',
    solves: 'If it works, her plan carries on with a check every 8 weeks. If not, she stops without blame, with a clear next step: a stronger option, a different product, or a doctor. She chooses whether to share an anonymous result.',
    tryThis: 'Choose whether to share, then see where she lands. The last stop is what Bodywise learns.',
    pose: 'proud',
  },
  {
    id: 'bodywise',
    label: 'For Be Bodywise',
    short: 'What Bodywise learns',
    bridge: 'That was her whole journey.',
    title: 'What Bodywise learns',
    problem: 'Bodywise sees sales and star ratings, but not whether a product worked, for whom, or why people stop, especially for marketplace buyers.',
    solves: 'Opted-in, anonymous results: which shelves clash, which picks work at which darkness, and why trials end. Groups under 50 are hidden.',
    tryThis: 'This screen uses sample data.',
    pose: 'clipboard',
  },
];

export function chapterById(id: ChapterId): Chapter {
  return CHAPTERS.find((c) => c.id === id)!;
}

/** The chapter a route belongs to. `settled` = a verdict exists or she stopped (the home screen is then "after"). */
export function chapterForPath(path: string, settled: boolean): ChapterId | undefined {
  if (path === '/insights') return 'bodywise';
  if (path === '/keep' || path === '/verdict/share') return 'after';
  if (path.startsWith('/verdict')) return 'verdict';
  if (path === '/trial' || path === '/help' || path === '/help/answer' || path === '/file' || path === '/trial/halfway') return settled ? 'after' : 'using';
  if (path === '/start' || path.startsWith('/start/')) return 'arrives';
  if (path.startsWith('/check') || path === '/door') return 'before';
  return undefined;
}
