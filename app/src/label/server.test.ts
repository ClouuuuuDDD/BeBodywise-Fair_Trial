import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIMITS,
  allowRequest,
  geminiText,
  handleReadLabel,
  openRouterText,
  parseTranscription,
  resetRateLimit,
  type ReadLabelResponse,
} from '../../../functions/_lib/readLabelCore';

const JPEG_B64 = '/9j/' + 'A'.repeat(100);
const req = (body: unknown) => new Request('https://x.test/api/read-label', { method: 'POST', body: JSON.stringify(body) });
const geminiReply = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
const orReply = (obj: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }), { status: 200 });
const read = async (res: Response) => (await res.json()) as ReadLabelResponse;

beforeEach(() => {
  resetRateLimit();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('response parsing', () => {
  it('parses plain and fenced JSON', () => {
    expect(parseTranscription('{"ingredientsText":" Aqua,  Parfum "}', 'ingredients')).toEqual({ ingredientsText: 'Aqua, Parfum' });
    expect(parseTranscription('```json\n{"name":"Glow","brand":""}\n```', 'front')).toEqual({ name: 'Glow', brand: undefined });
  });
  it('rejects empty, wrong-kind and broken output', () => {
    expect(parseTranscription('{"ingredientsText":""}', 'ingredients')).toBeNull();
    expect(parseTranscription('{"name":"x"}', 'ingredients')).toBeNull();
    expect(parseTranscription('not json', 'front')).toBeNull();
    expect(parseTranscription('[]', 'front')).toBeNull();
  });
  it('extracts provider text', () => {
    expect(geminiText({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })).toBe('ab');
    expect(geminiText({ promptFeedback: { blockReason: 'SAFETY' } })).toBeNull();
    expect(openRouterText({ choices: [{ message: { content: 'hi' } }] })).toBe('hi');
    expect(openRouterText({})).toBeNull();
  });
});

describe('handleReadLabel', () => {
  it('sends Gemini the documented request and returns the transcription', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(geminiReply({ ingredientsText: 'Aqua, Glycolic Acid, Parfum, Aloe' }));
    const res = await handleReadLabel(req({ kind: 'ingredients', image: JPEG_B64 }), { GEMINI_API_KEY: 'k' }, 'ip1', f);
    expect(res.status).toBe(200);
    expect(await read(res)).toMatchObject({ ok: true, provider: 'gemini', ingredientsText: 'Aqua, Glycolic Acid, Parfum, Aloe' });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const sent = JSON.parse(init!.body as string);
    expect(sent.generationConfig.temperature).toBe(0);
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.generationConfig.responseSchema.properties.ingredientsText).toBeDefined();
    expect(sent.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: JPEG_B64 });
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
  });

  it('uses GEMINI_MODEL when set', async () => {
    const f = vi.fn<typeof fetch>().mockImplementation(async () => geminiReply({ name: "Glow", brand: "G" }));
    await handleReadLabel(req({ kind: 'front', image: JPEG_B64 }), { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-x' }, 'ip1', f);
    expect(String(f.mock.calls[0]![0])).toContain('models/gemini-x:generateContent');
  });

  it("moves to Google's rolling lite alias when the pinned model is retired (404)", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('gone', { status: 404 }))
      .mockResolvedValueOnce(geminiReply({ name: 'Glow', brand: 'G' }));
    const res = await handleReadLabel(req({ kind: 'front', image: JPEG_B64 }), { GEMINI_API_KEY: 'k' }, 'ip1', f);
    expect(await read(res)).toMatchObject({ ok: true, provider: 'gemini' });
    expect(String(f.mock.calls[1]![0])).toContain('models/gemini-flash-lite-latest:generateContent');
  });

  it("moves to Google's rolling lite alias when the pinned model times out", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      .mockResolvedValueOnce(geminiReply({ name: 'Glow', brand: 'G' }));
    const res = await handleReadLabel(req({ kind: 'front', image: JPEG_B64 }), { GEMINI_API_KEY: 'k' }, 'ip1', f);
    expect(await read(res)).toMatchObject({ ok: true, provider: 'gemini' });
    expect(String(f.mock.calls[1]![0])).toContain('models/gemini-flash-lite-latest:generateContent');
  });

  it('falls back to OpenRouter when Gemini fails', async () => {
    const f = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      String(url).includes('googleapis') ? new Response('boom', { status: 500 }) : orReply({ ingredientsText: 'Aqua, Parfum, Aloe, Glycerin' }),
    );
    const res = await handleReadLabel(
      req({ kind: 'ingredients', image: JPEG_B64 }),
      { GEMINI_API_KEY: 'k', OPENROUTER_API_KEY: 'o', OPENROUTER_MODEL: 'm:free' },
      'ip1',
      f,
    );
    expect(await read(res)).toMatchObject({ ok: true, provider: 'openrouter' });
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.mock.calls[1]![1]!.body as string).model).toBe('m:free');
  });

  it('falls back to OpenRouter when the Gemini key is missing', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(orReply({ name: 'Glow', brand: '' }));
    const res = await handleReadLabel(req({ kind: 'front', image: JPEG_B64 }), { OPENROUTER_API_KEY: 'o' }, 'ip1', f);
    expect(await read(res)).toMatchObject({ ok: true, provider: 'openrouter', name: 'Glow' });
    expect(f).toHaveBeenCalledOnce();
  });

  it('falls back when Gemini returns unusable JSON', async () => {
    const f = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      String(url).includes('googleapis') ? geminiReply({ ingredientsText: '' }) : orReply({ ingredientsText: 'Aqua, Parfum, Aloe, Glycerin' }),
    );
    const res = await handleReadLabel(req({ kind: 'ingredients', image: JPEG_B64 }), { GEMINI_API_KEY: 'k', OPENROUTER_API_KEY: 'o' }, 'ip1', f);
    expect((await read(res)).provider).toBe('openrouter');
  });

  it('502 unreadable when every provider fails; 503 when none configured', async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValue(new Error('net'));
    const a = await handleReadLabel(req({ kind: 'ingredients', image: JPEG_B64 }), { GEMINI_API_KEY: 'k' }, 'ip1', f);
    expect(a.status).toBe(502);
    expect(await read(a)).toMatchObject({ ok: false, error: 'unreadable' });
    const b = await handleReadLabel(req({ kind: 'ingredients', image: JPEG_B64 }), {}, 'ip1', f);
    expect(b.status).toBe(503);
  });

  it('validates type, size and shape without calling a provider', async () => {
    const f = vi.fn<typeof fetch>();
    const env = { GEMINI_API_KEY: 'k' };
    expect((await handleReadLabel(req({ kind: 'ingredients', image: 'iVBORw0KGgo=' }), env, 'a', f)).status).toBe(400); // PNG
    expect((await handleReadLabel(req({ kind: 'ingredients', image: JPEG_B64, mime: 'image/png' }), env, 'a', f)).status).toBe(400);
    expect((await handleReadLabel(req({ kind: 'nope', image: JPEG_B64 }), env, 'a', f)).status).toBe(400);
    expect((await handleReadLabel(req({ kind: 'front' }), env, 'a', f)).status).toBe(400);
    expect((await handleReadLabel(req({ kind: 'front', image: '/9j/!!!' }), env, 'a', f)).status).toBe(400);
    expect((await handleReadLabel(new Request('https://x.test', { method: 'POST', body: '{' }), env, 'a', f)).status).toBe(400);
    const big = '/9j/' + 'A'.repeat(Math.ceil((LIMITS.maxImageBytes * 4) / 3) + 100);
    expect((await handleReadLabel(req({ kind: 'front', image: big }), env, 'a', f)).status).toBe(413);
    expect(f).not.toHaveBeenCalled();
  });

  it('accepts a data URL prefix', async () => {
    const f = vi.fn<typeof fetch>().mockImplementation(async () => geminiReply({ name: "Glow", brand: "G" }));
    const res = await handleReadLabel(req({ kind: 'front', image: `data:image/jpeg;base64,${JPEG_B64}` }), { GEMINI_API_KEY: 'k' }, 'a', f);
    expect(res.status).toBe(200);
  });

  it('rate limits per IP', async () => {
    const f = vi.fn<typeof fetch>().mockImplementation(async () => geminiReply({ name: "Glow", brand: "G" }));
    for (let i = 0; i < LIMITS.rateMax; i++) {
      expect((await handleReadLabel(req({ kind: 'front', image: JPEG_B64 }), { GEMINI_API_KEY: 'k' }, 'busy', f)).status).toBe(200);
    }
    const res = await handleReadLabel(req({ kind: 'front', image: JPEG_B64 }), { GEMINI_API_KEY: 'k' }, 'busy', f);
    expect(res.status).toBe(429);
    expect((await handleReadLabel(req({ kind: 'front', image: JPEG_B64 }), { GEMINI_API_KEY: 'k' }, 'other', f)).status).toBe(200);
  });

  it('allowRequest window slides', () => {
    for (let i = 0; i < LIMITS.rateMax; i++) expect(allowRequest('w', 1000)).toBe(true);
    expect(allowRequest('w', 1001)).toBe(false);
    expect(allowRequest('w', 1000 + LIMITS.rateWindowMs + 1)).toBe(true);
  });
});
