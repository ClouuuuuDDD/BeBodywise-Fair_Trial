/** Open variables (spec 4, 3.7, 3.8): shelf products that may blur whether the trial product worked. Derived, never stored. Pure. */
import type { BodywiseProductId, ShelfItem } from '../contracts';

export interface OpenVariable {
  id: string;
  name: string;
  /** kept = the review said pause or stop and she kept using it; unchecked = no ok review yet. */
  why: 'kept' | 'unchecked';
}

/** The routine screen asks her to choose pause or keep for these. */
export function needsTrialChoice(item: ShelfItem): boolean {
  return item.review?.status === 'ok' && (item.review.action === 'pause-during-trial' || item.review.action === 'stop-on-skin');
}

export function openVariables(shelf: ShelfItem[], trialProduct?: BodywiseProductId): OpenVariable[] {
  const out: OpenVariable[] = [];
  for (const i of shelf) {
    if (trialProduct && i.catalogId === trialProduct) continue;
    if (i.review?.status !== 'ok') out.push({ id: i.id, name: i.product, why: 'unchecked' });
    else if (needsTrialChoice(i) && i.trialChoice === 'keep') out.push({ id: i.id, name: i.product, why: 'kept' });
  }
  return out;
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
