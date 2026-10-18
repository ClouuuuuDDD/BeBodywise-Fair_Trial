/**
 * Shared types for Fair Trial. Types only: no values, no logic, no imports from app code.
 * Owner: E1. Every other module imports from here; changes go through E1 (open a PR to main).
 * engineering/handoff/contracts.ts re-exports this file for the hand-off pack.
 *
 * Names follow submission/glossary.md; behaviour follows docs/prd/PRD.md (sections 8, 9, 11)
 * and engineering/handoff/events.md. Data values are kebab-case; analytics event and property
 * names are snake_case. Rule outcomes are placeholders until a dermatologist signs them (G0-1).
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Calendar date on her phone, local time, as YYYY-MM-DD (no time zone maths in the engine). */
export type ISODate = string;
/** Instant as an ISO 8601 timestamp with offset, for logs and photos. */
export type ISODateTime = string;
/** Whole rupees. Shown as "Rs 329", never the rupee sign (FR-X-10). */
export type Rupees = number;

/** Catalog ids from solution/data/bodywise-underarm-catalog.json. */
export type BodywiseProductId = 'bw-rollon-4' | 'bw-rollon-6' | 'bw-repair-cream' | 'bw-kit-4' | 'bw-kit-6';
/** Related Bodywise products that may sit on her shelf but are not underarm picks. */
export type BodywiseRelatedId = 'bw-niacinamide-lotion' | 'bw-glycolic-stick';
/** Any catalog id (events.md `product_id`). */
export type CatalogId = BodywiseProductId | BodywiseRelatedId;

/** Ingredient classes, keys of `classes` in ingredient-rules.json. */
export type IngredientClass =
  | 'aha'
  | 'bha'
  | 'pha'
  | 'retinoid'
  | 'benzoyl-peroxide'
  | 'vitamin-c-pure'
  | 'brightener'
  | 'steroid'
  | 'hydroquinone'
  | 'depilatory'
  | 'antiperspirant'
  | 'drying-alcohol'
  | 'fragrance'
  | 'physical-scrub'
  | 'bleach'
  | 'soothing'
  | 'sunscreen';

/** Where she uses a product (shelf check "Where do you use it?", multi-select). */
export type BodyArea = 'underarm' | 'face' | 'body' | 'neck';
/** When she uses a product (shelf check "When?"). */
export type UseTime = 'morning' | 'night' | 'both' | 'now-and-then';

/** Where she came in: the `?src=` value on door links (FR-M1-02). `example` is set by example mode only and never shared. */
export type Channel = 'bodywise-product-page' | 'amazon-qr' | 'box-qr' | 'shared-link' | 'direct' | 'example';

/** Live use vs the seeded reviewer example (events carry it; example data never reaches metrics). */
export type AppMode = 'live' | 'example';

/* ------------------------------------------------------------------ */
/* Right Start: fit questions                                          */
/* ------------------------------------------------------------------ */

/** Bodywise's own severity scale: same / mild / moderate / severe (3+ shades darker). */
export type ShadeLevel = 'same' | 'mild' | 'moderate' | 'severe';
/** "How long has the darkness been there?" */
export type DarknessDuration = 'months' | 'year-plus' | 'always';
/** "How do you usually remove underarm hair?" */
export type HairRemoval = 'razor' | 'wax' | 'cream' | 'laser' | 'none';
/** "Is the skin on the back of your neck darker too?" */
export type YesNoNotSure = 'yes' | 'no' | 'not-sure';
/** "Are your periods usually regular?" `prefer-not` is labelled "Not sure, or I'd rather not say". */
export type YesNoPreferNot = 'yes' | 'no' | 'prefer-not';

/** The five tap-only fit questions, in screen order (H-19). Unanswered questions are undefined. */
export interface FitAnswers {
  /** Q1 `/check/1` (artboard 03b): underarm shade next to her inner arm. */
  shade?: ShadeLevel;
  /** Q2 `/check/2`: how long the darkness has been there. */
  duration?: DarknessDuration;
  /** Q3 `/check/3`: how she removes underarm hair; drives the hair-removal gap. */
  hairRemoval?: HairRemoval;
  /** Q4 `/check/4`: darker skin on the back of the neck (half of the hormone pattern). */
  darkNeck?: YesNoNotSure;
  /** Q5 `/check/5`: regular periods (other half of the hormone pattern). */
  regularPeriods?: YesNoPreferNot;
}

/** A shade answer resolved for display and rules. */
export interface ShadeInfo {
  /** The level. */
  level: ShadeLevel;
  /** Her words on screen, from the catalog severity_scale ("Clearly darker"). */
  label: string;
  /** 0 (same) to 3 (severe), for "at least clearly darker" comparisons. */
  rank: 0 | 1 | 2 | 3;
}

