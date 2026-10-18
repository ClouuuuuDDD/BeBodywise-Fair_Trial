import { createContext, useContext } from 'react';
import type { AnalyticsEventName, AnalyticsEventProps, AppMode } from '../contracts';
import type { Store } from '../store';
import { getStore, track } from './vault';

/** What a slice needs from the app: the vault and a fire-and-forget event logger. */
export interface AppState {
  getStore: () => Promise<Store>;
  track: <K extends AnalyticsEventName>(event: K, screen: string, props: AnalyticsEventProps[K], mode?: AppMode) => void;
}

export const defaults: AppState = { getStore, track };
export const AppStateContext = createContext<AppState>(defaults);

/** The vault and the event logger. */
export function useAppState(): AppState {
  return useContext(AppStateContext);
}
