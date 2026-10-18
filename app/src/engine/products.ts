/** Catalog lookups shared by the engine modules: names, prices, urls. Data comes from the synced catalog JSON. */
import type { BodywiseProductId, CatalogId } from '../contracts';
import { KIT_IDS, LIST_PRICE_INR, RETINOL_PRODUCT_IDS, ROLLON_IDS } from './config';
import { catalog } from './data';

interface CatalogEntry {
  id: string;
  name: string;
  url: string;
  inci?: string;
  inci_short?: string;
  contains?: string[];
  mascot: string | string[];
}

const ENTRIES: CatalogEntry[] = [...catalog.products, ...catalog.related_not_for_underarm_darkness];

/** Raw catalog entry for an id. Throws for an unknown id (a programming error, not user input). */
export function catalogEntry(id: CatalogId): CatalogEntry {
  const entry = ENTRIES.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown catalog id: ${id}`);
  return entry;
}

/** Product name as Bodywise prints it. */
export function productName(id: CatalogId): string {
  return catalogEntry(id).name;
}

/** Product page URL from the catalog. */
export function productUrl(id: CatalogId): string {
  return catalogEntry(id).url;
}

/** List price in rupees (config constants; config.test.ts checks them against the catalog). */
export function productPrice(id: BodywiseProductId): number {
  return LIST_PRICE_INR[id];
}

/** True for the two roll-ons. */
export function isRollOn(id: string | undefined): boolean {
  return ROLLON_IDS.some((r) => r === id);
}

/** True for the two kits. */
export function isKit(id: string | undefined): boolean {
  return KIT_IDS.some((k) => k === id);
}

/** A roll-on or a kit (a kit contains a roll-on): the "bodywise-rollon" token in pair rules, and pick row 2. */
export function hasRollOn(id: string | undefined): boolean {
  return isRollOn(id) || isKit(id);
}

/** Products with retinol, which trigger the pregnancy question. */
export function hasRetinol(id: string | undefined): boolean {
  return RETINOL_PRODUCT_IDS.some((r) => r === id);
}

/** True for the five underarm picks (not the two related products). */
export function isBodywisePick(id: string | undefined): id is BodywiseProductId {
  return [...ROLLON_IDS, ...KIT_IDS, 'bw-repair-cream'].some((p) => p === id);
}
