import { describe, expect, it } from 'vitest';
import { BARCODE_ENABLED, BOTTLE_DAYS, PRICE_ROLLON_4, PRICE_ROLLON_6, TRIAL_USE_DAYS } from './config';
import { catalog } from './data';

describe('engine config', () => {
  it('two bottles of the 4% roll-on cost about Rs 658 to a fair verdict (decisions H-02, H-03)', () => {
    const bottles = Math.ceil(TRIAL_USE_DAYS / BOTTLE_DAYS);
    expect(bottles).toBe(2);
    expect(bottles * PRICE_ROLLON_4).toBe(658);
  });

  it('prices match the synced catalog (solution/data is the source of truth)', () => {
    const byId = new Map(catalog.products.map((p) => [p.id, p]));
    expect(byId.get('bw-rollon-4')?.price_inr).toMatchObject({ '50ml': PRICE_ROLLON_4 });
    expect(byId.get('bw-rollon-6')?.price_inr).toMatchObject({ '50ml': PRICE_ROLLON_6 });
  });

  it('barcode lookup stays out of v1 (decisions G0-2)', () => {
    expect(BARCODE_ENABLED).toBe(false);
  });
});

describe('placeholder wording (X1-05)', () => {
  it('matches decisions.md exactly', async () => {
    const { PLACEHOLDER_RULES_LABEL } = await import('./config');
    expect(PLACEHOLDER_RULES_LABEL).toBe('Placeholder rules, to be signed by a dermatologist.');
  });
});
