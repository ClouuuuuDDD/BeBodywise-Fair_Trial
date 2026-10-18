import { useEffect, type ReactNode } from 'react';
import { AppStateContext, defaults } from './context';
import { getStore } from './vault';

/** Mounted once in the root layout: opens the vault early. Screens work without it (slices are module singletons). */
export function AppStateProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void getStore();
  }, []);
  return <AppStateContext.Provider value={defaults}>{children}</AppStateContext.Provider>;
}
