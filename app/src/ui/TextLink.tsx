import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './TextLink.module.css';

export interface TextLinkProps {
  children: ReactNode;
  to?: string;
  href?: string;
  external?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  /**
   * "block" (default): a centred, 46 px tall link under the primary pill ("Open my skin file").
   * "inline": runs inside a sentence.
   */
  layout?: 'block' | 'inline';
  /** "muted": the small grey 13 px link (canvas-only previews). */
  tone?: 'default' | 'muted';
  'data-testid'?: string;
}

/** A text link: route, URL or button action, always 44 px tall when standing alone. */
export function TextLink({
  children,
  to,
  href,
  external,
  onClick,
  layout = 'block',
  tone = 'default',
  'data-testid': testId,
}: TextLinkProps) {
  const cls = [styles.link, layout === 'block' ? styles.block : styles.inline, tone === 'muted' ? styles.muted : '']
    .filter(Boolean)
    .join(' ');
  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick} data-testid={testId}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a
        href={href}
        className={cls}
        onClick={onClick}
        data-testid={testId}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  );
}