/** Fit check output. Two outcomes only, never a gate (H-18, FR-M2-01). */
export interface FitResult {
  /** 'good' = "Good fit. Here's how to start."; 'good-with-habit' when hair removal is razor, wax or cream. */
  outcome: 'good' | 'good-with-habit';
  /** The hair-removal gap line when outcome is 'good-with-habit', else undefined. */
  habit?: string;
  /** Hormone note trigger (FR-M2-02, config HORMONE_NOTE_TRIGGER): show the collapsed line on 05b. */
  hormoneNote: boolean;
}

/* ------------------------------------------------------------------ */
/* Right Start: shelf check                                            */
/* ------------------------------------------------------------------ */

/** How a product got onto her shelf. No barcode in v1 (decisions G0-2). */
export type ShelfSource = 'catalog' | 'label' | 'typed';

/** One ingredient after parsing and classification. */
export interface ClassifiedIngredient {
  /** Ingredient as read or listed (INCI), trimmed. */
  inci: string;
  /** Normalised form used for matching (lower case, punctuation and percentages stripped). */
  normalised: string;
  /** Classes it matched in ingredient-rules.json; empty when it is inert for the rules. */
  classes: IngredientClass[];
  /** 0-based position in the list (drying alcohol only counts in the first five). */
  position: number;
}

/** One product on her shelf. */
export interface ShelfItem {
  /** Local id (random), stable for the life of the plan. */
  id: string;
  /** Product name as she sees it (label front, catalog, or typed). Never leaves the phone. */
  product: string;
  /** Catalog id when it is a Bodywise product, else undefined. */
  catalogId?: CatalogId;
  /** How it was added. */
  source: ShelfSource;
  /** Confirmed ingredient list, classified. She has confirmed it before any rule runs. */
  ingredients: ClassifiedIngredient[];
  /** Union of ingredient classes, for quick rule checks. */
  classes: IngredientClass[];
  /** Where she uses it. Only products used on underarms can clash with an underarm product. */
  areas: BodyArea[];
  /** When she uses it. */
  times: UseTime;
  /** She tapped "This has stung me". */
  stung: boolean;
  /** Answer to the conditional sweat-or-smell question for antiperspirants, if asked. */
  antiperspirantFor?: 'sweat' | 'smell' | 'both';
  /** Mascot key from ingredient-rules.json product_types (art lookup), if known. */
  mascot?: string;
}

/** The five shelf answers (spec v2, H-20); keys of `answers` in ingredient-rules.json. */
export type ShelfAnswerKind = 'fine' | 'split-time' | 'pick-one' | 'wait' | 'stop-ask';

/** One row on "How your shelf gets along": her product vs the anchor product on her underarms. */
export interface ShelfAnswer {
  /** Shelf item this row is about. */
  itemId: string;
  /** One of the five answers. */
  answer: ShelfAnswerKind;
  /** Id of the pair rule that decided it (traceable to ingredient-rules.json). */
  ruleId: string;
  /** Plain-words reason with placeholders filled (product and ingredient named). */
  reason: string;
  /** The ingredient the reason names (e.g. "Glycolic Acid"), if any. */
  ingredient?: string;
  /** Lower number wins when several rules match (1 = stop and ask). */
  priority: number;
}

/* ------------------------------------------------------------------ */
/* Right Start: product pick and start plan                            */
/* ------------------------------------------------------------------ */

/** Pregnancy answer, asked only when the pick would include retinol (cream or kit). */
export type PregnancyAnswer = 'yes' | 'no' | 'prefer-not';

/** Everything the product pick reads (spec v2 "Product pick", first match wins). */
export interface PickInput {
  /** Her fit answers (shade drives most rows). */
  fit: FitAnswers;
  /** Her confirmed shelf. */
  shelf: ShelfItem[];
  /** Shelf answers already computed by pairRules. */
  shelfAnswers: ShelfAnswer[];
  /** Asked only when the pick would include retinol; undefined until asked. */
  pregnancy?: PregnancyAnswer;
  /** She keeps an antiperspirant for sweat and won't give it up. */
  keepsAntiperspirantForSweat?: boolean;
}

/** One honest "why not now" line for a product that was not picked. */
export interface WhyNotLine {
  /** The product this line is about. */
  productId: BodywiseProductId;
  /** The line, e.g. "step up at week 8 if your skin is calm but change is slow". */
  line: string;
  /** List price, shown beside the line on 05b (FR-M4-02). */
  priceInr: Rupees;
}

