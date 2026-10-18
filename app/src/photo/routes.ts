/** Photo lab harness pages (not product screens, not linked from the app). Owner: E3. */
import type { RouteObject } from 'react-router-dom';
import { screenRoute } from '../ui/routeMeta';

export const photoRoutes: RouteObject[] = [
  screenRoute('/lab', { screen: 'lab', title: 'Photo kill test (harness)', owner: 'E3' }, () => import('./KillTest')),
  screenRoute('/lab/kill-test', { screen: 'lab', title: 'Photo kill test (harness)', owner: 'E3' }, () => import('./KillTest')),
];
