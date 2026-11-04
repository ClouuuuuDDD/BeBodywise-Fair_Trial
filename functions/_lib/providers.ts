/**
 * The free provider chain (spec 6) with one deadline for the whole call (spec 5.5). Adapters: native Gemini
 * (JSON schema), OpenAI-compatible (OpenRouter, Groq) and the Workers AI binding.
 * A provider with no key or binding is skipped silently. The image and the context are never logged.
 */
export type ProviderId = 'gemini' | 'workers-ai' | 'openrouter' | 'groq';

export interface ChainEntry {
  provider: ProviderId;
  model: string;
  api: 'gemini-native' | 'openai' | 'workers-ai';
  /** Chat completions URL (api "openai" only). */
  url?: string;
  /** Can read a photo. Text-only entries serve only "review-text". */
  vision: boolean;
  /** schema = strict JSON schema; object = JSON mode + schema in the prompt; prompt = schema in the prompt only. */
  jsonMode: 'schema' | 'object' | 'prompt';
  /** False when the model rejects a system role (the system text is put before the user text instead). */
  systemRole: boolean;
  /** Provider-specific body fields (api "openai" only), e.g. OpenRouter's reasoning switch. */
  extra?: Record<string, unknown>;
  /** Overrides CHAIN_LIMITS.attemptMs for a model that is slow but steady. */
  attemptMs?: number;
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Order from the outage diagnosis of 4 Nov 2026: the free Gemini tier answered 503 "high demand" or hung on every
 * model for long stretches, so no single provider can be trusted and the chain starts entries staggered (runChain).
 * Gemini 3.1 Flash Lite is the spike's most consistent model and names culprits best. Groq is next because it fails
 * or answers in about 1 s (1,000 a day, 8K tokens a minute); OpenRouter's free models allow only 50 a day without
 * credits, so it comes after Groq.
 */
export const CHAIN: readonly ChainEntry[] = [
  { provider: 'gemini', model: 'gemini-3.1-flash-lite', api: 'gemini-native', vision: true, jsonMode: 'schema', systemRole: true },
  // Qwen 3.8 reasons by default and then returns broken JSON ("{\"}}", HTTP 400). Reasoning off plus JSON mode (not Groq's
  // strict schema check, which also 400s under load) went 12 of 12 on 4 Nov 2026; validateReview still checks every answer.
  { provider: 'groq', model: 'qwen/qwen3.8-27b', api: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions', vision: true, jsonMode: 'object', systemRole: true, extra: { reasoning_effort: 'none' } },
  // Nemotron is a reasoning model: with thinking on it spends the whole budget and returns no content (spike, 1 Nov 2026).
  { provider: 'openrouter', model: 'nvidia/nemotron-3.5-super-vl:free', api: 'openai', url: 'https://openrouter.ai/api/v1/chat/completions', vision: true, jsonMode: 'object', systemRole: true, extra: { reasoning: { enabled: false } } },
  { provider: 'gemini', model: 'gemini-3.5-flash', api: 'gemini-native', vision: true, jsonMode: 'schema', systemRole: true },
  // 6 to 10 s per review over REST (4 Nov 2026), so it gets a longer attempt.
  { provider: 'workers-ai', model: '@cf/meta/llama-4-scout-17b-16e-instruct', api: 'workers-ai', vision: true, jsonMode: 'schema', systemRole: true, attemptMs: 13_000 },
];

/**
 * deadlineMs: the whole call. attemptMs: one entry. hedgeMs: with no answer yet, the next entry starts this long after
 * the last one (a failure starts it at once). maxInFlight: entries running at once, to spare the free daily quotas.
 * minAttemptMs: an entry starts only if this much of the deadline is left.
 */
export const CHAIN_LIMITS = { deadlineMs: 22_000, attemptMs: 9_000, hedgeMs: 4_000, maxInFlight: 3, minAttemptMs: 3_000, maxOutputTokens: 2048 } as const;

export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface ProviderEnv {
  GEMINI_API_KEY?: string;
  /** Replaces the first Gemini model (when Google retires it). */
  GEMINI_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  GROQ_API_KEY?: string;
  AI?: AiBinding;
}

export interface ModelTask<T> {
  system: string;
  user: string;
  imageBase64?: string;
  schema: Record<string, unknown>;
  thinking: 'minimal' | 'low';
  /** Parse and validate the model's text; null tries the next entry. */
  accept: (text: string) => T | null;
}

export type ChainResult<T> = { ok: true; value: T; provider: ProviderId; model: string } | { ok: false; tried: ProviderId[] };

class ProviderError extends Error {
  constructor(readonly reason: 'timeout' | 'http' | 'empty', readonly status = 0) {
    super(`${reason}${status ? `_${status}` : ''}`);
  }
}

function keyFor(e: ChainEntry, env: ProviderEnv): string | undefined {
  if (e.provider === 'gemini') return env.GEMINI_API_KEY;
  if (e.provider === 'openrouter') return env.OPENROUTER_API_KEY;
  if (e.provider === 'groq') return env.GROQ_API_KEY;
  return env.AI ? 'binding' : undefined;
}

function modelFor(e: ChainEntry, env: ProviderEnv, index: number): string {
  if (index === 0 && e.provider === 'gemini' && env.GEMINI_MODEL?.trim()) return env.GEMINI_MODEL.trim();
  if (e.provider === 'openrouter' && env.OPENROUTER_MODEL?.trim()) return env.OPENROUTER_MODEL.trim();
  return e.model;
}

function withSchemaHint(e: ChainEntry, t: ModelTask<unknown>): string {
  const user = e.systemRole ? t.user : `${t.system}\n\n${t.user}`;
  return e.jsonMode === 'schema' ? user : `${user}\nReply with JSON only, matching this JSON schema: ${JSON.stringify(t.schema)}`;
}

function chatMessages(e: ChainEntry, t: ModelTask<unknown>) {
  const text = withSchemaHint(e, t);
  const content = t.imageBase64
    ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${t.imageBase64}` } }]
    : text;
  return [...(e.systemRole ? [{ role: 'system', content: t.system }] : []), { role: 'user', content }];
}

async function post(f: typeof fetch, url: string, headers: Record<string, string>, body: unknown, ms: number, stop: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.any([stop, AbortSignal.timeout(ms)]) });
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') throw new ProviderError('timeout');
    throw new ProviderError('http');
  }
  if (!res.ok) throw new ProviderError('http', res.status);
  return res.json();
}

/** Text out of a Workers AI reply: `response` (string or object), or the OpenAI-shaped `choices` some models return. */
export function workersAiText(out: unknown): string | null {
  const o = (out ?? {}) as { response?: unknown; choices?: { message?: { content?: unknown } }[]; result?: unknown };
  if (o.result !== undefined && o.response === undefined && o.choices === undefined) return workersAiText(o.result);
  const r = o.response ?? o.choices?.[0]?.message?.content;
  if (typeof r === 'string') return r === '' ? null : r;
  if (r && typeof r === 'object') return JSON.stringify(r);
  return null;
}

async function callEntry(e: ChainEntry, model: string, key: string, env: ProviderEnv, t: ModelTask<unknown>, ms: number, f: typeof fetch, stop: AbortSignal): Promise<string> {
  if (e.api === 'gemini-native') {
    const parts: unknown[] = [{ text: t.user }];
    if (t.imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: t.imageBase64 } });
    const json = (await post(f, `${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': key }, {
      systemInstruction: { parts: [{ text: t.system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: CHAIN_LIMITS.maxOutputTokens,
        responseMimeType: 'application/json',
        responseJsonSchema: t.schema,
        thinkingConfig: { thinkingLevel: t.thinking },
      },
    }, ms, stop)) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
    if (!text) throw new ProviderError('empty');
    return text;
  }
  if (e.api === 'workers-ai') {
    // The binding takes no abort signal: a stopped or timed-out run is left to finish and its answer is dropped.
    const run = env.AI!.run(model, {
      messages: chatMessages(e, t),
      temperature: 0,
      max_tokens: CHAIN_LIMITS.maxOutputTokens,
      ...(e.jsonMode === 'schema' ? { response_format: { type: 'json_schema', json_schema: t.schema } } : {}),
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ProviderError('timeout')), ms);
    });
    let out: unknown;
    try {
      out = await Promise.race([run, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    const text = workersAiText(out);
    if (text === null) throw new ProviderError('empty');
    return text;
  }
  const response_format =
    e.jsonMode === 'schema'
      ? { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: t.schema } }
      : e.jsonMode === 'object'
        ? { type: 'json_object' }
        : undefined;
  const json = (await post(f, e.url!, { authorization: `Bearer ${key}` }, {
    model,
    temperature: 0,
    max_tokens: CHAIN_LIMITS.maxOutputTokens,
    messages: chatMessages(e, t),
    ...(e.extra ?? {}),
    ...(response_format ? { response_format } : {}),
  }, ms, stop)) as { choices?: { message?: { content?: unknown } }[] };
  const c = json.choices?.[0]?.message?.content;
  if (typeof c !== 'string' || c === '') throw new ProviderError('empty');
  return c;
}

export interface ChainDeps {
  fetch: typeof fetch;
  now: () => number;
  /** Resolves after `ms` (never, once `cancel` fires); injectable so tests can drive the hedge without real time. */
  wait?: (ms: number, cancel: AbortSignal) => Promise<void>;
}

const realWait = (ms: number, cancel: AbortSignal) =>
  new Promise<void>((r) => {
    const t = setTimeout(r, ms);
    cancel.addEventListener('abort', () => clearTimeout(t), { once: true });
  });

/**
 * Staggered start within one deadline (spec 5.5). The first entry starts at once; while no entry has answered, the
 * next starts hedgeMs after the previous one, or at once when one fails, with at most maxInFlight running. The first
 * accepted answer wins and the rest are aborted. Each attempt gets min(its attemptMs, time left) and starts only if
 * minAttemptMs is left. So one hung model costs hedgeMs, not a whole attempt, and a 503 costs about a second.
 */
export async function runChain<T>(task: ModelTask<T>, env: ProviderEnv, deps: ChainDeps): Promise<ChainResult<T>> {
  const wait = deps.wait ?? realWait;
  const start = deps.now();
  const left = () => CHAIN_LIMITS.deadlineMs - (deps.now() - start);
  const tried: ProviderId[] = [];
  const stop = new AbortController();
  const queue = CHAIN.map((e, i) => ({ e, i, key: keyFor(e, env) })).filter((x) => x.key && !(task.imageBase64 && !x.e.vision));

  type Settled = { kind: 'done'; value: T | null; e: ChainEntry; model: string } | { kind: 'tick' };
  const inFlight = new Set<Promise<Settled>>();

  const launch = (): void => {
    const next = queue[0];
    if (!next || left() < CHAIN_LIMITS.minAttemptMs || inFlight.size >= CHAIN_LIMITS.maxInFlight) return;
    queue.shift();
    const model = modelFor(next.e, env, next.i);
    tried.push(next.e.provider);
    const ms = Math.min(next.e.attemptMs ?? CHAIN_LIMITS.attemptMs, left());
    const p: Promise<Settled> = callEntry(next.e, model, next.key!, env, task as ModelTask<unknown>, ms, deps.fetch, stop.signal)
      .then((text) => {
        const value = task.accept(text);
        if (value === null) console.warn(`read-label: ${next.e.provider}/${model} gave an unusable answer`);
        return value;
      })
      .catch((err: unknown) => {
        if (!stop.signal.aborted) console.warn(`read-label: ${next.e.provider}/${model} failed`, err instanceof Error ? err.message : 'error'); // never the image
        return null;
      })
      .then((value): Settled => {
        inFlight.delete(p);
        return { kind: 'done', value, e: next.e, model };
      });
    inFlight.add(p);
  };

  try {
    launch();
    while (inFlight.size > 0) {
      const canHedge = queue.length > 0 && inFlight.size < CHAIN_LIMITS.maxInFlight && left() >= CHAIN_LIMITS.minAttemptMs;
      const tickMs = Math.max(0, canHedge ? Math.min(CHAIN_LIMITS.hedgeMs, left()) : left());
      const round = new AbortController();
      const s = await Promise.race([...inFlight, wait(tickMs, round.signal).then((): Settled => ({ kind: 'tick' }))]);
      round.abort();
      if (s.kind === 'done') {
        if (s.value !== null) return { ok: true, value: s.value, provider: s.e.provider, model: s.model };
        launch(); // a failure starts the next entry at once
      } else if (canHedge) {
        launch();
      } else if (left() <= 0) {
        break; // deadline passed with entries still running
      }
    }
    return { ok: false, tried };
  } finally {
    stop.abort();
  }
}
