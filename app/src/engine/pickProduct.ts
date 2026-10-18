import type {
  BodywiseProductId,
  PickInput,
  PregnancyAnswer,
  ProductPick,
  ShadeLevel,
  ShelfItem,
  WhyNotLine,
} from '../contracts';
import { STEP_UP_WEEK } from './config';
import { fit as runFit } from './fit';
import { hasRetinol, isBodywisePick, hasRollOn, productName, productPrice } from './products';
import { shade as shadeInfo } from './shade';

/** The five products of the range, in the order they are listed on 05b after the pick. */
const RANGE: readonly BodywiseProductId[] = ['bw-rollon-4', 'bw-rollon-6', 'bw-kit-4', 'bw-repair-cream', 'bw-kit-6'];

const STEP_UP_LINE = `Step up at week ${STEP_UP_WEEK} if your skin is calm but change is slow.`;
const RETINOL_LINE = 'Has retinol. Ask a doctor first.';
const KIT_SHADES_LINE = 'For 3+ shades darker. Adds a retinol night cream.';
const KIT6_LINE = `Stronger, for 3+ shades. Step up only if the first kit is gentle on you but slow at week ${STEP_UP_WEEK}.`;
const CREAM_LINE = 'No odour control. For when you need your antiperspirant.';
const CREAM_SMELL_LINE = 'Only if you need an antiperspirant for sweat. You said smell, so the roll-on covers it.';

const hasAcid = (i: ShelfItem) => i.classes.some((c) => c === 'aha' || c === 'bha');
const onUnderarm = (i: ShelfItem) => i.areas.includes('underarm');

/** Facts derived from the shelf and answers (FR-M4-01). */
interface Facts {
  shade: ShadeLevel;
  shadeAssumed: boolean;
  stung: ShelfItem | undefined;
  usedAcids: boolean;
  usesCream: boolean;
  fragrancedDeo: boolean;
  sweatKeeper: boolean;
}

function facts(input: PickInput): Facts {
  const { fit, shelf } = input;
  return {
    shade: fit.shade ?? 'mild',
    shadeAssumed: fit.shade === undefined,
    stung: shelf.find((i) => i.stung),
    usedAcids: shelf.some(hasAcid),
    usesCream: fit.hairRemoval === 'cream' || shelf.some((i) => i.classes.includes('depilatory')),
    fragrancedDeo: shelf.some(
      (i) => onUnderarm(i) && i.classes.includes('fragrance') && (i.classes.includes('antiperspirant') || i.classes.includes('drying-alcohol')),
    ),
    sweatKeeper: input.keepsAntiperspirantForSweat === true,
  };
}

function pregnancyIsNo(p: PregnancyAnswer | undefined): boolean {
  return p === 'no';
}

/**
 * True when the pregnancy question must be asked before the pick can include retinol (FR-M4-03): the
 * pick table reaches row 5 (much darker), or the sweat-antiperspirant add-on would offer the cream, and she
 * has not answered yet. Until then, pickProduct treats the missing answer like "Prefer not to say".
 */
export function pregnancyQuestionNeeded(input: PickInput): boolean {
  if (input.pregnancy !== undefined) return false;
  const p = pickProduct({ ...input, pregnancy: 'no' });
  return (p.pick !== null && hasRetinol(p.pick)) || p.alsoOffer !== undefined;
}

function whyNot(pick: BodywiseProductId | null, lines: Partial<Record<BodywiseProductId, string>>): WhyNotLine[] {
  return RANGE.filter((id) => id !== pick).map((id) => ({
    productId: id,
    line: lines[id] ?? '',
    priceInr: productPrice(id),
  }));
}

function shadeReason(f: Facts): string {
  if (f.shadeAssumed) return "You didn't say how dark it is, so this starts with the gentlest option.";
  switch (f.shade) {
    case 'severe':
      return 'Much darker, 3 or more shades.';
    case 'moderate':
      return 'Clearly darker, not 3+ shades: a roll-on is enough.';
    case 'mild':
      return `${shadeInfo('mild').label}: the gentlest roll-on is enough.`;
    default:
      return `${shadeInfo('same').label}.`;
  }
}

function cheaperLines(creamLine: string, rollon6: string): Partial<Record<BodywiseProductId, string>> {
  return { 'bw-rollon-6': rollon6, 'bw-kit-4': KIT_SHADES_LINE, 'bw-repair-cream': creamLine, 'bw-kit-6': KIT6_LINE };
}

function creamLineFor(shelf: ShelfItem[]): string {
  return shelf.some((i) => i.classes.includes('antiperspirant') && i.antiperspirantFor === 'smell') ? CREAM_SMELL_LINE : CREAM_LINE;
}

