import styles from './PlanCodeTag.module.css';

/** The stamp-like plan code ("FT-4K7Q"), the one identity mark on every screen after the check. */
export function PlanCodeTag({ code }: { code: string }) {
  return (
    <span className={styles.tag} data-testid="plan-code" aria-label={`Plan ${code}`}>
      {code}
    </span>
  );
}
