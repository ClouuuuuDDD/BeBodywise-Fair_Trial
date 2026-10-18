/**
 * Every rule value and product constant in one file (engineering brief; decisions G0-1).
 * Owner: E2. Rule values are illustrative placeholders, to be set by a dermatologist.
 * Screens that show these rules must carry PLACEHOLDER_RULES_LABEL (decisions X1-05).
 * Numbers here must match submission/FACTS.md and submission/decisions.md; never invent new ones.
 * Names follow the engineering brief (SHAVE_GAP_MIN, WAX_GAP_H, BOTTLE_DAYS); the PRD's
 * AFTER_SHAVE_WAIT / AFTER_WAX_WAIT / BOTTLE_USE_DAYS mean these same constants.
 */
import type { BodywiseProductId, HairRemoval, IngredientClass, YesNoNotSure, YesNoPreferNot } from '../contracts';

/* ---------- Start rules ---------- */

/** Minutes to wait after shaving before the roll-on, [min, max]. Bodywise's own guidance. Placeholder, to be set by a dermatologist. */
export const SHAVE_GAP_MIN: readonly [number, number] = [10, 15];
/** Hours to wait after waxing before the roll-on, [min, max]. Bodywise's own guidance. Placeholder, to be set by a dermatologist. */
export const WAX_GAP_H: readonly [number, number] = [6, 12];
/** Days to wait after a hair removal cream before an acid (pair rule acid-depilatory). Placeholder, to be set by a dermatologist. */
export const DEPILATORY_GAP_DAYS = 2;
/** Patch test: small spot on the inner arm, wait this many hours (decisions H-06). Placeholder, to be set by a dermatologist. */
export const PATCH_TEST_HOURS = 24;
/** Applications a day during the trial: once, stricter than Bodywise's twice, so use-days compare (H-07). Placeholder, to be set by a dermatologist. */
export const APPLICATIONS_PER_DAY = 1;
/** If it stings after shaving, the plan says use it at night instead (G0-1). Placeholder, to be set by a dermatologist. */
export const STING_AFTER_SHAVE_MOVE_TO_NIGHT = true;

/* ---------- Trial clock ---------- */

/** Use-days needed for a first fair judgement: 56 (8 weeks), Fair Trial's design target (H-04). Placeholder, to be set by a dermatologist. */
export const TRIAL_USE_DAYS = 56;
/** Use-day of the optional halfway check-in photo (week 4, F-134). Never a verdict. Placeholder, to be set by a dermatologist. */
export const HALFWAY_USE_DAY = 28;
/** Calendar-day window for the north-star metric: 56 use-days + 14 days of slack (H-04). */
export const NORTH_STAR_WINDOW_DAYS = 70;
/** Use-days one 50 ml bottle lasts at one swipe a day. ESTIMATE, design assumption (H-02). Never print "30 days". PRD calls it BOTTLE_USE_DAYS. */
export const BOTTLE_DAYS = 40;
/** Bottle size the clock assumes, in ml. */
export const BOTTLE_ML = 50;
/** Bodywise says about 3 months for full results; say so where it matters (H-04). */
export const BODYWISE_FULL_RESULT_MONTHS = 3;

/* ---------- Prices: Bodywise list prices on 17 Oct 2026 (H-16); always "at the Bodywise list price" ---------- */

/** 4% AHA BHA Underarm Roll-on, 50 ml. */
export const PRICE_ROLLON_4 = 329;
/** 6% AHA BHA Underarm Roll-on, 50 ml. */
export const PRICE_ROLLON_6 = 399;
/** Pigmentation Repair Cream. */
export const PRICE_REPAIR_CREAM = 549;
/** Underarm Pigmentation Kit - No Fragrance (4% roll-on + repair cream). */
export const PRICE_KIT_4 = 799;
/** Advanced Underarm Pigmentation Kit (6% roll-on + repair cream). */
export const PRICE_KIT_6 = 859;

/* ---------- Reaction desk ---------- */

/** Amber: log this many paused days (they push the judge-by date back), then every other night for a week (FR-M8-03). Placeholder, to be set by a dermatologist. */
export const PAUSE_DAYS = 3;
/** Mild reactions up to this use-day get "Common in the first 2 weeks" (R4); after it, R5 (F-141). Placeholder, to be set by a dermatologist. */
export const GREEN_WINDOW_DAYS = 14;

/* ---------- Verdict and Keep Going ---------- */

