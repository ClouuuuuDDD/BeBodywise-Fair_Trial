import type {
  BodyArea,
  BodywiseProductId,
  ClassifiedIngredient,
  IngredientClass,
  ShelfAnswer,
  ShelfAnswerKind,
  ShelfItem,
} from '../contracts';
import { ingredientsOfClass } from './classifyIngredients';
import { ingredientRules } from './data';
import { hasRollOn } from './products';
import { catalogIngredients, productClasses } from './shelf';

/** One entry of `pair_rules` in ingredient-rules.json (the rows have slightly different keys). */
interface PairRuleDef {
  id: string;
  if: string[];
  area?: string;
  same_area?: boolean;
  same_time?: boolean;
  answer: ShelfAnswerKind;
  say?: string;
  say_smell?: string;
  say_sweat?: string;
  ask?: string;
  priority: number;
}

const RULES = ingredientRules.pair_rules as unknown as PairRuleDef[];

/** FR-M3-09 / RC-11: never claim a number of hours of odour control. Replaces say_smell in the JSON. */
export const SMELL_LINE = 'The roll-on also works as a deodorant. You may not need both.';

/** Ids used for rows that no JSON rule decided. */
export const DEFAULT_RULE_IDS = {
  anchorItself: 'anchor-itself',
  notOnUnderarms: 'not-on-underarms',
  noClash: 'no-clash',
} as const;

const FINE_PRIORITY = 5;

function tokenMatches(token: string, classes: readonly IngredientClass[], anchorHasRollOn: boolean): boolean {
  return token.split('|').some((t) => (t === 'bodywise-rollon' ? anchorHasRollOn : classes.includes(t as IngredientClass)));
}

function tokenClasses(token: string): IngredientClass[] {
  return token.split('|').filter((t) => t !== 'bodywise-rollon') as IngredientClass[];
}

