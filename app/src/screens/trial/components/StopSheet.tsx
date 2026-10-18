import { useNavigate } from 'react-router-dom';
import type { StopReason } from '../../../contracts';
import { stopTrial, useTrial } from '../../../state/trial';
import { track } from '../../../state/vault';
import { PrimaryButton, Sheet } from '../../../ui';
import styles from './trial.module.css';

const REASONS: { value: StopReason; label: string }[] = [
  { value: 'reaction', label: 'Reaction' },
  { value: 'too-slow', label: 'Too slow' },
  { value: 'no-change', label: 'No change' },
  { value: 'price', label: 'Price' },
  { value: 'forgot', label: 'Forgot' },
  { value: 'other', label: 'Other' },
];

/** "What made you stop?" One tap, skippable. The reason stays on this phone until she says Yes on 19 (FR-M12-03). */
export function StopSheet({ open, onClose, from }: { open: boolean; onClose: () => void; from: 'refill' | 'home' }) {
  const navigate = useNavigate();
  const { trial } = useTrial();

  function finish(reason: StopReason | undefined) {
    stopTrial(reason);
    track('trial_stopped', '14', { use_day: trial?.useDaysSoFar ?? 0, from });
    track('stop_reason_answered', '14', { reason: reason ?? 'skipped' });
    onClose();
    void navigate('/verdict/share?stop=1');
  }

  return (
    <Sheet open={open} onClose={onClose} title="What made you stop?" footer={<PrimaryButton variant="secondary" size="sm" data-testid="stop-skip" onClick={() => finish(undefined)}>Skip</PrimaryButton>}>
      <p className={styles.sheetLead}>One tap. It helps Bodywise learn, anonymously, only if you share.</p>
      <div className={styles.reasonGrid}>
        {REASONS.map((r) => (
          <button key={r.value} type="button" className={styles.reason} data-testid={`stop-${r.value}`} onClick={() => finish(r.value)}>
            {r.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