/** "Your Bodywise match": one pick plus a line for every other product in the range. Never a gate. */
export interface ProductPick {
  /** Recommended product; null for row 1 ("Sort this first") and row 4 ("you may not need it"). */
  pick: BodywiseProductId | null;
  /** Why there is no pick, so 05b renders the right no-pick state (OI-9). Set only when pick is null. */
  noPickReason?: 'sort-first' | 'may-not-need';
  /** Fragrance variant to suggest, when it matters (stung before, or keeping a fragranced spray). */
  variant?: 'no-fragrance';
  /** Pick-table row that matched (1-9, or 'extra-cream' for the antiperspirant add-on row). */
  ruleRow: number | 'extra-cream';
  /** Base row 1-9 that chose the product, kept when the add-on row sets ruleRow to 'extra-cream' (audit). */
  baseRow: number;
  /** Headline for the pick, plain words. */
  headline: string;
  /** Up to three reasons naming her answers (FR-M4-02). */
  why: string[];
  /** One line per other product in the range (all five appear on 05b between pick and whyNot). */
  whyNot: WhyNotLine[];
  /** Optional add-on (Pigmentation Repair Cream at night) for the sweat-antiperspirant case. */
  alsoOffer?: BodywiseProductId;
  /** Show the doctor link first (row 1, or the row 6 pregnancy note). Buying still works. */
  doctorFirst: boolean;
  /** Collapsed hormone note shown under the pick. */
  hormoneNote: boolean;
  /** List price of the pick at the Bodywise list price on the scrape date. */
  priceInr?: Rupees;
}

/** One line in the routine. */
export interface RoutineStep {
  /** Shelf item id, a catalog id for the Bodywise product being started, or 'none' for "Nothing else needed." */
  ref: string;
  /** Display name. */
  product: string;
  /** Short instruction, e.g. "One swipe on clean, dry skin". */
  instruction: string;
}

/**
 * Start plan (screen 07): Night / Morning / Keep apart, then the rules. Pure engine output;
 * the plan code and dates live on `Plan`.
 */
export interface StartPlan {
  /** Product being trialled. */
  productId: BodywiseProductId;
  /** Morning routine steps (her deodorant, or "nothing else needed"). */
  morning: RoutineStep[];
  /** Night routine steps (the roll-on, one swipe on clean dry skin). */
  night: RoutineStep[];
  /** Pick one here / Leave a gap products, each with its line (covers "no other acids there"). */
  keepApart: { ref: string; product: string; reason: string }[];
  /** The three on-screen rules (FR-M5-02): hair-removal gap, patch test, sunscreen. */
  rules: string[];
  /** The once-a-day note (H-07): "Bodywise allows twice a day; for a fair trial, use it once." */
  onceADayNote: string;
}

/* ------------------------------------------------------------------ */
/* Fair Trial: clock                                                   */
/* ------------------------------------------------------------------ */

/** How a day was logged. Unlogged days count as used (FR-M7-01). */
export type DayStatus = 'used' | 'paused' | 'skipped';

/** One logged day. At most one entry per date; the last write wins. */
export interface DayLogEntry {
  /** The day. */
  date: ISODate;
  /** Used (counts), paused or skipped (both push the judge-by date back). */
  status: DayStatus;
  /** Her tap, or an automatic pause from an amber/red reaction (FR-M8-03, FR-M8-05). */
  source: 'tap' | 'reaction-amber' | 'reaction-red';
}

/** Inputs to the trial clock. */
export interface TrialClockInput {
  /** Product on trial (sets price per bottle). */
  productId: BodywiseProductId;
  /** Day 0: the baseline day (photos before the first swipe). Not a use-day; use-days start the day after. */
  startDate: ISODate;
  /** Logged days after Day 0; any day up to today without an entry is assumed used. */
  dayLog: DayLogEntry[];
  /** Today on her phone (passed in so the engine stays pure and the example can jump days). */
  today: ISODate;
  /** Optional event date ("I have an event before then"). */
  eventDate?: ISODate;
}

/** Trial clock state: the judge-by date and what it costs to know. */
export interface TrialState {
  /** Product on trial. */
  productId: BodywiseProductId;
  /** Day 0. */
  startDate: ISODate;
  /** Use-days needed for a fair judgement (TRIAL_USE_DAYS, 56). */
  targetUseDays: number;
  /** Use-days so far, logged plus assumed: drives "Day N of 56" (FR-M7-03). */
  useDaysSoFar: number;
  /** Of useDaysSoFar, how many were assumed (unlogged). */
  assumedDays: number;
  /** True when any day was assumed used; home says "Counting days you didn't log as used." */
  assumingDailyUse: boolean;
  /** Paused days logged (amber pauses included). */
  pausedDays: number;
  /** Skipped days logged. */
  skippedDays: number;
  /** Calendar days since Day 0 (Day 0 = 0). For Keep Going "day n" and days_since_day0, not the running head. */
  calendarDay: number;
  /** Day 0 + TRIAL_USE_DAYS + paused + skipped days (FR-M7-02). */
  judgeByDate: ISODate;
  /** Calendar days from today to the judge-by date (0 when due). */
  daysToVerdict: number;
  /** Bottles for the whole trial: ceil(TRIAL_USE_DAYS / BOTTLE_DAYS) = 2 (FR-M7-04). */
  bottles: number;
  /** Bottles x list price of the product: Rs 658 for the 4% roll-on, Rs 798 for the 6%. */
  costInr: Rupees;
  /** True for kits and the cream, whose pack life is unknown (PRD GAP-5): show the cost as an estimate. */
  costIsEstimate: boolean;
  /** Date use-days reach the next multiple of BOTTLE_DAYS (refill state, screen 14). */
  bottleRunsOutOn: ISODate;
  /** Refill prompt due: use-days reached k x BOTTLE_DAYS and the verdict is still ahead (FR-M7-07). */
  refillDue: boolean;
  /** Halfway check due: use-days reached HALFWAY_USE_DAY (FR-M7-08). */
  halfwayDue: boolean;
  /** Use-days reached the target: verdict can start. */
  verdictDue: boolean;
  /** Optional event date she entered. */
  eventDate?: ISODate;
  /** Weeks of use she will have by the event date, when set (FR-M7-05). */
  weeksByEvent?: number;
}

