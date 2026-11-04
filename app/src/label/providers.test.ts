import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAIN, CHAIN_LIMITS, runChain, workersAiText, type ModelTask } from '../../../functions/_lib/providers';

const geminiOk = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const chatOk = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const task = (over: Partial<ModelTask<string>> = {}): ModelTask<string> => ({
  system: 'SYS', user: 'USER', schema: { type: 'object' }, thinking: 'low',
  accept: (t) => (t.includes('good') ? t : null), ...over,
});
const allKeys = { GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o', GROQ_API_KEY: 'q' };
const idx = (provider: string, from = 0) => CHAIN.findIndex((e, i) => i >= from && e.provider === provider);

/** A fetch that never answers until its signal aborts (a hung model). Records the aborts. */
function hang(aborted: string[] = []) {
  return (url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => {
        aborted.push(String(url));
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
}

/** Fake clock: `wait` moves it on, one macrotask later, so answers already in hand settle first. */
function clock() {
  const c = { t: 0, now: () => c.t, wait: (ms: number) => new Promise<void>((r) => setTimeout(() => { c.t += ms; r(); }, 0)) };
  return c;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('runChain', () => {
  it('first provider answers: native Gemini request with JSON schema', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(geminiOk('good'));
    const r = await runChain(task({ imageBase64: '/9j/x' }), allKeys, { fetch: f, now: () => 0 });
    expect(r).toMatchObject({ ok: true, value: 'good', provider: 'gemini', model: CHAIN[0]!.model });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain(`models/${CHAIN[0]!.model}:generateContent`);
    const body = JSON.parse(init!.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: '/9j/x' });
    expect(body.generationConfig).toMatchObject({ temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } });
  });

  it('429, 503 and a bad answer each start the next entry at once, in chain order', async () => {
    const c = clock();
    const f = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(chatOk('bad'))
      .mockResolvedValue(geminiOk('good'));
    const r = await runChain(task(), allKeys, { fetch: f, now: c.now, wait: c.wait });
    expect(r).toMatchObject({ ok: true, provider: 'gemini', model: CHAIN[idx('gemini', 1)]!.model });
    expect(f).toHaveBeenCalledTimes(4);
    expect(c.t).toBe(0); // no failure waited for the hedge
  });

  it('a hung first model costs hedgeMs, not a whole attempt: the next starts and wins, the hung one is aborted', async () => {
    const c = clock();
    const aborted: string[] = [];
    const f = vi.fn<typeof fetch>().mockImplementationOnce(hang(aborted)).mockResolvedValue(chatOk('good'));
    const r = await runChain(task(), allKeys, { fetch: f, now: c.now, wait: c.wait });
    expect(r).toMatchObject({ ok: true, provider: CHAIN[1]!.provider });
    expect(c.t).toBe(CHAIN_LIMITS.hedgeMs);
    expect(aborted).toHaveLength(1);
    expect(aborted[0]).toContain(':generateContent');
  });

  it('runs at most maxInFlight entries at once, then gives up at the deadline', async () => {
    const c = clock();
    const f = vi.fn<typeof fetch>().mockImplementation(hang());
    const r = await runChain(task(), allKeys, { fetch: f, now: c.now, wait: c.wait });
    expect(r).toEqual({ ok: false, tried: CHAIN.slice(0, CHAIN_LIMITS.maxInFlight).map((e) => e.provider) });
    expect(f).toHaveBeenCalledTimes(CHAIN_LIMITS.maxInFlight);
    expect(c.t).toBeGreaterThanOrEqual(CHAIN_LIMITS.deadlineMs);
  });

  it('a slot freed by a failure goes to the next entry', async () => {
    const c = clock();
    const f = vi.fn<typeof fetch>()
      .mockImplementationOnce(hang())
      .mockImplementationOnce(hang())
      .mockResolvedValueOnce(new Response('', { status: 400 }))
      .mockResolvedValue(geminiOk('good'));
    const r = await runChain(task(), allKeys, { fetch: f, now: c.now, wait: c.wait });
    expect(r).toMatchObject({ ok: true, provider: 'gemini', model: CHAIN[idx('gemini', 1)]!.model });
  });

  it('does not start an entry with less than minAttemptMs left', async () => {
    let t = 0;
    const f = vi.fn<typeof fetch>().mockImplementation(async () => {
      t = CHAIN_LIMITS.deadlineMs - CHAIN_LIMITS.minAttemptMs + 1;
      return new Response('', { status: 500 });
    });
    const r = await runChain(task(), allKeys, { fetch: f, now: () => t, wait: async () => {} });
    expect(r.ok).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('sends OpenRouter its reasoning switch and Groq reasoning_effort none', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(chatOk('good'));
    await runChain(task(), { OPENROUTER_API_KEY: 'o' }, { fetch: f, now: () => 0 });
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string).reasoning).toEqual({ enabled: false });
    await runChain(task(), { GROQ_API_KEY: 'q' }, { fetch: f, now: () => 0 });
    expect(JSON.parse(f.mock.calls[1]![1]!.body as string).reasoning_effort).toBe('none');
  });

  it('skips entries without a key or binding, and non-vision entries for photos', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(chatOk('good'));
    const r = await runChain(task({ imageBase64: '/9j/x' }), { GROQ_API_KEY: 'q' }, { fetch: f, now: () => 0 });
    const groqHasVision = CHAIN.find((e) => e.provider === 'groq')?.vision ?? false;
    expect(r.ok).toBe(groqHasVision);
  });

  it('no keys at all: fails without a call', async () => {
    const f = vi.fn<typeof fetch>();
    expect(await runChain(task(), {}, { fetch: f, now: () => 0 })).toEqual({ ok: false, tried: [] });
    expect(f).not.toHaveBeenCalled();
  });

  it('Workers AI through the binding, with a json_schema response format', async () => {
    const run = vi.fn().mockResolvedValue({ response: { x: 'good' } });
    const r = await runChain(task(), { AI: { run } }, { fetch: vi.fn<typeof fetch>(), now: () => 0 });
    expect(r).toMatchObject({ ok: true, provider: 'workers-ai' });
    expect(run.mock.calls[0]![1]).toMatchObject({ response_format: { type: 'json_schema' } });
  });

  it('Workers AI answer in the OpenAI shape is read too', async () => {
    const run = vi.fn().mockResolvedValue({ choices: [{ message: { content: '{"x":"good"}' } }] });
    const r = await runChain(task(), { AI: { run } }, { fetch: vi.fn<typeof fetch>(), now: () => 0 });
    expect(r).toMatchObject({ ok: true, provider: 'workers-ai', value: '{"x":"good"}' });
  });

  it('GEMINI_MODEL replaces the first Gemini model', async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(geminiOk('good'));
    await runChain(task(), { GEMINI_API_KEY: 'g', GEMINI_MODEL: 'gemini-x' }, { fetch: f, now: () => 0 });
    expect(String(f.mock.calls[0]![0])).toContain('models/gemini-x:generateContent');
  });
});

describe('workersAiText', () => {
  it('reads response strings and objects, OpenAI choices, and the REST result wrapper', () => {
    expect(workersAiText({ response: '{"a":1}' })).toBe('{"a":1}');
    expect(workersAiText({ response: { a: 1 } })).toBe('{"a":1}');
    expect(workersAiText({ choices: [{ message: { content: '{"a":1}' } }] })).toBe('{"a":1}');
    expect(workersAiText({ result: { choices: [{ message: { content: 'x' } }] } })).toBe('x');
    expect(workersAiText({ response: '' })).toBeNull();
    expect(workersAiText(null)).toBeNull();
  });
});
