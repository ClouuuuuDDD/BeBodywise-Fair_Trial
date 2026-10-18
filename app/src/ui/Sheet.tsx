import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Sheet title (Baloo 22). Also the dialog's accessible name. */
  title: string;
  children: ReactNode;
  /** Button row pinned under the content, usually a <PrimaryButton>. */
  footer?: ReactNode;
  /** aria-label of the close button. Default "Close". */
  closeLabel?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet / modal. Slides up from the bottom (fades with reduced motion), traps focus, closes on
 * Escape, backdrop tap or the close button, locks page scroll and returns focus to what opened it.
 * Content is not mounted while closed.
 */
export function Sheet({ open, onClose, title, children, footer, closeLabel = 'Close' }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Mount as soon as `open` flips (derived during render), then flip `entered` a frame later so the
  // enter transition runs. On close the panel stays mounted for the exit transition, then unmounts.
  if (open && !mounted) setMounted(true);
  const shown = open && entered;

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setEntered(true));
      return () => {
        cancelAnimationFrame(id);
        setEntered(false);
      };
    }
    const t = window.setTimeout(() => setMounted(false), 260);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div className={[styles.root, shown ? styles.shown : ''].filter(Boolean).join(' ')}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="sheet"
      >
        <span className={styles.grip} aria-hidden="true" />
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className={styles.content}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
