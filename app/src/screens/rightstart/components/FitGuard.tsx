import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { hasFitAnswers, useRightStart } from '../../../state/rightStart';

/**
 * Guard for screens that need her fit answers (05, 05b): without them she goes back to the first question
 * (SCREENS.md "Routing"). Renders nothing until the vault has been read, so a reload never flashes the wrong screen.
 */
export function FitGuard({ children }: { children: ReactNode }) {
  const s = useRightStart();
  if (!s.ready) return null;
  if (!hasFitAnswers(s)) return <Navigate to="/check/1" replace />;
  return <>{children}</>;
}
