import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './PrimaryButton.module.css';

export interface PrimaryButtonProps {
  children: ReactNode;
  /** Client route: renders a router link. */
  to?: string;
  /** External URL: renders an anchor (use with `external` to open in a new tab). */
  href?: string;
  external?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  /**
   * "primary": blue pill, white Baloo label (one per screen, bottom thumb zone).
   * "secondary": white pill, blue label (buy on Amazon, Save my plan).
   * "help": white pill, ink label, for Something feels off (see FeelsOffPill).
   */
  variant?: 'primary' | 'secondary' | 'help';
  /** "lg" 60 px (default, the canvas pill), "md" 58 px, "sm" 50 px (secondary pills in a row). */
  size?: 'lg' | 'md' | 'sm';
  /** Icon at the left of the label (e.g. <Icon name="plus" size={20} />). */
  icon?: ReactNode;
  /** Waits on something (photo measuring, label read): shows "…" and ignores taps; aria-busy. */
  loading?: boolean;
  /** Not available yet. Stays focusable (aria-disabled) so the reason can be read. */
  disabled?: boolean;
  type?: 'button' | 'submit';
  /** Defaults to "primary" / "secondary" by variant (the Playwright hooks). */
  'data-testid'?: string;
}

/** The pill button. Full width, 60 px, Baloo label. Put it in <BottomBar>. */
export function PrimaryButton({
  children,
  to,
  href,
  external,
  onClick,
  variant = 'primary',
  size = 'lg',
  icon,
  loading,
  disabled,
  type = 'button',
  'data-testid': testId,
}: PrimaryButtonProps) {
  const inactive = Boolean(disabled || loading);
  const cls = [styles.btn, styles[variant], styles[size], inactive ? styles.inactive : ''].filter(Boolean).join(' ');
  const tid = testId ?? (variant === 'secondary' ? 'secondary' : variant === 'primary' ? 'primary' : undefined);
  const content = (
    <>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{loading ? '…' : children}</span>
    </>
  );
  const guard: MouseEventHandler<HTMLElement> = (e) => {
    if (inactive) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  if (to && !inactive) {
    return (
      <Link to={to} className={cls} data-testid={tid} onClick={onClick}>
        {content}
      </Link>
    );
  }
  if (href && !inactive) {
    return (
      <a
        href={href}
        className={cls}
        data-testid={tid}
        onClick={onClick}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type={type}
      className={cls}
      data-testid={tid}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      onClick={guard}
    >
      {content}
    </button>
  );
}
