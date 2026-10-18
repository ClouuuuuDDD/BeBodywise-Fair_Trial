import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { PlanCodeTag } from './PlanCodeTag';
import { PrivacyChip } from './PrivacyChip';
import { StepProgress } from './StepProgress';
import styles from './AppHeader.module.css';

export const CONCEPT_LABEL = 'Concept for Be Bodywise';

export interface AppHeaderProps {
  /**
   * Back control. `true`: history back. A string: link to that path. A function: called on tap.
   * Omit for no back (welcome, home, verdicts).
   */
  back?: boolean | string | (() => void);
  /** Running head, e.g. "Right Start · 2 of 5", "Fair Trial · Day 23 of 56". Printed as a micro label. */
  title?: string;
  /** Step dots on the right ("2 of 5" for assistive tech). */
  step?: { current: number; total: number };
  /** Plan code on the right (every screen after the check), e.g. "FT-4K7Q". */
  planCode?: string;
  /** Teal privacy chip under the header row, e.g. "Photos never leave this phone". */
  privacyLabel?: string;
  /** Brand word at the left instead of a running head (welcome). */
  brand?: string;
  /** Show "Concept for Be Bodywise" at the right (welcome, product door). */
  concept?: boolean;
  /** Anything else for the right slot. */
  right?: ReactNode;
  /** Colour of the running head (verdict screens tint it). */
  titleColor?: string;
}

/** The top line of every screen: back, running head, and a step, plan code or concept label. */
export function AppHeader({
  back,
  title,
  step,
  planCode,
  privacyLabel,
  brand,
  concept,
  right,
  titleColor,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const hasBack = back !== undefined && back !== false;

  let backEl: ReactNode = null;
  if (hasBack) {
    const icon = <Icon name="back" />;
    backEl =
      typeof back === 'string' ? (
        <Link to={back} className={styles.back} aria-label="Back" data-testid="back">
          {icon}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.back}
          aria-label="Back"
          data-testid="back"
          onClick={() => (typeof back === 'function' ? back() : void navigate(-1))}
        >
          {icon}
        </button>
      );
  }

  const rightEl: ReactNode =
    right ??
    (step ? (
      <StepProgress current={step.current} total={step.total} />
    ) : planCode ? (
      <PlanCodeTag code={planCode} />
    ) : concept ? (
      <span className={styles.concept}>{CONCEPT_LABEL}</span>
    ) : hasBack ? (
      <span className={styles.spacer} aria-hidden="true" />
    ) : null);

  const run = brand ? (
    <span className={styles.brand}>{brand}</span>
  ) : title ? (
    <span className={styles.run} data-testid="running-head" style={titleColor ? { color: titleColor } : undefined}>
      {title}
    </span>
  ) : null;

  return (
    <header className={[styles.header, hasBack ? styles.withBack : styles.plain].join(' ')}>
      <div className={styles.row}>
        {backEl}
        {run}
        {rightEl}
      </div>
      {privacyLabel ? (
        <div className={styles.privacy}>
          <PrivacyChip>{privacyLabel}</PrivacyChip>
        </div>
      ) : null}
    </header>
  );
}
