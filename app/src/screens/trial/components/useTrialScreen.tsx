import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ExampleBar } from '../../../ui/ExampleBar';
import { useTrial, type TrialView } from '../../../state/trial';

export interface TrialScreen extends TrialView {
  /** Pass to AppShell `banner`. */
  banner: ReactNode;
  /** Render this instead of the screen while the vault loads (null) or when there is no plan (a redirect). */
  gate: ReactNode | undefined;
}

/**
 * Common to every trial screen: the active plan, the example banner, and the guard (no plan: back to the fit
 * check, FR guard in SCREENS.md).
 */
export function useTrialScreen(options: { needDay0?: boolean } = {}): TrialScreen {
  const t = useTrial();
  const banner = t.isExample ? <ExampleBar /> : undefined;
  let gate: ReactNode | undefined;
  if (!t.ready) gate = null;
  else if (!t.plan) gate = <Navigate to="/check/1" replace />;
  else if (options.needDay0 && !t.plan.day0) gate = <Navigate to="/start" replace />;
  return { ...t, banner, gate };
}
