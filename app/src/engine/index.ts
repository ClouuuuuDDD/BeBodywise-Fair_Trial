/** Engine public API. Pure functions: no React, no DOM, no storage. Owner: E2. */
export * as config from './config';
export { catalog, ingredientRules } from './data';
export type { Catalog, CatalogProduct, IngredientRules } from './data';
export { addDays, diffDays, formatDayMonth, isoWeek } from './dates';
export { fit, habitLine, hormonePattern } from './fit';
export { shade } from './shade';
export {
  activeNote,
  classesOf,
  classifyIngredients,
  ingredientsOfClass,
  normaliseInci,
  readLabel,
} from './classifyIngredients';
export type { LabelParse, RetakeReason } from './classifyIngredients';
export { catalogInci, catalogIngredients, makeShelfItem, productClasses, shelfItemFromCatalog } from './shelf';
export type { ShelfItemInput } from './shelf';
export { catalogEntry, productName, productPrice, productUrl } from './products';
export { DEFAULT_RULE_IDS, SMELL_LINE, pairRules } from './pairRules';
export { pickProduct, pregnancyQuestionNeeded } from './pickProduct';
export { startPlan } from './startPlan';
export { costIsEstimate, nextCheckDate, pauseEntries, trialClock, weeksInBucket } from './trialClock';
export { ESCALATION_LINE, suspectItem, triageReaction } from './triageReaction';
export { stepUpTarget, verdict } from './verdict';
export { makePlanCode } from './planCode';
export { fnv1a, rulesVersion } from './rulesVersion';
export { EXAMPLE_DATES, EXAMPLE_STOPS, RIYA_FIT, exampleState, riyaShelf } from './example';
