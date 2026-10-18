/**
 * Typed access to the rule and catalog data. The JSON files are copies of solution/data/*.json
 * made by scripts/sync-data.mjs (gitignored; never hand-edit them; edit solution/data/ instead).
 * Owner: E2.
 */
import catalogJson from '../data/bodywise-underarm-catalog.json';
import ingredientRulesJson from '../data/ingredient-rules.json';

/** The Bodywise underarm range with exact ingredient lists and list prices (scraped 17 Oct 2026). */
export const catalog = catalogJson;
/** Ingredient classes, answers, pair rules and conditional questions. Placeholder rules, to be signed by a dermatologist. */
export const ingredientRules = ingredientRulesJson;

export type Catalog = typeof catalogJson;
export type IngredientRules = typeof ingredientRulesJson;
export type CatalogProduct = Catalog['products'][number];
