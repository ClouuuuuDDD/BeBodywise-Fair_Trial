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

/** Her answer to a "differs" comparison, stored with the pair it answered. */
export type Decision = { selected: BodywiseProductId; best: BodywiseProductId; choice: BodywiseProductId };

/** The product she settled on, or undefined while a differing comparison is undecided. A decision only counts for the exact pair it was made for. */
export function resolveChoice(view: ChoiceView, decision: Decision | undefined): BodywiseProductId | undefined {
  if (view.kind !== 'differs') return view.chosen;
  return decision && decision.selected === view.selected && decision.best === view.best ? decision.choice : undefined;
}
