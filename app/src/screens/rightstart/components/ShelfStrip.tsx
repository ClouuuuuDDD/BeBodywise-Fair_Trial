import type { ShelfItem } from '../../../contracts';
import { Mascot } from '../../../ui';
import { mascotForItem } from './mascotFor';
import styles from './ShelfStrip.module.css';

/** Her products standing on a shelf line (screen 04). The newest one drops in (signature motion, 150 ms fade when motion is reduced). */
export function ShelfStrip({ items, justAdded }: { items: ShelfItem[]; justAdded?: string }) {
  if (items.length === 0) return <div className={styles.plank} aria-hidden="true" data-empty="true"><span className={styles.board} /></div>;
  return (
    <div className={styles.plank} aria-hidden="true">
      {items.slice(0, 4).map((item, i) => (
        <span key={item.id} className={[styles.slot, item.id === justAdded ? styles.drop : ''].filter(Boolean).join(' ')} style={{ left: i * 86 - 6 }}>
          <Mascot id={mascotForItem(item)} size={82} alt="" />
        </span>
      ))}
      <span className={styles.board} />
    </div>
  );
}
