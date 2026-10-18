import type { BodywiseProductId, CatalogId, IngredientClass, ShelfItem } from '../../../contracts';
import { catalogEntry } from '../../../engine';
import { MASCOTS, type MascotId } from '../../../ui';

function isMascot(id: string | undefined): id is MascotId {
  return id !== undefined && id in MASCOTS;
}

/** Mascot for a catalog product (kits use their first character; `kitPair` gives both). */
export function mascotForCatalog(id: CatalogId): MascotId {
  const m = catalogEntry(id).mascot;
  const first = Array.isArray(m) ? m[0] : m;
  return isMascot(first) ? first : 'chemist-tube';
}

/** The two characters of a kit, else null. */
export function kitPair(id: BodywiseProductId): [MascotId, MascotId] | null {
  const m = catalogEntry(id).mascot;
  return Array.isArray(m) && isMascot(m[0]) && isMascot(m[1]) ? [m[0], m[1]] : null;
}

const has = (item: ShelfItem, c: IngredientClass) => item.classes.includes(c);

/** Which character stands for a shelf product: catalog art, else inferred from the classes and the name (ingredient-rules product_types). */
export function mascotForItem(item: ShelfItem): MascotId {
  if (item.catalogId) return mascotForCatalog(item.catalogId);
  if (isMascot(item.mascot)) return item.mascot;
  const name = item.product.toLowerCase();
  if (has(item, 'retinoid')) return 'retinol';
  if (has(item, 'depilatory')) return 'hair-removal';
  if (has(item, 'sunscreen') || /sunscreen|spf/.test(name)) return 'sunscreen';
  if (has(item, 'antiperspirant') || has(item, 'drying-alcohol')) {
    return /spray|mist|can/.test(name) || has(item, 'drying-alcohol') ? 'spray-can' : 'deodorant';
  }
  if (has(item, 'aha') || has(item, 'bha') || /toner|exfoliat|acid/.test(name)) return 'toner';
  if (/lotion|moisturi|body butter/.test(name)) return 'lotion';
  if (/serum/.test(name)) return 'serum';
  return 'chemist-tube';
}

/** The "worried" art variant for products that clash (Pick one here, Stop and ask). */
export function worriedFor(mascot: MascotId): MascotId {
  return mascot === 'toner' ? 'toner-worried' : mascot === 'rollon' ? 'rollon-worried' : mascot;
}