/** "Not yet" by V8 (measurement and blind pick disagree): recheck in this many days (4 weeks). Placeholder, to be set by a dermatologist. */
export const RECHECK_DAYS = 28;
/** Exact placeholder label on every rule screen and the skin-file PDF (decisions X1-05). */
export const PLACEHOLDER_RULES_LABEL = 'Placeholder rules, to be signed by a dermatologist.';
/** Week at which "calm but slow" can step up 4% -> 6% (H-08; rule in FR-M10-05). Placeholder, to be set by a dermatologist. */
export const STEP_UP_WEEK = 8;
/** Keep Going: periodic re-check every this many weeks with the same photo guide. Placeholder, to be set by a dermatologist. */
export const KEEP_GOING_CHECK_WEEKS = 8;
/** False until the week-1 kill test passes (F-140): the blind pick leads the verdict (rule K), measurement is supporting only. */
export const KILL_TEST_PASSED = false;
/**
 * Noise band default in ITA degrees, used only when no Day 0 pair exists. Unknown until the
 * week-1 kill test (E3) measures it; null means "not set" and the verdict must lean on the blind pick.
 */
export const NOISE_BAND_DEFAULT_ITA_DEG: number | null = null;

/* ---------- Label reading ---------- */

/** Barcode lookup is out of v1 (decisions G0-2). */
export const BARCODE_ENABLED = false;
/** Fewer recognised ingredients than this (or no commas) means ask for a retake. */
export const LABEL_MIN_INGREDIENTS = 4;
/** Longest edge, in px, the label photo is resized to on the phone before upload. */
export const LABEL_MAX_EDGE_PX = 1280;
/** Drying alcohol only counts when it is within the first this-many ingredients. */
export const DRYING_ALCOHOL_MAX_POSITION = 5;
/** Give up on /api/read-label after this long and offer "Type the name" (engineering parameter, PRD GAP-3). */
export const LABEL_TIMEOUT_MS = 20_000;

/* ---------- Fit check and plan ---------- */

/**
 * Hormone note trigger (FR-M2-02): neck in `neck` AND periods in `periods`. Never a gate; "can be", never
 * "you have". Placeholder, to be set by a dermatologist.
 */
export const HORMONE_NOTE_TRIGGER: { readonly neck: readonly YesNoNotSure[]; readonly periods: readonly YesNoPreferNot[] } = {
  neck: ['yes', 'not-sure'],
  periods: ['no', 'prefer-not'],
};
/** Hair removal answers that make the fit outcome 'good-with-habit' (FR-M2-01). Placeholder, to be set by a dermatologist. */
export const HABIT_HAIR_REMOVAL: readonly HairRemoval[] = ['razor', 'wax', 'cream'];
/** Plan code: "FT-" + PLAN_CODE_LENGTH characters from an unambiguous set (no 0/O/1/I) (FR-M5-01). */
export const PLAN_CODE_PREFIX = 'FT-';
export const PLAN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PLAN_CODE_LENGTH = 4;

/* ---------- Part 2 ---------- */

/** Live insights hide any group under this many women (architecture.html). Prototype uses sample data. */
export const INSIGHTS_MIN_GROUP = 50; // not in FACTS (PRD GAP-4): decide before any live claim

/* ---------- Engine constants added by E2 (product groups, defaults, buckets) ---------- */

/** Bodywise roll-ons. A kit contains one of these, so it also counts as "a Bodywise roll-on" for pair rules. */
export const ROLLON_IDS: readonly BodywiseProductId[] = ['bw-rollon-4', 'bw-rollon-6'];
/** Bodywise kits (roll-on + Pigmentation Repair Cream, which has retinol). */
export const KIT_IDS: readonly BodywiseProductId[] = ['bw-kit-4', 'bw-kit-6'];
/** Products that contain retinol, so the pregnancy question applies (ingredient-rules.json conditional_questions). */
export const RETINOL_PRODUCT_IDS: readonly BodywiseProductId[] = ['bw-repair-cream', 'bw-kit-4', 'bw-kit-6'];
/** List price by product, from the constants above. */
export const LIST_PRICE_INR: Readonly<Record<BodywiseProductId, number>> = {
  'bw-rollon-4': PRICE_ROLLON_4,
  'bw-rollon-6': PRICE_ROLLON_6,
  'bw-repair-cream': PRICE_REPAIR_CREAM,
  'bw-kit-4': PRICE_KIT_4,
  'bw-kit-6': PRICE_KIT_6,
};
/** Step-up targets (X1-03): 4% roll-on -> 6% roll-on; 6% roll-on -> Advanced Underarm Pigmentation Kit; kits and the cream do not step up. */
export const STEP_UP_TARGET: Readonly<Partial<Record<BodywiseProductId, BodywiseProductId>>> = {
  'bw-rollon-4': 'bw-rollon-6',
  'bw-rollon-6': 'bw-kit-6',
};
/** Anchor product the shelf check runs against before a pick exists (spec: Riya's rows are against the 4% roll-on). */
export const DEFAULT_ANCHOR_PRODUCT: BodywiseProductId = 'bw-rollon-4';
/** Amber: "then every other night for a week" (FR-M8-03 / copy s13.amber.body). Placeholder, to be set by a dermatologist. */
export const AMBER_EVERY_OTHER_NIGHT_DAYS = 7;
/** Shelf classes that make the reaction desk ask its one follow-up (FR-M8-01), most suspect first. */
export const REACTION_SUSPECT_CLASSES: readonly IngredientClass[] = [
  'aha',
  'bha',
  'retinoid',
  'drying-alcohol',
  'depilatory',
  'physical-scrub',
  'fragrance',
];
/** Event mode buckets for `event_mode_used.weeks_in_bucket`: below the first is lt4, below the second is 4to6, else 6to8. */
export const EVENT_WEEKS_BUCKET_EDGES: readonly [number, number] = [4, 6];
/** Days in a week, for week-to-day maths. */
export const DAYS_PER_WEEK = 7;
/** Photo-measurement lead: kill-test-off verdicts show the measurement as supporting only. */
export const SUPPORTING_ONLY_NOTE = 'The photo measurement is a supporting number for now.';


