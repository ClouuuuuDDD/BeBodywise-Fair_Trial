import type { BodywiseProductId, FitAnswers, ReviewContext, ShelfItem } from '../contracts';
import { catalogInci, productName } from '../engine';

/** Stays below the server's 16 KB cap with room for the keys. */
const MAX_CHARS = 15_000;

/**
 * What the shelf review may see (spec 5.1, D7): the target product, three fit answers, the products already on her
 * shelf as text, and what she said about this one. Never the neck or periods answers, never ids.
 */
export function buildReviewContext(input: {
  target: BodywiseProductId;
  fit: FitAnswers;
  shelf: ShelfItem[];
  thisProduct?: ReviewContext['thisProduct'];
}): ReviewContext {
  const her: ReviewContext['her'] = {};
  if (input.fit.shade) her.shade = input.fit.shade;
  if (input.fit.duration) her.duration = input.fit.duration;
  if (input.fit.hairRemoval) her.hairRemoval = input.fit.hairRemoval;
  const ctx: ReviewContext = {
    target: { name: productName(input.target), ingredients: catalogInci(input.target).slice(0, 4000) },
    her,
    shelfSoFar: input.shelf.slice(-12).map((i) => ({
      name: i.product.slice(0, 120),
      ingredients: i.ingredients.map((x) => x.inci).join(', ').slice(0, 4000),
      when: i.times,
      stung: i.stung,
    })),
    thisProduct: { ...(input.thisProduct ?? {}) },
  };
  if (ctx.thisProduct.frontName !== undefined) ctx.thisProduct.frontName = ctx.thisProduct.frontName.slice(0, 120);
  while (JSON.stringify(ctx).length > MAX_CHARS && ctx.shelfSoFar.length > 0) ctx.shelfSoFar.shift(); // oldest first
  return ctx;
}