/**
 * "Your Bodywise match": first matching row of the pick table in solution/shelf-check-spec.md wins.
 * Returns one pick plus a why-not line for every other product. Never a gate.
 * Worked example: Riya -> bw-rollon-4, No Fragrance (row 8). Row 1 and row 4 return pick null with noPickReason.
 *
 * Decisions: B9 (row 3 only for an acid used on underarms only; a product on underarms and elsewhere does not
 * trigger it and the table runs as normal); row 7 also needs "does not use hair removal cream", otherwise row 8's
 * cream clause could never fire; a missing pregnancy answer counts as "Prefer not to say" (no retinol until she says no);
 * a missing shade counts as "a little darker"; the sweat add-on only offers the cream after pregnancy = no.
 */
export function pickProduct(input: PickInput): ProductPick {
  const f = facts(input);
  const { shelf } = input;
  const hormoneNote = runFit(input.fit).hormoneNote;
  const rank = shadeInfo(f.shade).rank;
  const noFragrance = f.stung !== undefined || f.fragrancedDeo;
  const base = { hormoneNote, doctorFirst: false };

  // Row 1: steroid, hydroquinone or bleach on underarms.
  const stopItem = shelf.find((i) => onUnderarm(i) && i.classes.some((c) => c === 'steroid' || c === 'hydroquinone' || c === 'bleach'));
  if (stopItem) {
    const line = `After you've stopped ${stopItem.product}.`;
    return {
      ...base,
      pick: null,
      noPickReason: 'sort-first',
      ruleRow: 1,
      baseRow: 1,
      headline: 'Sort this first.',
      why: [`${stopItem.product} should be stopped on your underarms before any acid. You can still buy now.`],
      whyNot: whyNot(null, { 'bw-rollon-4': line, 'bw-rollon-6': line, 'bw-kit-4': line, 'bw-repair-cream': line, 'bw-kit-6': line }),
      doctorFirst: true,
    };
  }

  // Row 2: already owns a Bodywise roll-on or kit.
  const owned = shelf.find((i) => i.catalogId !== undefined && isBodywisePick(i.catalogId) && hasRollOn(i.catalogId));
  if (owned && owned.catalogId && isBodywisePick(owned.catalogId)) {
    const id = owned.catalogId;
    const stepUps: Partial<Record<BodywiseProductId, string>> =
      id === 'bw-rollon-4'
        ? cheaperLines(CREAM_LINE, `A step up for later: ${STEP_UP_LINE.toLowerCase()}`)
        : { 'bw-rollon-4': "Gentler, if yours turns out too strong.", 'bw-rollon-6': 'You may already have this one.', 'bw-kit-4': KIT_SHADES_LINE, 'bw-repair-cream': CREAM_LINE, 'bw-kit-6': KIT6_LINE };
    return {
      ...base,
      pick: id,
      ruleRow: 2,
      baseRow: 2,
      headline: 'You already have it. Start your Fair Trial with it.',
      why: [`${productName(id)} is on your shelf, so there is nothing to buy to begin.`],
      whyNot: whyNot(id, stepUps),
      priceInr: productPrice(id),
    };
  }

  // Row 3: another acid used on underarms only (B9: not when it also goes elsewhere).
  const stacked = shelf.find((i) => hasAcid(i) && onUnderarm(i) && i.areas.every((a) => a === 'underarm'));
  if (stacked) {
    return rollOnPick(
      input,
      f,
      3,
      "Don't stack acids.",
      [`Finish a fair trial of ${stacked.product}, or switch to the roll-on and stop it.`],
      'bw-rollon-4',
      noFragrance,
      base.hormoneNote,
      cheaperLines(creamLineFor(shelf), STEP_UP_LINE),
    );
  }

  // Row 4: about the same.
  if (f.shade === 'same' && !f.shadeAssumed) {
    return {
      ...base,
      pick: null,
      noPickReason: 'may-not-need',
      ruleRow: 4,
      baseRow: 4,
      headline: 'For darkness, you may not need it.',
      why: ['If smell is the reason, the 4% roll-on works as a deodorant.'],
      whyNot: whyNot(null, {
        'bw-rollon-4': 'Works as a deodorant if smell is the reason.',
        'bw-rollon-6': 'More than you need.',
        'bw-kit-4': 'For darker underarms than yours.',
        'bw-repair-cream': 'For darker underarms than yours.',
        'bw-kit-6': 'For darker underarms than yours.',
      }),
    };
  }

  const reasons = (extra: string[]): string[] => [shadeReason(f), ...extra].slice(0, 3);
  const gentleReasons: string[] = [];
  if (f.stung) gentleReasons.push(`${f.stung.product} stung you once, so: gentler acids, no fragrance.`);
  else if (f.fragrancedDeo) gentleReasons.push('You keep a fragranced spray, so: no fragrance.');
  if (f.usesCream) gentleReasons.push('You use hair removal cream, which leaves skin sensitive.');
  if (!f.usedAcids) gentleReasons.push("You haven't used exfoliating acids before, so start gentle.");

  // Row 5 and 6: much darker.
  if (rank === 3) {
    if (pregnancyIsNo(input.pregnancy)) {
      return {
        ...base,
        pick: 'bw-kit-4',
        ruleRow: 5,
        baseRow: 5,
        headline: 'A kit, for 3+ shades darker.',
        why: reasons(['4% roll-on in the morning, repair cream at night.']),
        whyNot: whyNot('bw-kit-4', {
          'bw-rollon-4': 'Already in the kit.',
          'bw-rollon-6': 'On its own may not be enough at 3+ shades.',
          'bw-repair-cream': 'Already in the kit.',
          'bw-kit-6': `Step up only if the kit is gentle on you but slow at week ${STEP_UP_WEEK}.`,
        }),
        priceInr: productPrice('bw-kit-4'),
      };
    }
    return {
      ...base,
      pick: 'bw-rollon-4',
      variant: 'no-fragrance',
      ruleRow: 6,
      baseRow: 6,
      headline: 'Start gentle. Step up later.',
      why: reasons(['The kits have retinol, so a doctor should say first. The roll-on is the safe start.']),
      whyNot: whyNot('bw-rollon-4', {
        'bw-rollon-6': STEP_UP_LINE,
        'bw-kit-4': RETINOL_LINE,
        'bw-repair-cream': RETINOL_LINE,
        'bw-kit-6': RETINOL_LINE,
      }),
      doctorFirst: true,
      priceInr: productPrice('bw-rollon-4'),
    };
  }

  // Row 7: clearly darker, no sting, has used acids (and, see above, no hair removal cream).
  if (rank === 2 && !f.stung && f.usedAcids && !f.usesCream) {
    const out: ProductPick = {
      ...base,
      pick: 'bw-rollon-6',
      ruleRow: 7,
      baseRow: 7,
      headline: 'A stronger start, since your skin has handled acids.',
      why: reasons(["You've used exfoliating acids before without a sting."]),
      whyNot: whyNot('bw-rollon-6', {
        'bw-rollon-4': "Gentler, if you'd rather start soft.",
        'bw-kit-4': 'For 3+ shades darker.',
        'bw-repair-cream': creamLineFor(shelf),
        'bw-kit-6': 'For 3+ shades darker.',
      }),
      priceInr: productPrice('bw-rollon-6'),
    };
    if (noFragrance) out.variant = 'no-fragrance';
    return withSweatAddOn(out, input, f);
  }

  // Row 8: clearly darker, but stung before, or new to acids, or uses hair removal cream.
  // Row 9: a little darker.
  const row = rank === 2 ? 8 : 9;
  const lines = cheaperLines(creamLineFor(shelf), row === 8 ? STEP_UP_LINE : 'More than you need.');
  const out: ProductPick = {
    ...base,
    pick: 'bw-rollon-4',
    ruleRow: row,
    baseRow: row,
    headline: 'Start gentle. Step up later.',
    why: reasons(row === 8 ? gentleReasons : []),
    whyNot: whyNot('bw-rollon-4', lines),
    priceInr: productPrice('bw-rollon-4'),
  };
  if (noFragrance) out.variant = 'no-fragrance';
  return withSweatAddOn(out, input, f);
}

