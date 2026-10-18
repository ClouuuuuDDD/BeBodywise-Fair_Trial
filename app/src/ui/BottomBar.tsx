import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DrMehr } from './DrMehr';
import styles from './BottomBar.module.css';

export const FEELS_OFF_LABEL = 'Something feels off';

export interface FeelsOffPillProps {
  /** Route to the reaction desk (/help). */
  to?: string;
  onClick?: () => void;
}

/** White pill with a calm Dr. Mehr icon. On every trial screen. */
export function FeelsOffPill({ to = '/help', onClick }: FeelsOffPillProps) {
  const inner = (
    <>
      <DrMehr pose="concerned" size={24} alt="" />
      <span>{FEELS_OFF_LABEL}</span>
    </>
  );
  return to && !onClick ? (
    <Link to={to} className={styles.help} data-testid="feels-off">
      {inner}
    </Link>
  ) : (
    <button type="button" className={styles.help} data-testid="feels-off" onClick={onClick}>
      {inner}
    </button>
  );
}

export interface BottomBarProps {
  /** Usually a <PrimaryButton> and a <TextLink>. */
  children?: ReactNode;
  /** Add the "Something feels off" pill (trial screens). `true` goes to /help; or give a route or a handler. */
  feelsOff?: boolean | string | (() => void);
  /** Stay pinned to the bottom of the viewport on long screens (the shelf answer, the match). */
  sticky?: boolean;
}

/** The thumb-zone block: the primary action is always in the bottom 30% of the screen. Last child of AppShell. */
export function BottomBar({ children, feelsOff, sticky }: BottomBarProps) {
  const pill =
    feelsOff === undefined || feelsOff === false ? null : typeof feelsOff === 'function' ? (
      <FeelsOffPill onClick={feelsOff} />
    ) : typeof feelsOff === 'string' ? (
      <FeelsOffPill to={feelsOff} />
    ) : (
      <FeelsOffPill />
    );
  return (
    <div className={[styles.bar, sticky ? styles.sticky : ''].filter(Boolean).join(' ')}>
      {children}
      {pill}
    </div>
  );
}
