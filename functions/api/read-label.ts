/**
 * POST /api/read-label  (Cloudflare Pages Function). Owner: E6.
 *
 * Body: { kind: "front" | "ingredients", image: <base64 JPEG>, mime?: "image/jpeg" }
 * Reply: { ok, kind, name?, brand?, ingredientsText?, provider, error?, message? }
 *
 * Gemini first, OpenRouter free vision model second (if configured). The model only transcribes;
 * the rules in the browser decide. Nothing is stored and the image is never logged.
 * Logic and limits live in functions/_lib/readLabelCore.ts.
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
