/** Plan code (FR-M5-01): "FT-" plus PLAN_CODE_LENGTH characters from an unambiguous set. The random source is passed in. */
import { PLAN_CODE_ALPHABET, PLAN_CODE_LENGTH, PLAN_CODE_PREFIX } from './config';

/** @param random returns a number in [0, 1), e.g. Math.random or a seeded generator in tests. */
export function makePlanCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < PLAN_CODE_LENGTH; i++) {
    code += PLAN_CODE_ALPHABET.charAt(Math.floor(random() * PLAN_CODE_ALPHABET.length));
  }
  return `${PLAN_CODE_PREFIX}${code}`;
}
