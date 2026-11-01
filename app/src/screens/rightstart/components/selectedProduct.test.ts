import { describe, expect, it } from 'vitest';
import { parseSelectedProduct } from './selectedProduct';

describe('?product= (spec 3.1)', () => {
  it('accepts the five underarm picks', () => {
    for (const id of ['bw-rollon-4', 'bw-rollon-6', 'bw-repair-cream', 'bw-kit-4', 'bw-kit-6']) expect(parseSelectedProduct(id)).toBe(id);
  });
  it('falls back to the 4% roll-on for missing, unknown or non-underarm ids', () => {
    for (const raw of [null, '', 'bw-niacinamide-lotion', 'nope', 'BW-ROLLON-6 ']) expect(parseSelectedProduct(raw)).toBe('bw-rollon-4');
  });
});
