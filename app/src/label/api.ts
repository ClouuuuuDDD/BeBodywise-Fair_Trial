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

function isRetryable(e: LabelApiError): boolean {
  // Network error / timeout (0), 5xx except "not set up" 503. 4xx (bad photo, too big, rate limit) will not change.
  return e.status === 0 || (e.status >= 500 && e.status !== 503);
}

async function attempt(base64: string, kind: LabelKind, o: Required<Omit<CallOptions, 'retries'>>): Promise<ReadLabelApiResponse> {
  let res: Response;
  try {
    res = await o.fetchImpl(o.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, image: base64, mime: 'image/jpeg' }),
      signal: AbortSignal.timeout(o.timeoutMs),
    });
  } catch {
    throw new LabelApiError('network_or_timeout', 0, 'network');
  }
  let body: ReadLabelApiResponse | null = null;
  try {
    body = (await res.json()) as ReadLabelApiResponse;
  } catch {
    // Not JSON: a dev server returning index.html, or a gateway error page.
  }
  if (!res.ok || !body || body.ok !== true) {
    throw new LabelApiError(body?.message ?? `http_${res.status}`, res.status, body?.error ?? 'http');
  }
  return body;
}

/**
 * POSTs one resized photo. Timeout per attempt (LABEL_TIMEOUT_MS) and one retry on network
 * errors, timeouts and 5xx. Throws LabelApiError when it gives up.
 */
export async function callReadLabelApi(base64: string, kind: LabelKind, opts: CallOptions = {}): Promise<ReadLabelApiResponse> {
  const o = {
    fetchImpl: opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a)),
    timeoutMs: opts.timeoutMs ?? LABEL_TIMEOUT_MS,
    endpoint: opts.endpoint ?? '/api/read-label',
  };
  const retries = opts.retries ?? 1;
  let last: LabelApiError | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt(base64, kind, o);
    } catch (e) {
      last = e instanceof LabelApiError ? e : new LabelApiError('unknown', 0, 'unknown');
      if (!isRetryable(last)) break;
    }
  }
  throw last ?? new LabelApiError('unknown', 0, 'unknown');
}
