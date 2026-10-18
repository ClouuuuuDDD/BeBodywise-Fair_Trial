/** Right Start strings, verbatim from engineering/handoff/copy.md. Owner: E4. Keys in the comments are the copy.md keys. */
import type { ShelfAnswerKind } from '../../contracts';

export const door = {
  pageLabel: 'Product page', // s01.pageLabel
  product: '4% AHA BHA Underarm Roll-on',
  sub: 'For underarm odour and pigmentation · 50 ml',
  price: 'Rs 329',
  cardTitle: "Not sure it's right for you?",
  cardBody: "Take Dr. Mehr's 2-minute check. No login.",
  note: 'The same card sits on the Amazon listing and on any link shared in a thread.',
  addToCart: 'Add to cart',
} as const;

export const welcome = {
  title: 'Is this roll-on right for you?',
  lead: "I'm Dr. Mehr. Five quick questions and you'll know.",
  cardPlate: 'Roll-on',
  cardChip1: 'New arrival',
  cardChip2: 'Works the night shift',
  fact1: '2 minutes',
  fact2: 'No login',
  fact3: 'Skin photos stay on your phone',
  primary: "Check if it's right for me",
  secondary: 'See an example trial',
  demo: 'Try the whole journey yourself (guided demo)',
} as const;

export interface FitQuestionCopy {
  title: string;
  hint?: string;
  bubble?: string;
  answers: { value: string; label: string }[];
}

/** fit.q1 ... fit.q5, in screen order. */
export const fitQuestions: Record<1 | 2 | 3 | 4 | 5, FitQuestionCopy> = {
  1: {
    title: 'Next to your inner arm, your underarm looks…',
    hint: 'Lift your arm in daylight and look at both.',
    bubble: 'Your inner arm is your own baseline. This decides which Be Bodywise option fits, not just whether one does.',
    answers: [
      { value: 'same', label: 'About the same' },
      { value: 'mild', label: 'A little darker' },
      { value: 'moderate', label: 'Clearly darker' },
      { value: 'severe', label: 'Much darker, 3+ shades' },
    ],
  },
  2: {
    title: 'How long has the darkness been there?',
    answers: [
      { value: 'months', label: 'Months' },
      { value: 'year-plus', label: 'A year or more' },
      { value: 'always', label: 'As long as I remember' },
    ],
  },
  3: {
    title: 'How do you usually remove underarm hair?',
    bubble: 'Shaving can darken underarm skin on its own, so this changes how you start.',
    answers: [
      { value: 'razor', label: 'Razor' },
      { value: 'wax', label: 'Wax' },
      { value: 'cream', label: 'Hair removal cream' },
      { value: 'laser', label: 'Laser' },
      { value: 'none', label: "I don't remove it" },
    ],
  },
  4: {
    title: 'Is the skin on the back of your neck darker too?',
    answers: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'not-sure', label: 'Not sure' },
    ],
  },
  5: {
    title: 'Are your periods usually regular?',
    bubble: "I ask because it can change what's worth checking. It never stops you buying.",
    answers: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'prefer-not', label: "Not sure, or I'd rather not say" },
    ],
  },
};

export const shelf = {
  runningHead: 'Right Start · Your shelf',
  title: "What's on your shelf?",
  lead: 'Add what you use on your body, any brand. We read the labels.',
  empty: "Nothing here yet. If you use nothing else, that's fine too.",
  stungNote: ' · stung once',
  add: 'Add a product',
  primary: 'Check how they get along',
  edit: 'Edit where and when',
  remove: 'Remove from my shelf',
} as const;

export const add = {
  runningHead: 'Add a product',
  titleFront: 'First, the front of the bottle',
  titleIngredients: 'Now the ingredient list',
  step1: 'Front',
  step2: 'Ingredients',
  tipFront: 'So we can read the name.',
  tipIngredients: 'Get the small print inside the box. Flat, close and in daylight works best.',
  captured: 'Got it. Hold still.',
  take: 'Take photo',
  reading: 'Reading the label…',
  retake: 'Hold it flat, closer, in daylight.',
  error: "We couldn't read this label just now.",
  errorTry: 'Try again',
  cancel: 'Cancel',
  denied: 'Camera not available. Choose a photo instead.',
  tapToStart: 'Tap to start the camera',
  upload: 'Upload a photo',
  inApp: 'Camera not working? Open this page in Chrome.',
  typeName: 'Type the name',
  typeNameField: 'Product name',
  typeIngredients: 'Paste or type the ingredient list',
  bodywise: 'A Be Bodywise one',
  /** G1-4 privacy line shown on 04a (s04a.privacy). */
  privacy: "We don't keep label photos. Photos of your skin never leave your phone.",
  /** G1-4 full line, shown once beside the camera as the Gemini disclosure. */
  geminiPrivacy:
    "Label photos are read by Google Gemini to get the ingredients. We don't keep them. Photos of your skin never leave your phone.",
} as const;

