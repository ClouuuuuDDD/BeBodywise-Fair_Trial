import type {
  BodywiseProductId,
  FitAnswers,
  ProductPick,
  RoutineStep,
  ShelfAnswer,
  ShelfItem,
  StartPlan,
} from '../contracts';
import {
  APPLICATIONS_PER_DAY,
  DEFAULT_ANCHOR_PRODUCT,
  DEPILATORY_GAP_DAYS,
  PATCH_TEST_HOURS,
  SHAVE_GAP_MIN,
  STING_AFTER_SHAVE_MOVE_TO_NIGHT,
  WAX_GAP_H,
} from './config';
import { habitLine } from './fit';
import { isKit, isRollOn, productName } from './products';

const ROLLON_HOW = 'One swipe, on clean, dry skin.';
const CREAM_HOW = 'A pea-sized amount, on clean skin.';

/** Same hours-or-a-day wording for the patch test (24 hours reads "a day"). */
function waitWord(hours: number): string {
  return hours === 24 ? 'a day' : `${hours} hours`;
}

function rollOnName(id: BodywiseProductId, noFragrance: boolean): string {
  return noFragrance ? `${productName(id)}, No Fragrance` : productName(id);
}

function otherAreas(item: ShelfItem): string[] {
  return item.areas.filter((a) => a !== 'underarm');
}

function isDeodorant(item: ShelfItem): boolean {
  return item.classes.includes('antiperspirant') || item.classes.includes('drying-alcohol');
}

/**
 * Screen 07 routine (FR-M5-02): Night (the roll-on), Morning (her deodorant or "nothing else needed"),
 * Keep apart (each Pick one here / Leave a gap / Stop product with its line), then three rules: hair-removal
 * gap (SHAVE_GAP_MIN / WAX_GAP_H, "if it stings, use it at night instead"), patch test, sunscreen,
 * plus the once-a-day note. Products with "Different times" go in the other slot from the roll-on (decisions B9),
 * except retinoids and benzoyl peroxide, which go under Keep apart. A kit uses its own routine (roll-on in the
 * morning, cream at night). `productId` is the product she is trialling when it differs from the pick.
 * Placeholder rules, to be signed by a dermatologist.
 */
export function startPlan(
  pick: ProductPick,
  shelf: ShelfItem[],
  shelfAnswers: ShelfAnswer[],
  fit: FitAnswers,
  productId?: BodywiseProductId,
): StartPlan {
  const id = productId ?? pick.pick ?? DEFAULT_ANCHOR_PRODUCT;
  const noFragrance = pick.variant === 'no-fragrance' && id === pick.pick;
  const kit = isKit(id);

  const morning: RoutineStep[] = [];
  const night: RoutineStep[] = [];
  const keepApart: StartPlan['keepApart'] = [];

  if (kit) {
    const rollon: BodywiseProductId = id === 'bw-kit-6' ? 'bw-rollon-6' : 'bw-rollon-4';
    morning.push({ ref: rollon, product: rollOnName(rollon, id === 'bw-kit-4'), instruction: ROLLON_HOW });
    night.push({ ref: 'bw-repair-cream', product: productName('bw-repair-cream'), instruction: CREAM_HOW });
  } else if (isRollOn(id)) {
    night.push({ ref: id, product: rollOnName(id, noFragrance), instruction: ROLLON_HOW });
  } else {
    night.push({ ref: id, product: productName(id), instruction: CREAM_HOW });
  }

  const answerFor = new Map(shelfAnswers.map((a) => [a.itemId, a]));
  for (const item of shelf) {
    const answer = answerFor.get(item.id);
    if (!answer || !item.areas.includes('underarm')) continue;
    const others = otherAreas(item);
    switch (answer.answer) {
      case 'pick-one':
        keepApart.push({
          ref: item.id,
          product: item.product,
          reason: others.length > 0 ? `${others.join(' and ')} only while you use the roll-on.` : 'Stop it on your underarms while you use the roll-on.',
        });
        break;
      case 'wait':
        keepApart.push({ ref: item.id, product: item.product, reason: `Wait ${DEPILATORY_GAP_DAYS} days after it before the roll-on.` });
        break;
      case 'stop-ask':
        keepApart.push({ ref: item.id, product: item.product, reason: 'Stop using it on your underarms and ask a doctor first.' });
        break;
      case 'split-time':
        if (kit || item.classes.includes('retinoid') || item.classes.includes('benzoyl-peroxide')) {
          keepApart.push({ ref: item.id, product: item.product, reason: answer.reason });
        } else {
          morning.push({
            ref: item.id,
            product: item.product,
            instruction: isDeodorant(item) ? 'Your usual deodorant. Mornings only.' : 'Mornings only. The roll-on is for nights.',
          });
        }
        break;
      case 'fine':
        if (!kit && (item.times === 'morning' || item.times === 'both') && item.catalogId === undefined) {
          morning.push({ ref: item.id, product: item.product, instruction: 'Keep using it as you do.' });
        }
        break;
    }
  }
  if (morning.length === 0) {
    morning.push({ ref: 'none', product: 'Nothing else needed.', instruction: '' });
  }

  const rules = [
    `Shaved? Wait ${SHAVE_GAP_MIN[0]}-${SHAVE_GAP_MIN[1]} minutes. Waxed? Wait ${WAX_GAP_H[0]}-${WAX_GAP_H[1]} hours.${
      STING_AFTER_SHAVE_MOVE_TO_NIGHT ? ' If it stings, use it at night instead.' : ''
    }`,
    `Patch test a small spot on your inner arm first, and wait ${waitWord(PATCH_TEST_HOURS)}.`,
    'If your underarms see sun, use sunscreen there.',
  ];
  if (fit.hairRemoval === 'cream' && !shelf.some((i) => i.classes.includes('depilatory'))) {
    const line = habitLine('cream');
    if (line) rules.push(line);
  }

  const perDay = APPLICATIONS_PER_DAY === 1 ? 'Once a day' : `${APPLICATIONS_PER_DAY} times a day`;
  return {
    productId: id,
    morning,
    night,
    keepApart,
    rules,
    onceADayNote: `${perDay} for a fair trial. Bodywise allows twice a day.`,
  };
}
