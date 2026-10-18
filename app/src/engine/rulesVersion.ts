/** Stable hash of every rule value: config.ts constants plus both data files (events `rules_version`). Pure. */
import * as config from './config';
import { catalog, ingredientRules } from './data';

/** 32-bit FNV-1a of a string, as 8 hex characters. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Hash of the values in config.ts and the two rule JSON files. Changes whenever any rule value changes. */
export function rulesVersion(): string {
  return fnv1a(JSON.stringify([config, ingredientRules, catalog]));
}