export const confirm = {
  runningHead: 'Check what we read',
  where: 'Where do you use it?',
  when: 'When?',
  whereOptions: [
    { value: 'face', label: 'Face' },
    { value: 'underarm', label: 'Underarms' },
    { value: 'body', label: 'Body' },
    { value: 'neck', label: 'Neck' },
  ],
  whenOptions: [
    { value: 'morning', label: 'Morning' },
    { value: 'night', label: 'Night' },
    { value: 'both', label: 'Both' },
    { value: 'now-and-then', label: 'Now and then' },
  ],
  stung: 'This has stung me',
  primary: 'Looks right, add to my shelf',
  secondary: "Something's off? Fix a word or retake",
  needBoth: 'Pick where and when you use it to add it.',
  needWhere: 'Pick where you use it to add it.',
  needWhen: 'Pick when you use it to add it.',
  sweatOrSmell: (product: string) => `Do you use ${product} to stop sweat, or for smell?`,
  sweat: 'Sweat',
  smell: 'Smell',
  both: 'Both',
} as const;

export const answers = {
  runningHead: 'Right Start · Your shelf',
  allFine: 'All fine together.',
  none: 'Nothing else on your shelf. Simple start.',
  lead: "Checked ingredient by ingredient against Be Bodywise's underarm acids.",
  primary: 'See your best Be Bodywise match',
  label: {
    fine: 'Fine together',
    'split-time': 'Different times',
    'pick-one': 'Pick one here',
    wait: 'Leave a gap',
    'stop-ask': 'Stop and ask a doctor',
  } satisfies Record<ShelfAnswerKind, string>,
} as const;

export const match = {
  runningHead: 'Right Start · Your match',
  best: 'Best for you',
  costWeeks: '8 weeks to judge',
  costBottles: '2 bottles',
  costKits: '2 kits',
  yourSkinGood: "Your skin: good fit. Here's how to start.",
  yourSkinHabit: 'Your skin: good fit, and one habit will make it work better.',
  hormoneCollapsed: 'One thing worth knowing about your neck and periods',
  hormoneBody:
    "Darker underarms and neck together can sometimes be linked to hormones, such as insulin resistance or PCOS. A roll-on can't fix that. If it doesn't help by your judge-by date, that's worth asking a doctor about.",
  doctor: 'Talk to the Bodywise in-app doctor',
  othersTitle: 'Also in the range, and why not now',
  pregnancyQ: 'Are you pregnant, trying, or breastfeeding?',
  pregnancyWhy: 'Asked only because this option has retinol.',
  pregnancyYes: 'Yes',
  pregnancyNo: 'No',
  pregnancyPreferNot: 'Prefer not to say',
  stopFirst: (product: string) =>
    `Sort this first. ${product} should be stopped on your underarms before any acid. You can still buy now.`,
  buy: 'Buy on Be Bodywise',
  amazon: 'Buy on Amazon',
  save: 'Save my plan',
  listPrice: (price: string) => `At the Bodywise list price of Rs ${price}.`,
  costNote: 'Bodywise itself says about 3 months for full results.',
  costKitNote: (price: string) =>
    `An estimate: a cream may last longer than a roll-on. At the Bodywise list price of Rs ${price}. Bodywise itself says about 3 months for full results.`,
} as const;

export const plan = {
  runningHead: 'Right Start · Day 0',
  leadBox: "Opened from the card in your box. Here's your cast.",
  leadSaved: "Saved on this phone. Here's your cast.",
  roleRollon: 'New arrival',
  roleSplit: 'Mornings only',
  roleFaceOnly: 'Face only',
  roleGap: '2 days apart',
  roleFine: 'Fine together',
  nextTitle: 'Next, about 5 minutes',
  next: ['Your routine', 'Two photos', 'A date to judge it'],
  primary: 'Start my plan',
  fallback: "Didn't do the check? It takes 2 minutes",
  fallbackTitle: 'Start with the 2-minute check',
} as const;

export const common = {
  placeholder: 'Placeholder rules, to be signed by a dermatologist.',
  conceptLabel: 'Concept for Be Bodywise',
} as const;
