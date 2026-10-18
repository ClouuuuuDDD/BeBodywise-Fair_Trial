import type { ReactNode } from 'react';
import { AppHeader, type AppHeaderProps } from './AppHeader';
import styles from './AppShell.module.css';

export interface AppShellProps {
  /** Screen id for tests and the dev index, e.g. "03b". Becomes data-screen on the root. */
  screen: string;
  /** Header content; omit for a screen with no header row. */
  header?: AppHeaderProps;
  /**
   * Ground: "dots" (lavender with the faint sprinkle, default) or "plain" (no sprinkle: the reaction,
   * verdict and share stages).
   */
  ground?: 'dots' | 'plain';
  /** Lay the header over the first block (verdict stages bleed under it). */
  overlayHeader?: boolean;
  /** Full-width strip above the header, e.g. <ExampleBanner />. */
  banner?: ReactNode;
  children: ReactNode;
}

/**
 * One phone screen. Fills the column (max 480 px, centred by RootLayout), draws the header, then the
 * body in a flex column with 20 px gutters. End the body with <BottomBar> and it sits in the thumb
 * zone (margin-top: auto). <VerdictBadge> bleeds to the screen edge by itself.
 */
export function AppShell({ screen, header, ground = 'dots', overlayHeader, banner, children }: AppShellProps) {
  return (
    <div className={[styles.shell, ground === 'plain' ? styles.plain : ''].filter(Boolean).join(' ')} data-screen={screen}>
      {banner}
      {header ? (
        <div className={overlayHeader ? styles.overlay : styles.headWrap}>
          <AppHeader {...header} />
        </div>
      ) : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
