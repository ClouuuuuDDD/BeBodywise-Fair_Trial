/** Example trial for reviewers, Riya, Jump to day (screen 22). Owner: E5. Add a screen: one file + one line here. */
import type { RouteObject } from 'react-router-dom';
import { screenRoute } from '../../ui/routeMeta';

export const exampleRoutes: RouteObject[] = [
  screenRoute('/example', { screen: '22', title: 'Example trial', owner: 'E5' }, () => import('./ExampleTrial')),
];
