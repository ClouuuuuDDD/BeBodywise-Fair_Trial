import { describe, expect, it, vi } from 'vitest';
import { LabelApiError, callReadLabelApi } from './api';
import { LABEL_FIXTURES, cachedRead } from './fixtures';
import { extractIngredientsFromOcr } from './ocr';
import { buildResult, eventStatus, readLabelPhoto, readTypedIngredients, type ReadDeps } from './readLabel';
import { targetSize } from './resize';
import type { ReadLabelApiResponse } from './types';

const photo = new Blob(['x'], { type: 'image/jpeg' });
const GOOD = 'Aqua, Glycolic Acid, Witch Hazel, Aloe, Glycerin, Parfum';

function deps(over: Partial<ReadDeps>): Partial<ReadDeps> {
  return {
    resize: async (b) => ({ blob: b, base64: '/9j/AAAA', width: 10, height: 10 }),
    ocr: async () => {
      throw new Error('ocr should not run');
    },
    ...over,
  };
}

const apiOk = (extra: Partial<ReadLabelApiResponse> = {}): ReadLabelApiResponse => ({
  ok: true,
  kind: 'ingredients',
  provider: 'gemini',
  ingredientsText: GOOD,
  ...extra,
});

describe('retake rule', () => {
  it('passes a real list', () => {
    const r = buildResult('ingredients', 'gemini', { ingredientsText: GOOD });
    expect(r.status).toBe('ok');
    expect(r.parse?.count).toBe(6);
  });
  it('retakes fewer than 4 ingredients', () => {
    const r = buildResult('ingredients', 'gemini', { ingredientsText: 'Aqua, Glycerin, Parfum' });
    expect(r.status).toBe('retake');
    expect(r.parse?.retakeReason).toBe('too-few');
  });
  it('retakes text with no commas', () => {
    const r = buildResult('ingredients', 'tesseract', { ingredientsText: 'Aqua Glycerin Parfum Aloe Water' });
    expect(r.status).toBe('retake');
    expect(r.parse?.retakeReason).toBe('no-commas');
  });
  it('typed text follows the same rule', () => {
    expect(readTypedIngredients(GOOD).status).toBe('ok');
    expect(readTypedIngredients('Aqua').status).toBe('retake');
  });
  it('empty text is manual', () => {
    expect(buildResult('ingredients', 'gemini', { ingredientsText: '  ' }).status).toBe('manual');
  });
});

describe('fixtures classify as the spec says', () => {
  const classes = (id: (typeof LABEL_FIXTURES)[number]['id']) =>
    new Set(cachedRead(id).parse?.ingredients.flatMap((i) => i.classes));

  it('has the three fictional labels, all passing the retake rule offline', () => {
    expect(LABEL_FIXTURES.map((f) => f.id)).toEqual(['glow-toner', 'fresh-bloom-spray', 'silk-cream']);
    for (const f of LABEL_FIXTURES) {
      const r = cachedRead(f.id);
      expect(r.status).toBe('ok');
      expect(r.source).toBe('cached');
    }
  });
  it('Glow toner: glycolic acid is an AHA, plus fragrance', () => {
    const c = classes('glow-toner');
    expect(c.has('aha')).toBe(true);
    expect(c.has('fragrance')).toBe(true);
  });
  it('Fresh Bloom spray: drying alcohol first, antiperspirant, fragrance', () => {
    const c = classes('fresh-bloom-spray');
    expect(c.has('drying-alcohol')).toBe(true);
    expect(c.has('antiperspirant')).toBe(true);
    expect(c.has('fragrance')).toBe(true);
  });
  it('Silk cream: depilatory, plus fragrance', () => {
    const c = classes('silk-cream');
    expect(c.has('depilatory')).toBe(true);
    expect(c.has('fragrance')).toBe(true);
  });
});

