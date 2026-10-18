/** Builds ShelfItems (label, typed, or Bodywise catalog) and anchor class lists. Pure. */
import type {
  BodyArea,
  BodywiseProductId,
  CatalogId,
  ClassifiedIngredient,
  IngredientClass,
  ShelfItem,
  ShelfSource,
  UseTime,
} from '../contracts';
import { classesOf, classifyIngredients } from './classifyIngredients';
import { catalogEntry } from './products';

/** Everything needed to make a shelf item once she has confirmed what was read. */
export interface ShelfItemInput {
  /** Local id. */
  id: string;
  /** Product name. */
  product: string;
  /** How it was added. */
  source: ShelfSource;
  /** Confirmed INCI list (string or array). */
  inci: string | string[];
  /** Where she uses it. */
  areas: BodyArea[];
  /** When. */
  times: UseTime;
  /** "This has stung me". */
  stung?: boolean;
  /** Sweat-or-smell answer, if asked. */
  antiperspirantFor?: ShelfItem['antiperspirantFor'];
  /** Catalog id for Bodywise products. */
  catalogId?: CatalogId;
  /** Mascot key. */
  mascot?: string;
}

/** Makes a classified ShelfItem from confirmed text. */
export function makeShelfItem(input: ShelfItemInput): ShelfItem {
  const ingredients = classifyIngredients(input.inci);
  const item: ShelfItem = {
    id: input.id,
    product: input.product,
    source: input.source,
    ingredients,
    classes: classesOf(ingredients),
    areas: input.areas,
    times: input.times,
    stung: input.stung ?? false,
  };
  if (input.catalogId) item.catalogId = input.catalogId;
  if (input.antiperspirantFor) item.antiperspirantFor = input.antiperspirantFor;
  if (input.mascot) item.mascot = input.mascot;
  return item;
}

/** INCI text of a catalog product. Kits are their roll-on (minus Perfume if "No Fragrance") plus the cream. */
export function catalogInci(id: CatalogId): string {
  const entry = catalogEntry(id);
  if (entry.inci) return entry.inci;
  if (entry.contains) {
    return entry.contains
      .map((c) => {
        const childId = /^(bw-[a-z0-9-]+)/.exec(c)?.[1] as CatalogId;
        let text = catalogInci(childId);
        if (/no fragrance/i.test(c)) text = text.replace(/,\s*Perfume\b/i, '');
        return text;
      })
      .join(', ');
  }
  return entry.inci_short ?? '';
}

/** Classified ingredients of a catalog product. */
export function catalogIngredients(id: CatalogId): ClassifiedIngredient[] {
  return classifyIngredients(catalogInci(id));
}

/** Ingredient classes of a Bodywise product (the "anchor" side of the pair rules). */
export function productClasses(id: BodywiseProductId): IngredientClass[] {
  return classesOf(catalogIngredients(id));
}

/** Shelf item for a Bodywise catalog product: no label read needed (FR-M3-02). */
export function shelfItemFromCatalog(
  id: CatalogId,
  opts: { id?: string; areas: BodyArea[]; times: UseTime; stung?: boolean },
): ShelfItem {
  const entry = catalogEntry(id);
  const mascot = Array.isArray(entry.mascot) ? entry.mascot[0] : entry.mascot;
  return makeShelfItem({
    id: opts.id ?? id,
    product: entry.name,
    source: 'catalog',
    inci: catalogInci(id),
    areas: opts.areas,
    times: opts.times,
    stung: opts.stung,
    catalogId: id,
    mascot,
  });
}
