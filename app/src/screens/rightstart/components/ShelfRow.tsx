import type { ShelfItem } from '../../../contracts';
import { Mascot } from '../../../ui';
import { shelf as shelfCopy } from '../copy';
import { tagsFor } from './activeInfo';
import { itemMeta } from './itemMeta';
import { mascotForItem } from './mascotFor';
import styles from './ShelfRow.module.css';

/** One product on her shelf: character, name, key active tags, where and when. Tapping opens the edit sheet. */
export function ShelfRow({ item, onOpen }: { item: ShelfItem; onOpen: () => void }) {
  const tags = tagsFor(item);
  return (
    <button type="button" className={styles.row} onClick={onOpen} data-testid="shelf-row">
      <span className={styles.thumb}>
        <Mascot id={mascotForItem(item)} size={44} alt="" />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{item.product}</span>
        <span className={styles.meta}>
          {tags.map((t) => (
            <span key={t.label} className={styles.tag} style={{ background: t.tone.bg, color: t.tone.fg }}>
              {t.label}
            </span>
          ))}
          <span className={styles.where}>{itemMeta(item)}</span>
        </span>
      </span>
      {/* Spoken after the visible text, so the accessible name still starts with what is shown (WCAG 2.5.3). */}
      <span className="sr-only">. {shelfCopy.edit}</span>
    </button>
  );
}
