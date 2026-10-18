/** Thrown by stubs outside the engine (label, photo) until their owners implement them. Accepts the stub's arguments so they count as used. */
export function notImplemented(name: string, ...args: unknown[]): Error {
  return new Error(`${name}: not implemented (${args.length} argument(s) received)`);
}
