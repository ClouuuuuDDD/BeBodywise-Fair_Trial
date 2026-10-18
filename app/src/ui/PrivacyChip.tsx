import type { ReactNode } from 'react';
import styles from './PrivacyChip.module.css';

/** Teal "Photos never leave this phone" chip with a lock. Pass the copy as children. */
export function PrivacyChip({ children }: { children: ReactNode }) {
  return (
    <span className={styles.chip} data-testid="privacy-chip">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="5" y="11" width="14" height="10" rx="3" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      {children}
    </span>
  );
}