/* ------------------------------------------------------------------ */
/* Reaction desk                                                       */
/* ------------------------------------------------------------------ */

/** "What's happening?" chips. */
export type Symptom = 'stinging' | 'redness' | 'flaking' | 'itching' | 'darker' | 'bumps-rash';
/** "How bad?" */
export type Severity = 'mild' | 'bothering' | 'painful';

/** What she reported on "Something feels off". */
export interface ReactionReport {
  /** When she reported it. */
  at: ISODateTime;
  /** One or more symptoms. */
  symptoms: Symptom[];
  /** How bad. */
  severity: Severity;
  /** Use-day when reported (R4 vs R5 compare it to GREEN_WINDOW_DAYS). 0 before Day 0. */
  useDay: number;
  /** Answer to the one shelf follow-up ("Did you use your Glow toner there?"), if asked. */
  usedSuspect?: { itemId: string; answer: 'yes' | 'no' };
}

/** Triage rule ids, first match wins (PRD 8.6). Placeholder rules, to be signed by a dermatologist. */
export type TriageRuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

/** Traffic-light answer (screen 13). */
export interface TriageResult {
  /** Rule that decided (reaction_answer_shown.rule_id). */
  ruleId: TriageRuleId;
  /** Green keep going / Amber pause 3 days / Red stop, show a doctor. */
  light: 'green' | 'amber' | 'red';
  /** The action line(s), plain words. */
  action: string[];
  /** Shelf item that is a likely cause (she answered yes to the follow-up), with the fix line. */
  likelyCause?: { itemId: string; product: string; ingredientClass: IngredientClass; fix: string };
  /** Follow-up to ask first when her shelf holds a likely cause and it was not yet answered (FR-M8-01). */
  followUp?: { itemId: string; question: string };
  /** Amber: paused days to log (PAUSE_DAYS), which push the judge-by date back (FR-M8-03). */
  pauseDays?: number;
  /** Red: pause the trial and show "Open my skin file" and the Bodywise in-app doctor (FR-M8-05). */
  showDoctor: boolean;
  /** Green and amber show the escalation line (FR-M8-04). */
  showEscalation: boolean;
}

/** A logged reaction with its answer, as kept on the plan. */
export interface ReactionRecord {
  /** What she reported. */
  report: ReactionReport;
  /** What the desk answered. */
  result: TriageResult;
}

/* ------------------------------------------------------------------ */
/* Photos (E3)                                                         */
/* ------------------------------------------------------------------ */

/** Which region a photo shows. Day 0 is two photos: underarm, then inner arm (H-05). */
export type PhotoRegion = 'underarm' | 'inner-arm';
/** When in the trial the photo was taken (events.md `session`). */
export type PhotoMoment = 'day0' | 'halfway' | 'verdict' | 'keep-going';
/** Quality gate failures (events.md `photo_failure`; copy s08.q.*). */
export type PhotoFailure = 'dark' | 'blur' | 'card-missing' | 'warm';

/** A captured photo. The Blob stays in IndexedDB on her phone; it never leaves it. */
export interface PhotoCapture {
  /** Local id. */
  id: string;
  /** Underarm or inner arm. */
  region: PhotoRegion;
  /** Trial moment. */
  moment: PhotoMoment;
  /** When taken. */
  takenAt: ISODateTime;
  /** The kept frame (the sharpest of the burst), JPEG. Never uploaded, never put in events. */
  blob: Blob;
  /**
   * The whole burst (BURST_FRAMES frames, decisions B8), held only until it is measured. Never persisted:
   * the store drops it on save, so only `blob` stays on the phone.
   */
  frames?: Blob[];
  /** Pixel size of the stored image. */
  width: number;
  /** Pixel size of the stored image. */
  height: number;
  /** Pairs the underarm and inner-arm shots taken together in the same light. */
  pairId: string;
}

/** CIELAB colour (D65). */
export interface Lab {
  /** Lightness 0-100. */
  L: number;
  /** Green (-) to red (+). */
  a: number;
  /** Blue (-) to yellow (+). */
  b: number;
}

/** Quality gate result for one photo. Any false flag means a one-line fix and a retake. */
export interface PhotoQuality {
  /** Exposure inside limits (not too dark, no clipping). False maps to failure `dark`. */
  lightOk: boolean;
  /** Sharp enough (Laplacian variance above threshold). False maps to `blur`. */
  focusOk: boolean;
  /** White card found in frame. False maps to `card-missing`. */
  cardFound: boolean;
  /** Light colour temperature usable after correction. False maps to `warm`. */
  colourOk: boolean;
  /** Failures, in the order the fix lines should show. */
  failures: PhotoFailure[];
}

