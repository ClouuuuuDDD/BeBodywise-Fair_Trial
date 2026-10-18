import type { SVGProps } from 'react';

export type IconName = 'back' | 'check' | 'plus' | 'chevron' | 'close' | 'fence' | 'dash' | 'calendar';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

/** One rounded, 2px-ish stroke icon set, inline (no emoji, no icon font). Decorative: aria-hidden. */
export function Icon({ name, size = 22, strokeWidth, ...rest }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest,
  };
  switch (name) {
    case 'back':
      return (
        <svg {...common} strokeWidth={strokeWidth ?? 2.4}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common} strokeWidth={strokeWidth ?? 3}>
          <path d="M5 12l5 5 9-10" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common} strokeWidth={strokeWidth ?? 3}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common} strokeWidth={strokeWidth ?? 2.6}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common} strokeWidth={strokeWidth ?? 2.6}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'fence':
      return (
        <svg {...common} strokeWidth={strokeWidth ?? 2.4}>
          <path d="M4 12h16" strokeDasharray="3 3" />
          <path d="M8 7v10M16 7v10" />
        </svg>
      );
    case 'dash':
      return (
        <svg {...common} strokeWidth={strokeWidth ?? 3.2}>
          <path d="M6 12h12" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common} strokeWidth={strokeWidth ?? 2.2}>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
  }
}

/** Four-point butter star. Max three per screen; never on reaction, doctor or stop screens. */
export function Sparkle({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 1c.9 6.2 4.8 10.1 11 11-6.2.9-10.1 4.8-11 11-.9-6.2-4.8-10.1-11-11C7.2 11.1 11.1 7.2 12 1z" fill="var(--butter)" />
    </svg>
  );
}
