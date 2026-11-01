import type { ReviewContext } from '../contracts';
import { LABEL_TIMEOUT_MS } from '../engine/config';
import type { LabelKind, ReadLabelApiResponse } from './types';

/** Thrown when /api/read-label is unreachable or unusable. `status` is the HTTP status, 0 if none. */
export class LabelApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'LabelApiError';
  }
}

export interface CallOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Extra attempts after the first (default 1: one retry). */
  retries?: number;
  endpoint?: string;
}

async function attempt(body: Record<string, unknown>, o: Required<Omit<CallOptions, 'retries'>>, signal?: AbortSignal): Promise<ReadLabelApiResponse> {
  let res: Response;
  try {
    const timeout = AbortSignal.timeout(o.timeoutMs);
    res = await o.fetchImpl(o.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'TimeoutError') throw new LabelApiError('timeout', 0, 'timeout');
    if (name === 'AbortError') throw new LabelApiError('aborted', 0, 'aborted');
    throw new LabelApiError('network', 0, 'network');
  }
  let json: ReadLabelApiResponse | null = null;
  try {
    json = (await res.json()) as ReadLabelApiResponse;
  } catch {
    // Not JSON: a dev server returning index.html, or a gateway error page.
  }
  if (!res.ok || !json || json.ok !== true) {
    throw new LabelApiError(json?.message ?? `http_${res.status}`, res.status, json?.error ?? 'http');
  }
  return json;
}

/** Spec 5.5: one retry, only on a network error. A 502 means the server already tried every provider; a timeout already took 25 s. */
function isRetryable(e: LabelApiError): boolean {
  return e.code === 'network';
}

async function withRetry(body: Record<string, unknown>, opts: CallOptions, signal?: AbortSignal): Promise<ReadLabelApiResponse> {
  const o = {
    fetchImpl: opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a)),
    timeoutMs: opts.timeoutMs ?? LABEL_TIMEOUT_MS,
    endpoint: opts.endpoint ?? '/api/read-label',
  };
  const retries = opts.retries ?? 1;
  let last: LabelApiError | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt(body, o, signal);
    } catch (e) {
      last = e instanceof LabelApiError ? e : new LabelApiError('unknown', 0, 'unknown');
      if (!isRetryable(last)) break;
    }
  }
  throw last ?? new LabelApiError('unknown', 0, 'unknown');
}

/** POSTs one resized label photo; the ingredients side carries the review context. */
export function callReadLabelApi(base64: string, kind: LabelKind, opts: CallOptions = {}, context?: ReviewContext): Promise<ReadLabelApiResponse> {
  return withRetry({ kind, image: base64, mime: 'image/jpeg', ...(kind === 'ingredients' && context ? { context } : {}) }, opts);
}

/** Re-judges confirmed text (spec 5.3): after an edit, a stung tick, OCR or typing. */
export function callReviewTextApi(
  input: { ingredientsText: string; productName: string; context: ReviewContext },
  opts: CallOptions & { signal?: AbortSignal } = {},
): Promise<ReadLabelApiResponse> {
  return withRetry({ kind: 'review-text', ...input }, opts, opts.signal);
}
