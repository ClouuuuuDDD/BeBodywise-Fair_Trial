import type { IngredientClass, ReactionReport, ShelfItem, TriageResult, TriageRuleId } from '../contracts';
import {
  AMBER_EVERY_OTHER_NIGHT_DAYS,
  DAYS_PER_WEEK,
  DEFAULT_ANCHOR_PRODUCT,
  GREEN_WINDOW_DAYS,
  PAUSE_DAYS,
  REACTION_SUSPECT_CLASSES,
} from './config';
import { pairRules } from './pairRules';

/** Escalation line shown on green and amber (FR-M8-04, copy s13.escalate). */
export const ESCALATION_LINE =
  'If it becomes painful, blisters or spreads, stop and show your skin file to a doctor.';

const FIX_FACE_ONLY = 'Face only from now.';
const FIX_KEEP_OFF = 'Keep it off your underarms while you use the roll-on.';

const pauseWord = (days: number) => `${days} days`;

function suspectClassOf(item: ShelfItem): IngredientClass | undefined {
  return REACTION_SUSPECT_CLASSES.find((c) => item.classes.includes(c));
}

/**
 * The shelf product to ask about (FR-M8-01): used on underarms, with a suspect class; the one the shelf
 * check ranked highest (lowest priority number) first, ties in shelf order.
 */
export function suspectItem(shelf: ShelfItem[]): ShelfItem | undefined {
  const rank = new Map(pairRules(shelf, DEFAULT_ANCHOR_PRODUCT).map((a) => [a.itemId, a.priority]));
  return shelf
    .filter((i) => i.areas.includes('underarm') && suspectClassOf(i) !== undefined)
    .map((item, order) => ({ item, order, priority: rank.get(item.id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.priority - b.priority || a.order - b.order)[0]?.item;
}

function decide(report: ReactionReport): { ruleId: TriageRuleId; light: TriageResult['light']; action: string[] } {
  const { symptoms, severity, useDay } = report;
  if (severity === 'painful') {
    return { ruleId: 'R1', light: 'red', action: ['Stop using it.', 'Show this to a doctor.'] };
  }
  if (symptoms.includes('bumps-rash') && severity === 'bothering') {
    return { ruleId: 'R2', light: 'red', action: ['Stop using it.', 'Show this to a doctor.'] };
  }
  if (severity === 'bothering' || (symptoms.includes('darker') && severity !== 'mild')) {
    return {
      ruleId: 'R3',
      light: 'amber',
      action: [
        `Pause for ${pauseWord(PAUSE_DAYS)}.`,
        `Then use it every other night for ${AMBER_EVERY_OTHER_NIGHT_DAYS === DAYS_PER_WEEK ? 'a week' : `${AMBER_EVERY_OTHER_NIGHT_DAYS} days`} before going back to every night.`,
      ],
    };
  }
  if (useDay <= GREEN_WINDOW_DAYS) {
    return {
      ruleId: 'R4',
      light: 'green',
      action: [`Common in the first ${GREEN_WINDOW_DAYS / DAYS_PER_WEEK} weeks.`, 'Keep going, skip a day if needed.'],
    };
  }
  return {
    ruleId: 'R5',
    light: 'green',
    action: ['Keep going, skip a day if needed.', `If it keeps happening, pause for ${pauseWord(PAUSE_DAYS)}.`],
  };
}

/**
 * Reaction desk (PRD 8.6), first match wins: R1 painful -> red; R2 bumps-rash + bothering -> red;
 * R3 bothering, or darker above mild -> amber (PAUSE_DAYS paused days); R4 mild within GREEN_WINDOW_DAYS
 * -> green; R5 mild after -> green. One shelf follow-up when an underarm product has aha, bha, retinoid,
 * drying-alcohol, depilatory, physical-scrub or fragrance (FR-M8-01/02), asked until she answers. Green and
 * amber show the escalation line. Placeholder rules, to be signed by a dermatologist.
 */
export function triageReaction(report: ReactionReport, shelf: ShelfItem[]): TriageResult {
  const { ruleId, light, action } = decide(report);
  const result: TriageResult = {
    ruleId,
    light,
    action,
    showDoctor: light === 'red',
    showEscalation: light !== 'red',
  };
  if (light === 'amber') result.pauseDays = PAUSE_DAYS;

  const suspect = suspectItem(shelf);
  if (report.usedSuspect === undefined) {
    if (suspect) result.followUp = { itemId: suspect.id, question: `Did you use your ${suspect.product} there?` };
  } else if (report.usedSuspect.answer === 'yes') {
    const item = shelf.find((i) => i.id === report.usedSuspect?.itemId);
    const cls = item ? suspectClassOf(item) : undefined;
    if (item && cls) {
      const alsoElsewhere = item.areas.includes('face');
      result.likelyCause = {
        itemId: item.id,
        product: item.product,
        ingredientClass: cls,
        fix: alsoElsewhere ? FIX_FACE_ONLY : FIX_KEEP_OFF,
      };
    }
  }
  return result;
}
