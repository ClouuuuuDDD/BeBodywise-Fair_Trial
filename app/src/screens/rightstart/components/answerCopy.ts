import type { ShelfAnswer, ShelfItem } from '../../../contracts';

/** A piece of an answer line; `strong` pieces are the ingredient names, set bold. */
export interface Piece {
  text: string;
  strong: boolean;
}

/** Splits a line written with **bold** markers into pieces. */
function parse(marked: string): Piece[] {
  return marked
    .split('**')
    .map((text, i) => ({ text, strong: i % 2 === 1 }))
    .filter((p) => p.text !== '');
}

/** Escape for a RegExp. */
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bolds the ingredient the engine's line names (the stem, so "Glycolic Acid" bolds "glycolic acid" and "glycolic"). */
function boldIngredient(reason: string, ingredient: string | undefined): Piece[] {
  if (!ingredient) return [{ text: reason, strong: false }];
  const stem = ingredient.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+acid$/i, '').trim();
  const re = new RegExp(`(${esc(ingredient)}|${esc(stem)})`, 'i');
  const m = re.exec(reason);
  if (!m) return [{ text: reason, strong: false }];
  return [
    { text: reason.slice(0, m.index), strong: false },
    { text: m[0], strong: true },
    { text: reason.slice(m.index + m[0].length), strong: false },
  ].filter((p) => p.text !== '');
}

/**
 * The line under each answer on 05. For the four worked-example rules the line is the copy.md text (s05.row.*),
 * which names the product and the ingredient; every other rule shows the engine's filled `say` template.
 */
export function answerLine(answer: ShelfAnswer, item: ShelfItem): Piece[] {
  const glycolic = item.ingredients.some((i) => /glycolic/i.test(i.inci));
  switch (answer.ruleId) {
    case 'acid-acid':
      if (glycolic && /toner/i.test(item.product) && item.areas.includes('face')) {
        return parse(
          'Both are exfoliating acids: **glycolic** in the toner, **lactic and salicylic** in the roll-on. Underarms get the roll-on. The toner stays on your face.',
        );
      }
      break;
    case 'acid-alcohol-spray':
      if (item.stung && item.antiperspirantFor === 'smell') {
        return parse(
          'Mostly **alcohol**, and it stung you once. The roll-on also works as a deodorant, so try it alone for a week. If you keep the spray, mornings only.',
        );
      }
      break;
    case 'acid-depilatory':
      return parse('**Thioglycolate** leaves skin raw underneath. Wait 2 days after it before any acid.');
    case 'brightener-any':
      if (item.ingredients.some((i) => /niacinamide/i.test(i.inci))) return parse('**Niacinamide** sits well with acids. Keep it.');
      break;
  }
  return boldIngredient(answer.reason, answer.ingredient);
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const word = (n: number) => WORDS[n] ?? String(n);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The 05 title (copy s05.title {summary}): "One swap, two habits.", "All fine together.", "Nothing else on your shelf. Simple start." */
export function summaryLine(answers: ShelfAnswer[]): string {
  if (answers.length === 0) return 'Nothing else on your shelf. Simple start.';
  const stop = answers.filter((a) => a.answer === 'stop-ask').length;
  const swaps = answers.filter((a) => a.answer === 'pick-one').length;
  const habits = answers.filter((a) => a.answer === 'split-time' || a.answer === 'wait').length;
  if (stop + swaps + habits === 0) return 'All fine together.';
  const parts: string[] = [];
  if (stop > 0) parts.push('sort one thing first');
  if (swaps > 0) parts.push(`${word(swaps)} ${swaps === 1 ? 'swap' : 'swaps'}`);
  if (habits > 0) parts.push(`${word(habits)} ${habits === 1 ? 'habit' : 'habits'}`);
  return `${cap(parts.join(', '))}.`;
}