/** White-card correction applied before measuring. */
export interface CardCorrection {
  /** Per-channel gains (linear RGB) that make the card neutral. */
  gains: [number, number, number];
  /** Card colour as measured before correction. */
  cardLab: Lab;
}

/** Measurement of one photo's region (computed in a Web Worker, on the phone). */
export interface PhotoMeasurement {
  /** Photo this measures. */
  photoId: string;
  /** Region measured. */
  region: PhotoRegion;
  /** Trimmed-mean colour of the region, after card correction. */
  lab: Lab;
  /** Individual Typology Angle in degrees: atan((L* - 50) / b*) * 180 / pi. Higher = lighter. */
  itaDeg: number;
  /** Quality gate flags. */
  quality: PhotoQuality;
  /** Card correction used, or null if no card was found (measurement is then less trustworthy). */
  correction: CardCorrection | null;
  /** Pixels used after trimming. */
  sampleCount: number;
  /** Sample SD of ITA° across the burst frames (0 for one frame): feeds the noise band (B8). */
  burstSpreadItaDeg: number;
  /** Frames measured in the burst (1 when only one frame exists). */
  burstFrames: number;
}

/** Photo-to-photo variation with no real change. Change inside it counts as no change. */
export interface NoiseBand {
  /** Half-width of the band in ITA° (change must exceed this to count). */
  itaDeg: number;
  /** How it was measured: two Day 0 shots per site, or the kill-test default. */
  source: 'day0-pair' | 'kill-test-default';
  /** Number of shot pairs it is based on. */
  samples: number;
}

/** Change bucket (events.md `change_bucket`; also the share payload `change`). */
export type ChangeBucket = 'beyond-band' | 'within-band' | 'darker-beyond-band' | 'not-comparable' | 'no-photos';

/** Gap and change between Day 0 and a later moment. */
export interface PhotoChange {
  /** ITA°(inner arm) - ITA°(underarm) at Day 0. */
  gapDay0: number;
  /** Same gap at the later moment. */
  gapNow: number;
  /** gapDay0 - gapNow. Positive = underarm moved toward her inner arm. */
  change: number;
  /** Noise band used. */
  band: NoiseBand;
  /** change > band: lighter beyond normal variation. */
  beyondBand: boolean;
  /** change < -band: darker beyond normal variation (verdict V6). */
  darkerBeyondBand: boolean;
  /** False when light/quality differs too much from Day 0 even after correction (V4). */
  comparable: boolean;
  /** Bucket for events. */
  bucket: ChangeBucket;
}

/* ------------------------------------------------------------------ */
/* Verdict                                                             */
/* ------------------------------------------------------------------ */

/** What her eye says in the blind pick (events.md `blind_pick`). */
export type BlindPickSays = 'now-lighter' | 'same' | 'day0-lighter';

/** Blind pick: Day 0 and today's underarm photos shuffled, "Which one looks lighter?" plus "They look the same to me". */
export interface BlindPick {
  /** Which photo was shown as A (the order is random and recorded; order AB = day0 first). */
  shownAsA: 'day0' | 'now';
  /** Her choice. */
  choice: 'A' | 'B' | 'same';
  /** Derived: today's photo lighter, the same, or Day 0 lighter. */
  says: BlindPickSays;
  /** When she chose. */
  at: ISODateTime;
}

/** The five verdicts (H-10). */
export type VerdictOutcome = 'working' | 'not-yet' | 'cant-call' | 'not-for-you' | 'see-doctor';

/**
 * Verdict rules, first match wins (PRD FR-M10-02): V1 red reaction or V7 with the hormone note;
 * V2 too few use-days; V3 no Day 0 photos (her own read); V4 not comparable; V5 lighter beyond band;
 * V6 darker beyond band; V7 within band and pick "same"; V8 other disagreement; K kill test off
 * (V5-V8 decided by the blind pick alone).
 */
export type VerdictRuleId = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'K';

/** Verdict engine output. */
export interface Verdict {
  /** One of five outcomes. */
  outcome: VerdictOutcome;
  /** Rule that decided. */
  rule: VerdictRuleId;
  /** Plain reason lines, no blame: use-days, measurement, blind pick (FR-M10-03). */
  reasons: string[];
  /** The one next step. */
  nextStep: string;
  /** New date for Not yet: today + (56 - use-days) for V2, or + RECHECK_DAYS for V8. */
  newDate?: ISODate;
  /** True when the measurement informed the outcome (false for V3 and for K). */
  measured: boolean;
  /** True when the blind pick led because KILL_TEST_PASSED is false (rule K). */
  blindPickLed: boolean;
  /** V3 without both shade answers: returned as cant-call; the screen asks the shade question, then calls verdict() again. */
  needsShadeAnswer?: boolean;
  /** No Day 0 photos: "No photos, so nothing was measured." (V3). */
  withoutPhotos: boolean;
  /**
   * Step-up offer (decisions X1-03, "calm but slow"): set only on Not for you (measured V7, rule K or V3) when use-days are met,
   * no amber or red reaction and no "stung me" on the trial product; 4% roll-on -> 6% roll-on, 6% roll-on -> Advanced kit.
   * Never set with the hormone note (See a doctor applies), on a kit, or on any other outcome.
   */
  stepUp?: BodywiseProductId;
}