function humanList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "glycolic acid", "lactic, salicylic and mandelic acids", or the names as written for anything else. */
function phrase(ings: ClassifiedIngredient[]): string {
  const names = ings.map((i) => i.inci);
  const allAcids = ings.length > 0 && ings.every((i) => i.classes.includes('aha') || i.classes.includes('bha'));
  if (!allAcids) return humanList(names);
  const stems = names.map((n) => n.replace(/\s+acid$/i, '').toLowerCase());
  return `${humanList(stems)} ${stems.length > 1 ? 'acids' : 'acid'}`;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

interface Match {
  rule: PairRuleDef;
  /** The ingredient on her product that the line names. */
  ingredient?: ClassifiedIngredient;
  values: Record<string, string>;
}

function matchRule(rule: PairRuleDef, item: ShelfItem, anchorIngs: ClassifiedIngredient[], anchorClasses: IngredientClass[], anchorRollOn: boolean): Match | null {
  const onUnderarm = item.areas.includes('underarm');
  const [first, second] = rule.if;
  if (first === undefined) return null;
  const otherAreas = item.areas.filter((a): a is Exclude<BodyArea, 'underarm'> => a !== 'underarm');
  const base: Record<string, string> = {
    product: item.product,
    product_b: item.product,
    other: item.product,
    other_areas: humanList(otherAreas),
  };

  if (second === undefined) {
    if (!tokenMatches(first, item.classes, false)) return null;
    if (rule.area === 'underarm' && !onUnderarm) return null;
    const ing = ingredientsOfClass(item.ingredients, tokenClasses(first))[0];
    return { rule, ingredient: ing, values: { ...base, ingredient: ing?.inci ?? '' } };
  }

  // Two-part rule: first token is the roll-on side, second token is her product.
  if (!tokenMatches(first, anchorClasses, anchorRollOn)) return null;
  if (!tokenMatches(second, item.classes, false)) return null;
  if (rule.same_area && !onUnderarm) return null;
  // same_time is deliberately ignored: decisions B9, "Different times" fires whenever both touch the same area.
  const mine = ingredientsOfClass(item.ingredients, tokenClasses(second));
  const theirs = ingredientsOfClass(anchorIngs, tokenClasses(first));
  const symmetric = first === second;
  const a = symmetric ? mine : theirs;
  const b = symmetric ? theirs : mine;
  return {
    rule,
    ingredient: mine[0],
    values: { ...base, ingredient: mine[0]?.inci ?? '', ingredient_a: phrase(a), ingredient_b: phrase(b) },
  };
}

function reasonFor(match: Match, item: ShelfItem, all: Match[]): string {
  const { rule, values } = match;
  let text: string;
  if (rule.say_smell !== undefined || rule.say_sweat !== undefined) {
    text = item.antiperspirantFor === 'smell' ? SMELL_LINE : fill(rule.say_sweat ?? '', values);
  } else {
    let template = rule.say ?? '';
    if (values.other_areas === '') {
      // Underarms only: nowhere else for it to stay, so say the pick-table row 3 line instead.
      template = template.replace(
        /\s*\{other\} can stay on your \{other_areas\}\./,
        ' Finish a fair trial of {other}, or switch to the roll-on and stop it.',
      );
    }
    text = fill(template, values);
  }
  // The antiperspirant note rides along when it did not decide the row but gives the same answer.
  const extra = all.find((m) => m.rule.id !== rule.id && m.rule.ask === 'sweat-or-smell' && m.rule.answer === rule.answer);
  if (extra && rule.ask !== 'sweat-or-smell') {
    const line = item.antiperspirantFor === 'smell' ? SMELL_LINE : item.antiperspirantFor ? fill(extra.rule.say_sweat ?? '', extra.values) : '';
    if (line) text = `${text} ${line}`;
  }
  return text.replace(/\s+/g, ' ').trim();
}

function defaultRow(item: ShelfItem, ruleId: string, reason: string): ShelfAnswer {
  return { itemId: item.id, answer: 'fine', ruleId, reason, priority: FINE_PRIORITY };
}

/**
 * Runs the pair rules in ingredient-rules.json for each shelf item against the anchor product (the pick,
 * or the Bodywise product she owns), per area. One row per item; lowest priority number wins, ties go to
 * the rule listed first in the JSON. Face-only (or body-only) products never clash. Rows with "Stop and ask a
 * doctor" come first, the rest keep shelf order. "Different times" rules ignore the times she gave (decisions
 * B9); the start plan splits them. Placeholder rules, to be signed by a dermatologist.
 */
export function pairRules(shelf: ShelfItem[], anchor: BodywiseProductId): ShelfAnswer[] {
  const anchorIngs = catalogIngredients(anchor);
  const anchorClasses = productClasses(anchor);
  const anchorRollOn = hasRollOn(anchor);

  const rows = shelf.map((item): ShelfAnswer => {
    if (item.catalogId === anchor) {
      return defaultRow(item, DEFAULT_RULE_IDS.anchorItself, `${item.product} is the product you are starting with.`);
    }
    const matches = RULES.map((r) => matchRule(r, item, anchorIngs, anchorClasses, anchorRollOn)).filter(
      (m): m is Match => m !== null,
    );
    const winner = matches.reduce<Match | undefined>(
      (best, m) => (best === undefined || m.rule.priority < best.rule.priority ? m : best),
      undefined,
    );
    if (!winner) {
      return item.areas.includes('underarm')
        ? defaultRow(item, DEFAULT_RULE_IDS.noClash, `Nothing on the ${item.product} label clashes with the roll-on.`)
        : defaultRow(item, DEFAULT_RULE_IDS.notOnUnderarms, `${item.product} stays off your underarms, so it can't clash with the roll-on.`);
    }
    const row: ShelfAnswer = {
      itemId: item.id,
      answer: winner.rule.answer,
      ruleId: winner.rule.id,
      reason: reasonFor(winner, item, matches),
      priority: winner.rule.priority,
    };
    if (winner.ingredient) row.ingredient = winner.ingredient.inci;
    return row;
  });

  // Stop-and-ask rows first (AC-05-5); everything else keeps the order she added products in.
  const stop = rows.filter((r) => r.answer === 'stop-ask');
  return [...stop, ...rows.filter((r) => r.answer !== 'stop-ask')];
}
