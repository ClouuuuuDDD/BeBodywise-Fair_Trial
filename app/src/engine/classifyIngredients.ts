import type { ClassifiedIngredient, IngredientClass } from '../contracts';
import { DRYING_ALCOHOL_MAX_POSITION, LABEL_MIN_INGREDIENTS } from './config';
import { ingredientRules } from './data';

/** Lower case, brackets, percentages and punctuation stripped, spaces collapsed. Hyphens stay (3-o-ethyl ascorbic acid). */
export function normaliseInci(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d+(?:[.,]\d+)?\s*%/g, ' ')
    .replace(/[^a-z0-9\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Synonym (normalised) -> classes, built once from ingredient-rules.json. */
const SYNONYMS: Map<string, IngredientClass[]> = (() => {
  const map = new Map<string, IngredientClass[]>();
  for (const [cls, def] of Object.entries(ingredientRules.classes)) {
    for (const m of def.match) {
      const key = normaliseInci(m);
      const list = map.get(key) ?? [];
      list.push(cls as IngredientClass);
      map.set(key, list);
    }
  }
  return map;
})();

/** Splits on commas that are not inside brackets. */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** "A (and) B" and "A & B" are one chip but several ingredients for matching. */
function splitCombo(item: string): string[] {
  return item.split(/\s*\(\s*and\s*\)\s*|\s+&\s+/i).filter((p) => p.trim() !== '');
}

function classesForPart(part: string): IngredientClass[] {
  const exact = normaliseInci(part);
  const direct = SYNONYMS.get(exact);
  if (direct) return direct;
  // "SD Alcohol 40-B", "Alcohol Denat 40": drop a trailing grade number.
  const graded = exact.replace(/\s+\d+(?:-[a-z])?$/, '');
  return SYNONYMS.get(graded) ?? [];
}

function cleanList(text: string): string {
  return text.replace(/^\s*(?:ingredients?|inci)\s*[:-]\s*/i, '').replace(/[.\s]+$/, '');
}

function joinInput(inci: string | string[]): string {
  return cleanList(Array.isArray(inci) ? inci.map((s) => s.trim()).join(', ') : inci);
}

/**
 * Parses an INCI list (string with commas, or an array) and maps each ingredient to classes in
 * ingredient-rules.json: case-insensitive, punctuation and percentages stripped, synonyms matched.
 * Drying alcohol counts only within the first DRYING_ALCOHOL_MAX_POSITION; fatty alcohols never
 * (matching is exact, and cetyl, cetearyl, cetostearyl and stearyl alcohol are not synonyms).
 */
export function classifyIngredients(inci: string | string[]): ClassifiedIngredient[] {
  const items = splitTopLevel(joinInput(inci))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s !== '');
  return items.map((item, position) => {
    const parts = splitCombo(item);
    const found = new Set<IngredientClass>();
    for (const part of parts) for (const c of classesForPart(part)) found.add(c);
    if (position >= DRYING_ALCOHOL_MAX_POSITION) found.delete('drying-alcohol');
    return {
      inci: item,
      normalised: parts.map(normaliseInci).join(' + '),
      classes: [...found],
      position,
    };
  });
}

/** Why a label read needs a retake. */
export type RetakeReason = 'no-commas' | 'too-few';

/** Result of reading a label: the classified list and whether to ask for a retake. */
export interface LabelParse {
  /** Classified ingredients (may be empty). */
  ingredients: ClassifiedIngredient[];
  /** Number of ingredients parsed. */
  count: number;
  /** True when she should retake: no commas, or fewer than LABEL_MIN_INGREDIENTS (FR-M3-04). */
  needsRetake: boolean;
  /** Reason for the retake, else null. */
  retakeReason: RetakeReason | null;
}

/**
 * Label read check (spec "Reading labels"): fewer than LABEL_MIN_INGREDIENTS ingredients, or no commas,
 * means "Hold it flat, closer, in daylight". She still confirms what was read before any rule runs.
 */
export function readLabel(inci: string | string[]): LabelParse {
  const text = joinInput(inci);
  const ingredients = classifyIngredients(text);
  const noCommas = !text.includes(',');
  const tooFew = ingredients.length < LABEL_MIN_INGREDIENTS;
  const retakeReason: RetakeReason | null = noCommas ? 'no-commas' : tooFew ? 'too-few' : null;
  return { ingredients, count: ingredients.length, needsRetake: retakeReason !== null, retakeReason };
}

/** Union of classes across a list, in order of first appearance. */
export function classesOf(ingredients: ClassifiedIngredient[]): IngredientClass[] {
  const seen = new Set<IngredientClass>();
  for (const ing of ingredients) for (const c of ing.classes) seen.add(c);
  return [...seen];
}

/** Ingredients that carry any of the given classes. */
export function ingredientsOfClass(
  ingredients: ClassifiedIngredient[],
  wanted: readonly IngredientClass[],
): ClassifiedIngredient[] {
  return ingredients.filter((ing) => ing.classes.some((c) => wanted.includes(c)));
}

/** Classes not highlighted as "actives" on the confirm screen. */
const NOT_HIGHLIGHTED: readonly IngredientClass[] = ['soothing'];

/**
 * Plain-words line for a highlighted ingredient on 04b, e.g. "Glycolic Acid: an exfoliating acid, like the roll-on".
 * Returns null when the ingredient is inert for the rules.
 */
export function activeNote(ingredient: ClassifiedIngredient): string | null {
  const cls = ingredient.classes.find((c) => !NOT_HIGHLIGHTED.includes(c));
  if (!cls) return null;
  if (cls === 'aha' || cls === 'bha') return `${ingredient.inci}: an exfoliating acid, like the roll-on`;
  return `${ingredient.inci}: ${ingredientRules.classes[cls].label.toLowerCase()}`;
}