/** Inputs the verdict engine needs, gathered from the plan. */
export interface VerdictInput {
  /** Trial clock state at verdict time. */
  trial: TrialState;
  /** All reactions logged. */
  reactions: ReactionRecord[];
  /** Photo change, or null when there are no Day 0 photos. */
  change: PhotoChange | null;
  /** Her blind pick, or null when skipped or no photos. */
  blindPick: BlindPick | null;
  /** Shade at the fit check (V3 compares it with shadeNow). */
  shadeDay0?: ShadeLevel;
  /** Shade question asked again on verdict day when there are no photos (V3). */
  shadeNow?: ShadeLevel;
  /** She tapped "This has stung me" on the trial product (not calm, so no step-up offer, X1-03). */
  trialProductStung?: boolean;
  /** Hormone note was on at the fit check (V1). */
  hormonePattern: boolean;
  /** config KILL_TEST_PASSED, passed in so tests can cover both paths. */
  killTestPassed: boolean;
  /** Today, for newDate. */
  today: ISODate;
}

/* ------------------------------------------------------------------ */
/* The persisted plan (one per device, plus a separate example store)  */
/* ------------------------------------------------------------------ */

/** Everything saved on her phone for one trial (PRD section 9 "Plan aggregate"). Lives in IndexedDB. */
export interface Plan {
  /** "FT-" + 4 characters from PLAN_CODE_ALPHABET, made at "Save my plan" (FR-M5-01). Local only. */
  planCode: string;
  /** Random UUID v4 made at first launch; the events `trial_id`. Device only. */
  trialId: string;
  /** Live or example (example lives in its own store and never overwrites hers). */
  mode: AppMode;
  /** Date of the fit check ("Your plan from 14 October", screen 06). */
  checkedOn: ISODate;
  /** Door she came through. */
  channel: Channel;
  /** Fit answers. */
  fit: FitAnswers;
  /** Fit result. */
  fitResult: FitResult;
  /** Her shelf. */
  shelf: ShelfItem[];
  /** Shelf answers against the anchor product. */
  shelfAnswers: ShelfAnswer[];
  /** Pregnancy answer, if it was asked. */
  pregnancy?: PregnancyAnswer;
  /** The Bodywise match. */
  pick: ProductPick;
  /** Product she is actually trialling (may differ from the pick: she decides). */
  trialProduct?: BodywiseProductId;
  /** Routine, made once she has a trial product. */
  startPlan?: StartPlan;
  /** Day 0, once she starts. */
  day0?: ISODate;
  /** Logged days. */
  dayLog: DayLogEntry[];
  /** Optional event date. */
  eventDate?: ISODate;
  /** Reactions logged. */
  reactions: ReactionRecord[];
  /** Ids of PhotoCapture records in the photos store (blobs are stored separately). */
  photoIds: string[];
  /** Photos skipped at Day 0 (FR-M6-05). */
  photosSkipped: boolean;
  /** Blind pick on verdict day. */
  blindPick?: BlindPick;
  /** The verdict, once shown. */
  verdict?: Verdict;
  /** Set when she stops before the verdict. */
  stopped?: { on: ISODate; reason?: StopReason };
  /** Share choice (screen 19). */
  consent?: ShareConsent;
  /** Hash of config.ts + both rule JSON files when the plan was made (events `rules_version`). */
  rulesVersion: string;
}

/* ------------------------------------------------------------------ */
/* Part 2: consent and the anonymous share payload                     */
/* ------------------------------------------------------------------ */

/** "What made you stop?" (one tap, skippable). */
export type StopReason = 'reaction' | 'too-slow' | 'no-change' | 'price' | 'forgot' | 'other';

/** Her choice on "Share your result" (screen 19). Default is not shared. */
export interface ShareConsent {
  /** Yes, share anonymously. */
  shared: boolean;
  /** When she chose. */
  at: ISODateTime;
  /** What the yes covered (shown on screen before she chose). */
  scope: ('outcome' | 'use-days' | 'fit-answers' | 'shelf-classes' | 'reactions' | 'stop-reason')[];
  /** Prepared payload; in the prototype it stays on the phone and is shown to her (FR-M12-02). */
  payload?: TrialEvent[];
  /** Set if she later withdraws. */
  withdrawnAt?: ISODateTime;
}

