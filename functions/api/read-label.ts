/**
 * POST /api/read-label  (Cloudflare Pages Function). Owner: E6.
 *
 * Body, by kind:
 *   front:       { kind, image: <base64 JPEG>, mime? }                      -> { name, brand }
 *   ingredients: { kind, image, mime?, context }                            -> { ingredientsText, review }
 *   review-text: { kind, ingredientsText, productName?, context }          -> { review }
 * Reply: { ok, kind, provider, model?, name?, brand?, ingredientsText?, review?, error?, message? }
 *
 * The model reads and reviews; code validates it and applies the red lines. `context` is checked against a
 * strict allow-list (readLabelCore.validateContext). Nothing is stored and the image is never logged.
 * Provider order lives in functions/_lib/providers.ts. Logic and limits: functions/_lib/readLabelCore.ts.
 */
import { handleReadLabel, type ReadLabelEnv } from '../_lib/readLabelCore';

export type Env = ReadLabelEnv;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const ip = context.request.headers.get('cf-connecting-ip') ?? 'unknown';
  return handleReadLabel(context.request, context.env, ip);
};

/** Anything but POST (a specific onRequestPost wins for POST). */
export const onRequest: PagesFunction<Env> = async () =>
  new Response(JSON.stringify({ ok: false, error: 'bad_request', message: 'Use POST.' }), {
    status: 405,
    headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST' },
  });