describe('readLabelPhoto fallback order', () => {
  it('uses the API when it works (no OCR)', async () => {
    const callApi = vi.fn(async () => apiOk());
    const r = await readLabelPhoto(photo, 'ingredients', deps({ callApi }));
    expect(r.source).toBe('gemini');
    expect(r.status).toBe('ok');
    expect(r.httpStatus).toBe(200);
    expect(eventStatus(r)).toBe('ok');
  });

  it('reports the OpenRouter provider the function used', async () => {
    const r = await readLabelPhoto(photo, 'ingredients', deps({ callApi: async () => apiOk({ provider: 'openrouter' }) }));
    expect(r.source).toBe('openrouter');
  });

  it('API error -> Tesseract.js', async () => {
    const ocr = vi.fn(async () => 'INGREDIENTS: Aqua, Glycerin, Niacinamide, Parfum, Aloe\nHow to use: apply daily');
    const r = await readLabelPhoto(
      photo,
      'ingredients',
      deps({
        callApi: async () => {
          throw new LabelApiError('x', 502, 'unreadable');
        },
        ocr,
      }),
    );
    expect(ocr).toHaveBeenCalledOnce();
    expect(r.source).toBe('tesseract');
    expect(r.usedOcr).toBe(true);
    expect(r.httpStatus).toBe(502);
    expect(r.ingredientsText).toBe('Aqua, Glycerin, Niacinamide, Parfum, Aloe');
    expect(eventStatus(r)).toBe('ocr-fallback');
  });

  it('API error and OCR error -> manual ("type it in")', async () => {
    const r = await readLabelPhoto(
      photo,
      'ingredients',
      deps({
        callApi: async () => {
          throw new LabelApiError('x', 0, 'network');
        },
        ocr: async () => {
          throw new Error('wasm failed');
        },
      }),
    );
    expect(r.status).toBe('manual');
    expect(r.source).toBeNull();
    expect(eventStatus(r)).toBe('error');
  });

  it('a short API read is a retake, not an OCR fallback', async () => {
    const r = await readLabelPhoto(photo, 'ingredients', deps({ callApi: async () => apiOk({ ingredientsText: 'Aqua, Parfum' }) }));
    expect(r.status).toBe('retake');
    expect(r.source).toBe('gemini');
    expect(eventStatus(r)).toBe('retake');
  });

  it('front side reads name and brand', async () => {
    const r = await readLabelPhoto(
      photo,
      'front',
      deps({ callApi: async () => ({ ok: true, kind: 'front', provider: 'gemini', name: 'Glow Toner', brand: 'Glow' }) }),
    );
    expect(r.status).toBe('ok');
    expect(r.name).toBe('Glow Toner');
    expect(r.parse).toBeNull();
  });

  it('resize failure still falls back to OCR on the original photo', async () => {
    const callApi = vi.fn();
    const r = await readLabelPhoto(
      photo,
      'ingredients',
      deps({
        resize: async () => {
          throw new Error('no canvas');
        },
        callApi,
        ocr: async () => 'Ingredients: Aqua, Glycerin, Aloe, Parfum',
      }),
    );
    expect(callApi).not.toHaveBeenCalled();
    expect(r.source).toBe('tesseract');
  });
});

describe('callReadLabelApi', () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it('retries once on a 5xx then succeeds', async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(502, { ok: false, error: 'unreadable' }))
      .mockResolvedValueOnce(json(200, apiOk()));
    const out = await callReadLabelApi('/9j/AAAA', 'ingredients', { fetchImpl: f });
    expect(out.ingredientsText).toBe(GOOD);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('retries once on a network error, then throws', async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    await expect(callReadLabelApi('/9j/AAAA', 'ingredients', { fetchImpl: f })).rejects.toMatchObject({ status: 0 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('does not retry 4xx or 503 (not set up)', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(json(429, { ok: false, error: 'rate_limited' }));
    await expect(callReadLabelApi('/9j/AAAA', 'ingredients', { fetchImpl: f })).rejects.toMatchObject({ status: 429 });
    expect(f).toHaveBeenCalledTimes(1);
    const g = vi.fn<typeof fetch>().mockResolvedValue(json(503, { ok: false, error: 'unavailable' }));
    await expect(callReadLabelApi('/9j/AAAA', 'ingredients', { fetchImpl: g })).rejects.toMatchObject({ status: 503 });
    expect(g).toHaveBeenCalledTimes(1);
  });

  it('treats a non-JSON body (dev server index.html) as a failure', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(callReadLabelApi('/9j/AAAA', 'ingredients', { fetchImpl: f, retries: 0 })).rejects.toBeInstanceOf(LabelApiError);
  });
});

describe('helpers', () => {
  it('targetSize scales the long side to 1280 and never up', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(targetSize(3000, 4000)).toEqual({ width: 960, height: 1280 });
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('extractIngredientsFromOcr cuts at the heading and at directions', () => {
    expect(extractIngredientsFromOcr('Glow Toner\nIngredients:\nAqua, Glycolic\nAcid, Parfum.\nDirections: use at night')).toBe(
      'Aqua, Glycolic Acid, Parfum',
    );
  });
});