/**
 * One record of the anonymous share payload (events.md "Share payload"), built from local state
 * only after "Yes, share anonymously". Never contains names, phone numbers, free text, product names
 * of other brands, photos, locations, the plan code or exact dates. Not the local analytics log
 * (that is AnalyticsEvent).
 */
export interface TrialEvent {
  /** Moment this record describes. */
  event: 'fit-check' | 'shelf-check' | 'pick' | 'trial-start' | 'reaction' | 'verdict' | 'stop' | 'step-up';
  /** Fresh random UUID made for the share, not the local trial_id. */
  trial: string;
  /** Product and variant, e.g. "bw-rollon-4/no-fragrance". */
  product?: string;
  /** Shade bucket. */
  shade?: ShadeLevel;
  /** Hair removal bucket. */
  hairRemoval?: HairRemoval;
  /** Pattern flags, e.g. ["hormone"] or ["none"]. */
  patternFlags?: string[];
  /** Shelf classes with area, e.g. "aha:face", "depilatory:underarm". */
  shelfClasses?: string[];
  /** Shelf answers given, by kind. */
  shelfAnswers?: ShelfAnswerKind[];
  /** Use-days as a percentage bucket. */
  useDaysPct?: '0-49' | '50-69' | '70-89' | '90-100';
  /** Photo change bucket. */
  change?: ChangeBucket;
  /** Blind pick relative to measurement. */
  blindPick?: 'agrees' | 'disagrees' | 'unsure' | 'skipped';
  /** Reaction light, for reaction records. */
  light?: TriageResult['light'];
  /** Verdict outcome, for verdict records. */
  outcome?: VerdictOutcome;
  /** Stop reason, for stop records. */
  stopReason?: StopReason;
  /** Entry channel (never `example`: example data is never shared). */
  channel?: Exclude<Channel, 'example'>;
  /** ISO week only, e.g. "2026-W50". */
  week: string;
}

/* ------------------------------------------------------------------ */
/* Local analytics log (PRD section 11, events.md)                     */
/* ------------------------------------------------------------------ */

/** Envelope on every local analytics event. Written to IndexedDB store `events`; nothing is sent. */
export interface AnalyticsEnvelope {
  /** Local ISO 8601 with offset. */
  ts: ISODateTime;
  /** Random UUID v4 made at first launch; device only. */
  trial_id: string;
  /** Local only; never copied into the share payload. */
  plan_code: string | null;
  /** Live or example (example is excluded from every metric). */
  mode: AppMode;
  /** Artboard id, e.g. "05b". */
  screen: string;
  /** Build hash. */
  app_version: string;
  /** Hash of config.ts + both rule JSON files. */
  rules_version: string;
}

