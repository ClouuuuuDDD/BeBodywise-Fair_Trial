/** Keep Going (screen 20). Owner: E5. Add a screen: one file + one line here. */
import type { RouteObject } from 'react-router-dom';
import { screenRoute } from '../../ui/routeMeta';

export const keepRoutes: RouteObject[] = [
  screenRoute('/keep', { screen: '20', title: 'Keep Going', owner: 'E5' }, () => import('./KeepGoing')),
];
