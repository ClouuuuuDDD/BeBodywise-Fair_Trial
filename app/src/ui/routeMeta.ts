import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';

/** Who owns a route's screen (docs/briefs/engineering.md module table). */
export type Owner = 'E1' | 'E3' | 'E4' | 'E5';

/** Metadata on every route (RouteObject.handle). Read by the layout and the /dev index. */
export interface ScreenHandle {
  /** Screen number from engineering/handoff/screens/INDEX.md, e.g. "03b". */
  screen: string;
  /** Screen name from the screen plan. */
  title: string;
  /** Owning engineer. */
  owner: Owner;
  /** Full-width desktop page (only /insights). Default: the 480 px phone column. */
  wide?: boolean;
}

/** One screen route. Each screen is lazy-loaded into its own chunk. */
export function screenRoute(
  path: string,
  handle: ScreenHandle,
  load: () => Promise<{ default: ComponentType }>,
): RouteObject {
  return {
    path,
    handle,
    lazy: async () => ({ Component: (await load()).default }),
  };
}
