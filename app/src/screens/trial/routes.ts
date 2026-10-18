/** Fair Trial: routine, Day 0 photos, date, home, reaction desk, skin file, verdict, share (screens 07-19). Owner: E5. Add a screen: one file + one line here. */
import type { RouteObject } from 'react-router-dom';
import { screenRoute } from '../../ui/routeMeta';

export const trialRoutes: RouteObject[] = [
  screenRoute('/start/routine', { screen: '07', title: 'Your routine', owner: 'E5' }, () => import('./Routine')),
  screenRoute('/start/photo', { screen: '08', title: 'Starting photo', owner: 'E5' }, () => import('./StartingPhoto')),
  screenRoute('/trial/halfway', { screen: '08', title: 'Halfway photo (Starting photo, halfway variant)', owner: 'E5' }, () => import('./StartingPhoto')),
  screenRoute('/verdict/photo', { screen: '08', title: 'Verdict photos (Starting photo, verdict variant)', owner: 'E5' }, () => import('./StartingPhoto')),
  screenRoute('/start/photo/check', { screen: '09', title: 'Photo check', owner: 'E5' }, () => import('./PhotoCheck')),
  screenRoute('/start/date', { screen: '10', title: 'Your date', owner: 'E5' }, () => import('./YourDate')),
  screenRoute('/trial', { screen: '11', title: 'Home: your trial (14 bottle running out is a state)', owner: 'E5' }, () => import('./TrialHome')),
  screenRoute('/help', { screen: '12', title: 'Something feels off', owner: 'E5' }, () => import('./FeelsOff')),
  screenRoute('/help/answer', { screen: '13', title: 'Reaction answer', owner: 'E5' }, () => import('./ReactionAnswer')),
  screenRoute('/file', { screen: '15', title: 'Skin file', owner: 'E5' }, () => import('./SkinFile')),
  screenRoute('/verdict/pick', { screen: '16', title: 'Blind pick', owner: 'E5' }, () => import('./BlindPick')),
  screenRoute('/verdict', { screen: '17', title: 'Verdict (17 Working, 18 Not for you, and the other outcomes as states)', owner: 'E5' }, () => import('./Verdict')),
  screenRoute('/verdict/share', { screen: '19', title: 'Share your result', owner: 'E5' }, () => import('./ShareResult')),
];