/** Properties per event name, snake_case (events.md "Events" table). */
export interface AnalyticsEventProps {
  door_opened: { channel: Channel };
  check_started: { channel: Channel };
  example_opened: { entry: 'welcome' | 'direct' };
  example_jump: { jump: ExampleStop };
  fit_answered: { question: 1 | 2 | 3 | 4 | 5; answer: string };
  fit_completed: {
    shade: ShadeLevel | null;
    duration: DarknessDuration | null;
    hair_removal: HairRemoval | null;
    neck: YesNoNotSure | null;
    periods: YesNoPreferNot | null;
    fit_outcome: FitResult['outcome'];
    hormone_note: boolean;
  };
  hormone_note_expanded: Record<string, never>;
  shelf_add_started: { method: ShelfSource };
  label_read_completed: {
    status: 'ok' | 'retake' | 'error' | 'ocr-fallback';
    ingredient_count: number;
    latency_bucket: 'lt2s' | '2to5s' | '5to10s' | 'gt10s';
    http_status: number;
  };
  label_read_confirmed: { edited: boolean; classes: IngredientClass[] };
  shelf_item_added: {
    source: ShelfSource;
    classes: IngredientClass[];
    areas: BodyArea[];
    time: UseTime;
    stung: boolean;
    bodywise_id: CatalogId | null;
  };
  shelf_item_removed: { source: ShelfSource; classes: IngredientClass[] };
  shelf_item_edited: { field: 'areas' | 'time'; classes: IngredientClass[] };
  conditional_answered: { question: 'sweat-or-smell' | 'pregnancy'; answer: string };
  shelf_checked: {
    item_count: number;
    n_fine: number;
    n_split_time: number;
    n_pick_one: number;
    n_wait: number;
    n_stop_ask: number;
  };
  pick_shown: {
    product_id: BodywiseProductId | null;
    variant: string | null;
    rule_row: ProductPick['ruleRow'];
    base_row: number;
    hormone_note: boolean;
  };
  buy_clicked: { store: 'bodywise' | 'amazon'; product_id: BodywiseProductId };
  plan_saved: { channel: Channel; product_id: BodywiseProductId | null };
  plan_opened: { source: 'box-qr' | 'saved' | 'link' };
  routine_acknowledged: { keep_apart_count: number };
  routine_shared: { method: 'web-share' | 'whatsapp' };
  photo_taken: { session: PhotoMoment; site: PhotoRegion; pass: boolean; failures: PhotoFailure[]; attempt: number };
  photos_skipped: { session: PhotoMoment };
  baseline_saved: { noise_band_bucket: 'narrow' | 'medium' | 'wide' };
  judge_date_set: { use_day_target: number; bottles: number; cost_inr: Rupees; product_id: BodywiseProductId };
  event_mode_used: { weeks_in_bucket: 'lt4' | '4to6' | '6to8' };
  calendar_added: { method: 'google' | 'ics' };
  home_viewed: { use_day: number; state: 'quiet' | 'halfway' | 'refill' | 'verdict-due' | 'paused-red' };
  use_day_logged: { status: DayStatus | 'cleared'; source: DayLogEntry['source'] };
  reaction_reported: {
    symptoms: Symptom[];
    severity: Severity;
    use_day: number;
    follow_up_asked: boolean;
    follow_up_answer: 'yes' | 'no' | null;
  };
  reaction_answer_shown: { light: TriageResult['light']; rule_id: TriageRuleId; likely_cause_class: IngredientClass | null };
  doctor_link_clicked: { from: 'hormone-note' | 'stop-ask' | 'reaction-red' | 'verdict' | 'skin-file' };
  skin_file_opened: { from: string };
  skin_file_exported: { with_photos: boolean };
  refill_prompt_shown: { use_day: number; days_to_verdict: number };
  refill_choice: { choice: 'another-bottle' | 'stop' };
  trial_stopped: { use_day: number; from: 'refill' | 'home' };
  stop_reason_answered: { reason: StopReason | 'skipped' };
  halfway_photo_taken: { use_day: number };
  verdict_started: { use_days: number };
  blind_pick_answered: { choice: BlindPickSays; order: 'AB' | 'BA' };
  verdict_shown: {
    outcome: VerdictOutcome;
    rule_id: VerdictRuleId;
    use_days: number;
    assumed_days: number;
    measured: boolean;
    change_bucket: ChangeBucket;
    blind_pick: BlindPickSays | 'none';
    days_since_day0: number;
    step_up: boolean;
    hormone_note: boolean;
  };
  knows_where_she_stands: { answer: 'yes' | 'no' };
  step_up_offered: { from_product: BodywiseProductId; to_product: BodywiseProductId };
  step_up_clicked: { from_product: BodywiseProductId; to_product: BodywiseProductId };
  reorder_clicked: { product_id: BodywiseProductId; days_since_day0: number };
  share_answered: { choice: 'yes' | 'no' };
  share_payload_prepared: { field_count: number };
  keep_going_viewed: { days_since_day0: number };
  shelf_check_in_place: { answer: ShelfAnswerKind };
  data_deleted: Record<string, never>;
}

/** Local analytics event names. */
export type AnalyticsEventName = keyof AnalyticsEventProps;

/** One local analytics event: envelope + name + that event's properties. */
export type AnalyticsEvent<K extends AnalyticsEventName = AnalyticsEventName> = {
  [N in K]: AnalyticsEnvelope & { event: N } & AnalyticsEventProps[N];
}[K];

/* ------------------------------------------------------------------ */
/* Example trial (reviewer path)                                       */
/* ------------------------------------------------------------------ */

/** Jump keys for `/example?jump=<key>` (PRD AC-22-5), plus `halfway` as an extra. */
export type ExampleStop =
  | 'check'
  | 'day-0'
  | 'day-9'
  | 'day-23'
  | 'halfway'
  | 'day-40'
  | 'day-56-working'
  | 'day-56-not-for-you'
  | 'not-yet'
  | 'cant-call'
  | 'see-doctor'
  | 'keep-going'
  | 'insights';

/** The seeded example trial (Riya), labelled "Example". Lives in its own IndexedDB store. */
export interface ExampleState {
  /** Always true: screens show the "Example" tag when set. */
  isExample: true;
  /** Persona name from the glossary. */
  persona: 'Riya';
  /** Her seeded plan (mode 'example'; clearly darker, a year or more, razor, neck no, periods regular). */
  plan: Plan;
  /** "Today" in the example, set by the jump (the engine takes today as input). */
  today: ISODate;
  /** Current named stop, if the jump landed on one. */
  stop?: ExampleStop;
}

/* ------------------------------------------------------------------ */
/* Label reader (E6) wire contract                                     */
/* ------------------------------------------------------------------ */

/** Response from POST /api/read-label. The model only transcribes; rules decide in the browser. */
export interface LabelReadResponse {
  /** Product name read from the front, if found. */
  name: string | null;
  /** Ingredient list as written, split on commas. */
  ingredients: string[];
  /** Raw transcription text (for the confirm screen and debugging). */
  raw: string;
  /** OpenRouter model id that read it. */
  model: string;
}

/** Error body from POST /api/read-label. */
export interface LabelReadError {
  /** Machine code, e.g. "not_implemented", "too_large", "rate_limited", "unreadable". */
  error: string;
  /** Plain message safe to show. */
  message: string;
}
