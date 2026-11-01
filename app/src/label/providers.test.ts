import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAIN, CHAIN_LIMITS, runChain, type ModelTask } from '../../../functions/_lib/providers';

const geminiOk = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const chatOk = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const task = (over: Partial<ModelTask<string>> = {}): ModelTask<string> => ({
  system: 'SYS', user: 'USER', schema: { type: 'object' }, thinking: 'low',
  accept: (t) => (t.includes('good') ? t : null), ...over,
});
const allKeys = { GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o', GROQ_API_KEY: 'q' };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('runChain', () => {
  it('first provider answers: native Gemini request with JSON schema', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(geminiOk('good'));
    const r = await runChain(task({ imageBase64: '/9j/x' }), allKeys, { fetch: f, now: () => 0 });
    expect(r).toMatchObject({ ok: true, value: 'good', provider: 'gemini', model: CHAIN[0]!.model });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain(`models/${CHAIN[0]!.model}:generateContent`);
    const body = JSON.parse(init!.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: '/9j/x' });
    expect(body.generationConfig).toMatchObject({ temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } });
  });

  it('429, 503 and a bad answer each move to the next entry', async () => {
    const f = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(chatOk('bad'))
      .mockResolvedValue(chatOk('good'));
    const r = await runChain(task(), allKeys, { fetch: f, now: () => 0 });
    expect(r.ok).toBe(true);
    expect(f.mock.calls.length).toBe(4);
  });

  it('sends OpenRouter the reasoning switch from its entry', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(chatOk('good'));
    await runChain(task(), { OPENROUTER_API_KEY: 'o' }, { fetch: f, now: () => 0 });
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string).reasoning).toEqual({ enabled: false });
  });

  it('a timeout skips the same provider\'s next model', async () => {
    const f = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
      .mockResolvedValue(chatOk('good'));
    const r = await runChain(task(), { GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o' }, { fetch: f, now: () => 0 });
    expect(r.ok && r.provider).not.toBe('gemini');
    expect(f.mock.calls.filter(([u]) => String(u).includes(':generateContent'))).toHaveLength(1);
  });

  it('skips entries without a key or binding, and non-vision entries for photos', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(chatOk('good'));
    const r = await runChain(task({ imageBase64: '/9j/x' }), { GROQ_API_KEY: 'q' }, { fetch: f, now: () => 0 });
    const groqHasVision = CHAIN.find((e) => e.provider === 'groq')?.vision ?? false;
    expect(r.ok).toBe(groqHasVision);
  });

  it('Workers AI through the binding, with a json_schema response format', async () => {
    const run = vi.fn().mockResolvedValue({ response: { x: 'good' } });
    const r = await runChain(task({ accept: (t) => (t.includes('good') ? t : null) }), { AI: { run } }, { fetch: vi.fn<typeof fetch>(), now: () => 0 });
    expect(r).toMatchObject({ ok: true, provider: 'workers-ai' });
    expect(run.mock.calls[0]![1]).toMatchObject({ response_format: { type: 'json_schema' } });
  });

  it('stops when less than minAttemptMs is left of the deadline', async () => {
    let clock = 0;
    const f = vi.fn<typeof fetch>().mockImplementation(async () => {
      clock += CHAIN_LIMITS.attemptMs; // every attempt uses its whole budget
      return new Response('', { status: 500 });
    });
    const r = await runChain(task(), allKeys, { fetch: f, now: () => clock });
    expect(r.ok).toBe(false);
    // 22 s deadline, 9 s per attempt, needs 4 s left: two attempts fit (0, 9), the third would start at 18 with 4 left.
    expect(f.mock.calls.length).toBe(3);
  });

  it('GEMINI_MODEL replaces the first Gemini model', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(geminiOk('good'));
    await runChain(task(), { GEMINI_API_KEY: 'g', GEMINI_MODEL: 'gemini-x' }, { fetch: f, now: () => 0 });
    expect(String(f.mock.calls[0]![0])).toContain('models/gemini-x:generateContent');
  });
});