/* ---------- Photo lab (E3 edits this section; decisions B8) ----------
 * Measurement placeholders until the week-1 kill test and a dermatologist set them. KILL_TEST_PASSED and
 * NOISE_BAND_DEFAULT_ITA_DEG above stay the switch; the kill-test page only reports a recommendation.
 */

/** Longest edge, px, a frame is downscaled to before measuring (keeps the worker fast and blur scores comparable). */
export const PHOTO_MEASURE_EDGE_PX = 640;
/** Frames silently kept per capture (decisions B8). */
export const BURST_FRAMES = 3;
/** Gap between burst frames, ms. */
export const BURST_GAP_MS = 120;

/** Guide oval, as fractions of the frame (centre x, centre y, radius x, radius y). The overlay uses the same numbers. */
export const GUIDE_OVAL = { cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.36 } as const;
/** Fraction of the oval's radius that is measured (centre of the oval; drops hair at the edge and shadow). */
export const MEASURE_OVAL_SCALE = 0.7;
/** Pixels with L* outside these percentiles of the region are dropped before the median (hair, shadow, glare). */
export const TRIM_PERCENTILES: readonly [number, number] = [0.1, 0.9];

/** Quality gate (placeholder thresholds, tune in the kill test). */
export const GATE = {
  /** Too dark: white card's relative luminance Y below this (with a card). Placeholder. */
  cardYMin: 0.3,
  /** Too dark when no card is found: skin relative luminance Y below this. Placeholder. */
  skinYMin: 0.04,
  /** Too bright: share of oval pixels with any channel at 250+ above this. Placeholder. */
  clipShareMax: 0.05,
  /** Blur: variance of the Laplacian (0-255 grey, frame downscaled to PHOTO_MEASURE_EDGE_PX) below this. Placeholder. */
  laplacianVarMin: 20,
  /** Too yellow: card R/B ratio (linear) above this. Placeholder. */
  warmRbMax: 1.6,
} as const;

/** White card search (placeholder). */
export const CARD = {
  /** Block size as a fraction of the shorter frame edge. */
  blockFrac: 0.025,
  /** Max saturation (max-min)/max of a card block, in gamma space. Loose on purpose: white paper under a bulb is very yellow, and the warm check needs to see it. */
  satMax: 0.55,
  /** Min gamma luma (0-1) of a card block. */
  lumaMin: 0.5,
  /** Blocks within this share of the brightest candidate count as card. */
  nearBrightest: 0.92,
  /** Smallest connected patch, in blocks. */
  minBlocks: 4,
  /** Card must be brighter than the skin median by this factor (linear Y). */
  overSkin: 1.15,
} as const;

/** Noise band = NOISE_K * sigma of one change value (placeholder; 2 = about 95% of no-change values fall inside). */
export const NOISE_K = 2;
/**
 * Kill test (PLACEHOLDER): the widest noise band, in ITA°, at which measurement may lead the verdict.
 * Wider than this and the blind pick leads (KILL_TEST_PASSED stays false). To be set by the team with
 * the dermatologist once the size of a real 8-week change is known.
 */
export const KILL_TEST_MAX_BAND_ITA_DEG = 5;
/** Kill test: fewest sessions per condition for a spread to count. */
export const KILL_TEST_MIN_SESSIONS = 3;

/** Two sessions are comparable only if the white card's L* differs by no more than this (light too different otherwise). Placeholder. */
export const COMPARABLE_CARD_L_MAX = 15;

/** The card is mapped to this neutral linear level (about sRGB 236) so colour cast and light strength are both corrected. Placeholder. */
export const CARD_TARGET_LINEAR = 0.84;