/** Row 3 helper: the roll-on pick with its own headline. */
function rollOnPick(
  input: PickInput,
  f: Facts,
  row: number,
  headline: string,
  why: string[],
  id: BodywiseProductId,
  noFragrance: boolean,
  hormoneNote: boolean,
  lines: Partial<Record<BodywiseProductId, string>>,
): ProductPick {
  const out: ProductPick = {
    pick: id,
    ruleRow: row,
    baseRow: row,
    headline,
    why: [...why, ...(f.stung ? [`${f.stung.product} stung you once, so: no fragrance.`] : [])].slice(0, 3),
    whyNot: whyNot(id, lines),
    doctorFirst: false,
    hormoneNote,
    priceInr: productPrice(id),
  };
  if (noFragrance) out.variant = 'no-fragrance';
  return withSweatAddOn(out, input, f);
}

/**
 * The "+" row: she keeps an antiperspirant for sweat, shade is at least clearly darker, and the pick is a
 * roll-on: also offer the Pigmentation Repair Cream at night. It has retinol, so only after pregnancy = no.
 */
function withSweatAddOn(pick: ProductPick, input: PickInput, f: Facts): ProductPick {
  const isRollOn = pick.pick !== null && !hasRetinol(pick.pick);
  const darkEnough = shadeInfo(f.shade).rank >= 2;
  if (!f.sweatKeeper || !isRollOn || !darkEnough || !pregnancyIsNo(input.pregnancy)) return pick;
  const why = [...pick.why];
  if (why.length < 3) why.push('No odour control, so keep your antiperspirant for mornings.');
  return {
    ...pick,
    ruleRow: 'extra-cream',
    baseRow: pick.baseRow,
    alsoOffer: 'bw-repair-cream',
    why,
  };
}
