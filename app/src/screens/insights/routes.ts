/** Part 2: Bodywise insights, sample data, desktop (screen 21). Owner: E5. Add a screen: one file + one line here. */
import type { RouteObject } from 'react-router-dom';
import { screenRoute } from '../../ui/routeMeta';

export const insightsRoutes: RouteObject[] = [
  screenRoute('/insights', { screen: '21', title: 'Bodywise insights (sample data)', owner: 'E5', wide: true }, () => import('./Insights')),
];
