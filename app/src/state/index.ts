/**
 * App state entry point. One vault per page load (vault.ts), shared by every slice:
 * rightStart.ts (E4), trial.ts and example.ts (E5). Slices are module singletons read through hooks,
 * so screens work whether or not <AppStateProvider> is mounted; mounting it only opens the vault early.
 * In example mode the vault tags every event `mode: "example"` and Riya's data never touches her real plan.
 */
export * from './trial';
export { CALM_STOP, enterExample, getExample, isStop, leaveExample, routeOf, STOP_ROUTE, updateExample, useExample } from './example';
export { getStore, injectStoreForTests, localToday, setVaultMode, track, vaultMode } from './vault';
export { useAppState, type AppState } from './context';
export { AppStateProvider } from './AppStateProvider';
