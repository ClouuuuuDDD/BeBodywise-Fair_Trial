import type { CSSProperties, ElementType, ReactNode } from 'react';
import styles from './ResultCard.module.css';

export type CardTone = 'white' | 'mint' | 'peach' | 'rose' | 'lilac' | 'butter';

export interface CornerRibbonProps {
  /** Number (shelf order, step) or short label. A string with a line break: use two lines via <br />. */
  children: ReactNode;
  /** "number": 32x44 folded tab at top-left. "label": wider tab at top-right ("Best for you"). */
  kind?: 'number' | 'label';
  /** Ribbon fill; default blue (--primary). Use a character's ribbon colour on shelf cards. */
  color?: string;
  /** Text colour on the ribbon; default white. Use ink on butter. */
  textColor?: string;
  /** Distance from the card edge in px (default 18; the trial card uses 20). */
  offset?: number;
}

/** Folded ribbon that hangs off a card's top edge. Place inside a ResultCard (or pass as `ribbon`). */
export function CornerRibbon({ children, kind = 'number', color, textColor, offset }: CornerRibbonProps) {
  const style: CSSProperties = {};
  if (offset !== undefined) style[kind === 'number' ? 'left' : 'right'] = offset;
  if (color) style.background = color;
  if (textColor) style.color = textColor;
  return (
    <span className={kind === 'number' ? styles.ribNum : styles.ribLabel} style={style}>
      {children}
    </span>
  );
}

export interface ResultCardProps {
  children: ReactNode;
  /** Card tint: white (default) or a stage colour (mint = fine, peach = pause, rose = stop, lilac = hormone note, butter = highlight). */
  tone?: CardTone;
  /** Blue 3 px keyline (the recommended or selected card). */
  highlight?: boolean;
  /** Ribbon node, usually <CornerRibbon>. */
  ribbon?: ReactNode;
  /** "lg" 28 px radius and the big lift (hero cards, default); "sm" 22 px for rows and secondary cards. */
  size?: 'lg' | 'sm';
  /** Inner padding preset: "md" 22/18 (default), "sm" 14/16, "none". */
  padding?: 'md' | 'sm' | 'none';
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** The printed-sticker card: white (or tinted), rounded, soft lift, optional corner ribbon. */
export function ResultCard({
  children,
  tone = 'white',
  highlight,
  ribbon,
  size = 'lg',
  padding = 'md',
  as: Tag = 'div',
  className,
  style,
  ...rest
}: ResultCardProps) {
  const cls = [
    styles.card,
    size === 'sm' ? styles.sm : styles.lg,
    styles[`tone-${tone}`],
    styles[`pad-${padding}`],
    highlight ? styles.highlight : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={cls} style={style} {...rest}>
      {ribbon}
      {children}
    </Tag>
  );
}
