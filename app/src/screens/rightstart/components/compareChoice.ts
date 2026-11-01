import type { BodywiseProductId, ProductPick } from '../../../contracts';
import { productPrice } from '../../../engine';

export type ChoiceView =
  | { kind: 'no-pick'; chosen: BodywiseProductId }
  | { kind: 'same'; chosen: BodywiseProductId }
  | { kind: 'differs'; selected: BodywiseProductId; best: BodywiseProductId; priceDiff: number };

/** Her pick vs the best fit from pickProduct (unchanged rules). priceDiff = best minus hers. */
export function compareChoice(selected: BodywiseProductId, pick: ProductPick): ChoiceView {
  if (pick.pick === null) return { kind: 'no-pick', chosen: selected };
  if (pick.pick === selected) return { kind: 'same', chosen: selected };
  return { kind: 'differs', selected, best: pick.pick, priceDiff: productPrice(pick.pick) - productPrice(selected) };
}

export function priceDiffLine(bestName: string, diff: number): string {
  if (diff === 0) return 'Same price.';
  return `${bestName} costs Rs ${Math.abs(diff)} ${diff > 0 ? 'more' : 'less'}.`;
}
