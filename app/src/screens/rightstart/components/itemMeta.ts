import type { BodyArea, ShelfItem, UseTime } from '../../../contracts';
import { shelf as shelfCopy } from '../copy';

const AREA_WORD: Record<BodyArea, string> = { underarm: 'underarms', face: 'face', body: 'body', neck: 'neck' };
const TIME_WORD: Record<UseTime, string> = { morning: 'Morning', night: 'Night', both: 'Both', 'now-and-then': 'Now and then' };

/** "Face, underarms · Night · stung once" (copy s04.itemMeta). */
export function itemMeta(item: ShelfItem): string {
  const areas = item.areas.map((a) => AREA_WORD[a]).join(', ');
  const cap = areas.charAt(0).toUpperCase() + areas.slice(1);
  return `${cap} · ${TIME_WORD[item.times]}${item.stung ? shelfCopy.stungNote : ''}`;
}
