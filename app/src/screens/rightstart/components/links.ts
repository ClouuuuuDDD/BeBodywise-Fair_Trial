import type { BodywiseProductId, CatalogId } from '../../../contracts';
import { productName, productUrl } from '../../../engine';

/** Where "Talk to a Bodywise doctor" goes: one constant in ui/links.ts (decisions: Doctor link). */
export { DOCTOR_URL } from '../../../ui/links';

/** Product page on Be Bodywise (catalog URL). */
export function bodywiseUrl(id: CatalogId): string {
  return productUrl(id);
}

/** Outbound Amazon search for a product. No affiliate tag (FR-M4-05). */
export function amazonUrl(id: BodywiseProductId): string {
  return `https://www.amazon.in/s?k=${encodeURIComponent(`Be Bodywise ${productName(id)}`)}`;
}

/** Rupees with an Indian-style thousands comma: 1598 becomes "1,598". */
export function rupees(n: number): string {
  return n.toLocaleString('en-IN');
}
