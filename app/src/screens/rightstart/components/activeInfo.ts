import type { ClassifiedIngredient, IngredientClass, ShelfItem } from '../../../contracts';
import { activeNote } from '../../../engine';

/** Tint, text and dot colour for an ingredient class, from the tokens. */
export interface ClassTone {
  bg: string;
  fg: string;
  dot: string;
}

const ROSE: ClassTone = { bg: 'var(--tint-rose)', fg: 'var(--rose-text)', dot: 'var(--pink)' };
const BUTTER: ClassTone = { bg: 'var(--butter-tint)', fg: 'var(--butter-text)', dot: '#C9A100' };
const BLUE: ClassTone = { bg: 'var(--tint-blue)', fg: 'var(--primary-press)', dot: 'var(--primary)' };
const PEACH: ClassTone = { bg: 'var(--tint-peach)', fg: 'var(--peach-text)', dot: 'var(--orange)' };
const MINT: ClassTone = { bg: 'var(--tint-mint)', fg: 'var(--teal-text)', dot: 'var(--teal)' };
const LILAC: ClassTone = { bg: 'var(--tint-lilac)', fg: 'var(--violet)', dot: 'var(--violet)' };

const TONES: Record<IngredientClass, ClassTone> = {
  aha: ROSE,
  bha: ROSE,
  pha: ROSE,
  retinoid: LILAC,
  'benzoyl-peroxide': ROSE,
  'vitamin-c-pure': PEACH,
  brightener: MINT,
  steroid: ROSE,
  hydroquinone: ROSE,
  depilatory: PEACH,
  antiperspirant: BLUE,
  'drying-alcohol': BUTTER,
  fragrance: BUTTER,
  'physical-scrub': PEACH,
  bleach: ROSE,
  soothing: MINT,
  sunscreen: BUTTER,
};

/** Colour set for a class. */
export function toneOf(cls: IngredientClass): ClassTone {
  return TONES[cls];
}

/** Classes worth a tag on a shelf row, most important first (soothing and fragrance are never tagged). */
const TAG_ORDER: IngredientClass[] = [
  'steroid',
  'hydroquinone',
  'bleach',
  'retinoid',
  'aha',
  'bha',
  'pha',
  'benzoyl-peroxide',
  'depilatory',
  'drying-alcohol',
  'antiperspirant',
  'vitamin-c-pure',
  'physical-scrub',
  'brightener',
  'sunscreen',
];

const TAG_WORD: Partial<Record<IngredientClass, string>> = {
  'drying-alcohol': 'Alcohol',
  antiperspirant: 'Aluminium',
  retinoid: 'Retinoid',
  steroid: 'Steroid',
  hydroquinone: 'Hydroquinone',
  bleach: 'Bleach',
  'benzoyl-peroxide': 'Benzoyl peroxide',
  'vitamin-c-pure': 'Vitamin C',
  'physical-scrub': 'Scrub',
  sunscreen: 'Sunscreen',
};

/** Sentence case for one ingredient name: "Glycolic Acid" becomes "Glycolic acid". */
export function sentence(text: string): string {
  const t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Short display name for an ingredient chip's key line: "Aloe Barbadensis Leaf Juice" becomes "aloe". */
function shortName(ing: ClassifiedIngredient): string {
  const n = ing.inci.toLowerCase();
  if (/^aloe/.test(n)) return 'aloe';
  return n.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Active tags for a shelf row: at most two, with their colours. */
export function tagsFor(item: ShelfItem): { label: string; tone: ClassTone }[] {
  const out: { label: string; tone: ClassTone }[] = [];
  for (const cls of TAG_ORDER) {
    if (!item.classes.includes(cls) || out.length >= 2) continue;
    const ing = item.ingredients.find((i) => i.classes.includes(cls));
    let label = TAG_WORD[cls];
    if (!label && ing) {
      if (cls === 'depilatory') label = /thioglycol/i.test(ing.inci) ? 'Thioglycolate' : sentence(ing.inci);
      else label = sentence(ing.inci.replace(/\s*\(.*?\)\s*/g, ' '));
    }
    if (label && !out.some((o) => o.label === label)) out.push({ label, tone: TONES[cls] });
  }
  return out;
}

/** The class that colours one ingredient chip on 04b (soothing and fragrance included), or null for inert ones. */
export function chipClass(ing: ClassifiedIngredient): IngredientClass | null {
  const priority = TAG_ORDER.filter((c) => ing.classes.includes(c));
  if (priority[0]) return priority[0];
  if (ing.classes.includes('fragrance')) return 'fragrance';
  if (ing.classes.includes('soothing')) return 'soothing';
  return null;
}

const ACTIVE_LINE: Partial<Record<IngredientClass, (name: string) => string>> = {
  aha: (n) => `${n}: an exfoliating acid, like the roll-on`,
  bha: (n) => `${n}: an exfoliating acid, like the roll-on`,
  retinoid: (n) => `${n}: a retinoid, a strong night active`,
  steroid: (n) => `${n}: a prescription steroid`,
  hydroquinone: (n) => `${n}: a prescription lightener`,
  depilatory: (n) => `${n}: a hair removal chemical`,
  antiperspirant: (n) => `${n}: an antiperspirant (aluminium)`,
  'drying-alcohol': (n) => `${n}: drying alcohol`,
  fragrance: (n) => `${n}: fragrance`,
  brightener: (n) => `${n}: a brightener`,
  sunscreen: (n) => `${n}: sunscreen`,
};

/** Plain-word active lines for 04b (copy s04b.active.*), grouped so the three soothing names share one line. */
export function activeLines(ingredients: ClassifiedIngredient[]): { cls: IngredientClass; text: string }[] {
  const lines: { cls: IngredientClass; text: string }[] = [];
  const soothing: string[] = [];
  for (const ing of ingredients) {
    const cls = chipClass(ing);
    if (!cls) continue;
    if (cls === 'soothing') {
      soothing.push(shortName(ing));
      continue;
    }
    const make = ACTIVE_LINE[cls];
    const name = sentence(ing.inci.replace(/\s*\(.*?\)\s*/g, ' '));
    const text = make ? make(name) : (activeNote(ing) ?? `${name}`);
    if (!lines.some((l) => l.text === text)) lines.push({ cls, text });
  }
  if (soothing.length > 0) {
    const joined = soothing.join(', ');
    lines.push({ cls: 'soothing', text: `${joined.charAt(0).toUpperCase()}${joined.slice(1)}: soothing` });
  }
  return lines;
}
