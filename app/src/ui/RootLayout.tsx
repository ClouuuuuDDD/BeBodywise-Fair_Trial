import { Outlet, useMatches } from 'react-router-dom';
import { useExample } from '../state/example';
import { AppStateProvider } from '../state/AppStateProvider';
import { ExampleBar } from './ExampleBar';
import { TourLayer } from './tour/TourLayer';
import type { ScreenHandle } from './routeMeta';

/** The one phone column (max 480 px). Pages whose handle sets `wide` (insights) use the full width. */
export function RootLayout() {
  const matches = useMatches();
  const handle = matches[matches.length - 1]?.handle as ScreenHandle | undefined;
  const example = useExample();
  // Right Start screens (owner E4) have no trial banner of their own: show the Example tag here so it is on every example screen.
  const showTag = example !== null && handle?.owner === 'E4';
  return (
    <main className={handle?.wide ? 'app-column app-column--wide' : 'app-column'}>
      <AppStateProvider>
        {showTag ? <ExampleBar /> : null}
        <TourLayer />
        <Outlet />
      </AppStateProvider>
    </main>
  );
}
