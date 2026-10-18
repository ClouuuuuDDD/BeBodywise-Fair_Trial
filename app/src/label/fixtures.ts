import { buildResult } from './readLabel';
import type { LabelReadResult } from './types';

/**
 * Cached reads for the example trial (works with no network). The three fictional shelf
 * products from solution/shelf-check-spec.md: third-party brands stay fictional.
 */
export interface LabelFixture {
  id: 'glow-toner' | 'fresh-bloom-spray' | 'silk-cream';
  name: string;
  brand: string;
  /** INCI as a label read would return it. */
  ingredientsText: string;
}

export const LABEL_FIXTURES: readonly LabelFixture[] = [
  {
    id: 'glow-toner',
    name: 'Glow 7% Glycolic Toner',
    brand: 'Glow',
    ingredientsText: 'Aqua, Glycolic Acid, Witch Hazel, Aloe, Glycerin, Parfum',
  },
  {
    id: 'fresh-bloom-spray',
    name: 'Fresh Bloom Deo Spray',
    brand: 'Fresh Bloom',
    ingredientsText: 'Alcohol Denat., Butane, Aluminium Chlorohydrate, Parfum',
  },
  {
    id: 'silk-cream',
    name: 'Silk Hair Removal Cream',
    brand: 'Silk',
    ingredientsText: 'Aqua, Potassium Thioglycolate, Calcium Hydroxide, Parfum',
  },
];

export function getFixture(id: LabelFixture['id']): LabelFixture {
  const f = LABEL_FIXTURES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown label fixture: ${id}`);
  return f;
}

/** The cached read for one fixture, shaped like a live read (source "cached"). */
export function cachedRead(id: LabelFixture['id'], kind: 'front' | 'ingredients' = 'ingredients'): LabelReadResult {
  const f = getFixture(id);
  return buildResult(kind, 'cached', { name: f.name, brand: f.brand, ingredientsText: f.ingredientsText });
}
