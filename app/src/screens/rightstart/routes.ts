/** Right Start: doors, fit check, shelf check, pick, plan ready (screens 01-06, 03b, 04a, 04b, 05b). Owner: E4. Add a screen: one file + one line here. */
import type { RouteObject } from 'react-router-dom';
import { screenRoute } from '../../ui/routeMeta';

export const rightStartRoutes: RouteObject[] = [
  screenRoute('/door', { screen: '01', title: 'Product page door', owner: 'E4' }, () => import('./ProductDoor')),
  screenRoute('/', { screen: '02', title: 'Welcome', owner: 'E4' }, () => import('./Welcome')),
  screenRoute('/check/1', { screen: '03b', title: 'How dark (fit question 1 of 5)', owner: 'E4' }, () => import('./ShadeQuestion')),
  screenRoute('/check/:step', { screen: '03', title: 'Fit question (2-5 of 5)', owner: 'E4' }, () => import('./FitQuestion')),
  screenRoute('/check/shelf', { screen: '04', title: 'Your shelf', owner: 'E4' }, () => import('./Shelf')),
  screenRoute('/check/shelf/add', { screen: '04a', title: 'Add a product: label photo', owner: 'E4' }, () => import('./AddProduct')),
  screenRoute('/check/shelf/confirm', { screen: '04b', title: 'Check what we read', owner: 'E4' }, () => import('./LabelRead')),
  screenRoute('/check/shelf/answer', { screen: '05', title: 'How your shelf gets along', owner: 'E4' }, () => import('./ShelfResult')),
  screenRoute('/check/match', { screen: '05b', title: 'Your Be Bodywise match', owner: 'E4' }, () => import('./BodywisePick')),
  screenRoute('/start', { screen: '06', title: 'Plan ready (QR in box)', owner: 'E4' }, () => import('./PlanReady')),
];
