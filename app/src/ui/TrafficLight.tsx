import type { ReactNode } from 'react';
import styles from './TrafficLight.module.css';

export type TrafficLevel = 'green' | 'amber' | 'red';

export interface TrafficLightProps {
  /** green = keep going, amber = pause, red = stop / see a doctor. */
  level: TrafficLevel;
  /** The answer in Baloo 40 px, e.g. "Pause for 3 days." */
  title: ReactNode;
  /** One or two plain lines under the title. */
  children?: ReactNode;
  /** Art that overlaps the stage's bottom-right, usually <DrMehr pose="concerned" size={108} />. Calm, never cute: no sparkles. */
  art?: ReactNode;
  /** Override the three mood labels. Default: Keep going, Pause, Stop. */
  labels?: [string, string, string];
}

const ORDER: TrafficLevel[] = ['green', 'amber', 'red'];

/** The reaction answer: three moods (the active one filled) above a tinted stage with the answer in big type. */
export function TrafficLight({ level, title, children, art, labels = ['Keep going', 'Pause', 'Stop'] }: TrafficLightProps) {
  return (
    <div data-testid="traffic-light" data-level={level}>
      <div className={styles.moods} role="group" aria-label={`${labels[0]}, ${labels[1].toLowerCase()} or ${labels[2].toLowerCase()}`}>
        {ORDER.map((l, i) => (
          <span
            key={l}
            className={[styles.mood, l === level ? styles[`on-${l}`] : ''].filter(Boolean).join(' ')}
            aria-current={l === level ? 'true' : undefined}
          >
            {labels[i]}
          </span>
        ))}
      </div>
      <div className={[styles.stage, styles[`stage-${level}`]].join(' ')}>
        {art ? <div className={styles.art}>{art}</div> : null}
        <p className={[styles.title, art ? styles.narrow : ''].filter(Boolean).join(' ')}>{title}</p>
        {children ? <div className={[styles.body, art ? styles.narrow : ''].filter(Boolean).join(' ')}>{children}</div> : null}
      </div>
    </div>
  );
}
