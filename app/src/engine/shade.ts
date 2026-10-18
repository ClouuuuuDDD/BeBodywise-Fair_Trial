import type { ShadeInfo, ShadeLevel } from '../contracts';
import { catalog } from './data';

const LEVELS = catalog.severity_scale.levels as ShadeLevel[];

/** Resolves a shade answer to its on-screen label (catalog severity_scale) and a 0-3 rank. */
export function shade(level: ShadeLevel): ShadeInfo {
  const rank = LEVELS.indexOf(level);
  if (rank < 0) throw new Error(`Unknown shade level: ${level}`);
  return { level, label: catalog.severity_scale.answers[level], rank: rank as ShadeInfo['rank'] };
}
