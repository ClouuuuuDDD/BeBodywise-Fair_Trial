/**
 * The route table, assembled from each owner's routes file so owners never edit the same file.
 * Owner: E1. Add a screen in your own folder's routes.ts, not here.
 */
import type { RouteObject } from 'react-router-dom';
import { exampleRoutes } from './screens/example/routes';
import { insightsRoutes } from './screens/insights/routes';
import { keepRoutes } from './screens/keep/routes';
import { rightStartRoutes } from './screens/rightstart/routes';
import { trialRoutes } from './screens/trial/routes';
import { photoRoutes } from './photo/routes';
import { labelRoutes } from './label/routes';
import { screenRoute } from './ui/routeMeta';

/** Every screen route, in SCREENS.md order. */
export const allScreenRoutes: RouteObject[] = [
  ...rightStartRoutes,
  ...trialRoutes,
  ...keepRoutes,
  ...insightsRoutes,
  ...exampleRoutes,
  ...photoRoutes,
];

/** Build aids and fallbacks (E1). */
export const shellRoutes: RouteObject[] = [
  screenRoute('/dev', { screen: 'dev', title: 'All screens', owner: 'E1' }, () => import('./ui/DevIndex')),
  ...labelRoutes, // E6 dev test page /dev/label, not linked
  // UI kit review page: dev server only, never linked, absent from the production build.
  ...(import.meta.env.DEV
    ? [screenRoute('/kit', { screen: 'kit', title: 'UI kit', owner: 'E1' }, () => import('./ui/Kit'))]
    : []),
  screenRoute('*', { screen: '404', title: 'Not found', owner: 'E1' }, () => import('./ui/NotFound')),
];
