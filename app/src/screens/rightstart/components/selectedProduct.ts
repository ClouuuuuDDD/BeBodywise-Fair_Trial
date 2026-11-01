import type { BodywiseProductId } from '../../../contracts';
import { DEFAULT_ANCHOR_PRODUCT } from '../../../engine/config';
import { isBodywisePick } from '../../../engine/products';

/** The product page opens the app with ?product=<catalogId>; anything else means the 4% roll-on (spec 3.1). */
export function parseSelectedProduct(raw: string | null): BodywiseProductId {
  return raw !== null && isBodywisePick(raw) ? raw : DEFAULT_ANCHOR_PRODUCT;
}
