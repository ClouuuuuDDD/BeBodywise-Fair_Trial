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
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/** Order and flags from the spike (engineering/notes/provider-spike-2026-10-31.md). */
export const CHAIN: readonly ChainEntry[] = [
  { provider: 'gemini', model: 'gemini-3.5-flash-lite', api: 'gemini-native', vision: true, jsonMode: 'schema', systemRole: true },
  { provider: 'gemini', model: 'gemini-3.1-flash-lite', api: 'gemini-native', vision: true, jsonMode: 'schema', systemRole: true },
  { provider: 'workers-ai', model: '@cf/meta/llama-4-scout-17b-16e-instruct', api: 'workers-ai', vision: true, jsonMode: 'schema', systemRole: true },
  // Nemotron is a reasoning model: with thinking on it spends the whole budget and returns no content (spike, 1 Nov 2026).
  { provider: 'openrouter', model: 'nvidia/nemotron-3.5-super-vl:free', api: 'openai', url: 'https://openrouter.ai/api/v1/chat/completions', vision: true, jsonMode: 'object', systemRole: true, extra: { reasoning: { enabled: false } } },
  { provider: 'groq', model: 'qwen/qwen3.8-27b', api: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions', vision: true, jsonMode: 'schema', systemRole: true },
];

export const CHAIN_LIMITS = { deadlineMs: 22_000, attemptMs: 9_000, minAttemptMs: 4_000, maxOutputTokens: 2048 } as const;

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

async function post(f: typeof fetch, url: string, headers: Record<string, string>, body: unknown, ms: number): Promise<unknown> {
  let res: Response;
  try {
    res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') throw new ProviderError('timeout');
    throw new ProviderError('http');
  }
  if (!res.ok) throw new ProviderError('http', res.status);
  return res.json();
}

async function callEntry(e: ChainEntry, model: string, key: string, env: ProviderEnv, t: ModelTask<unknown>, ms: number, f: typeof fetch): Promise<string> {
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
    }, ms)) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
    if (!text) throw new ProviderError('empty');
    return text;
  }
  if (e.api === 'workers-ai') {
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
    let out: { response?: unknown };
    try {
      out = (await Promise.race([run, timeout])) as { response?: unknown };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    const r = out?.response;
    if (typeof r === 'string' && r !== '') return r;
    if (r && typeof r === 'object') return JSON.stringify(r);
    throw new ProviderError('empty');
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
  }, ms)) as { choices?: { message?: { content?: unknown } }[] };
  const c = json.choices?.[0]?.message?.content;
  if (typeof c !== 'string' || c === '') throw new ProviderError('empty');
  return c;
}

/**
 * Tries each entry in order within one deadline. Each attempt gets min(attemptMs, time left) and starts only if
 * minAttemptMs is left. Any failure moves on (no same-model retry). After a timeout, the same provider's next entry
 * is skipped only when less than 2 x minAttemptMs is left (then a different provider is the better last try);
 * otherwise it is tried, so a slow first Gemini model does not cost the more reliable second one.
 */
export async function runChain<T>(task: ModelTask<T>, env: ProviderEnv, deps: { fetch: typeof fetch; now: () => number }): Promise<ChainResult<T>> {
  const start = deps.now();
  const tried: ProviderId[] = [];
  let skip: ProviderId | null = null;
  for (const [i, e] of CHAIN.entries()) {
    const key = keyFor(e, env);
    if (!key || (task.imageBase64 && !e.vision)) continue;
    const left = CHAIN_LIMITS.deadlineMs - (deps.now() - start);
    if (left < CHAIN_LIMITS.minAttemptMs) break;
    const skipThis = skip === e.provider && left < 2 * CHAIN_LIMITS.minAttemptMs;
    skip = null;
    if (skipThis) continue;
    const model = modelFor(e, env, i);
    tried.push(e.provider);
    try {
      const text = await callEntry(e, model, key, env, task as ModelTask<unknown>, Math.min(CHAIN_LIMITS.attemptMs, left), deps.fetch);
      const value = task.accept(text);
      if (value !== null) return { ok: true, value, provider: e.provider, model };
      console.warn(`read-label: ${e.provider}/${model} gave an unusable answer`);
    } catch (err) {
      if (err instanceof ProviderError && err.reason === 'timeout') skip = e.provider;
      console.warn(`read-label: ${e.provider}/${model} failed`, err instanceof Error ? err.message : 'error'); // never the image
    }
  }
  return { ok: false, tried };
}
