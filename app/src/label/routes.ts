/** Dev-only label reader test page (not linked, not in the /dev index). Owner: E6. */
import type { RouteObject } from 'react-router-dom';

export const labelRoutes: RouteObject[] = [
  { path: '/dev/label', lazy: async () => ({ Component: (await import('./LabelDev')).default }) },
];
