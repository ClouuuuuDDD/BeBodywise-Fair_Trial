import type { BodywiseProductId } from '../../../contracts';
import { Mascot } from '../../../ui';
import { kitPair, mascotForCatalog } from './mascotFor';

/** The character for a Bodywise product; a kit shows its two characters side by side, overlapped. */
export function ProductArt({ id, size }: { id: BodywiseProductId; size: number }) {
  const pair = kitPair(id);
  if (!pair) return <Mascot id={mascotForCatalog(id)} size={size} alt="" />;
  const small = Math.round(size * 0.72);
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: Math.round(size * 0.9) }} aria-hidden="true">
      <Mascot id={pair[0]} size={small} alt="" style={{ position: 'absolute', left: 0, top: 2 }} />
      <Mascot id={pair[1]} size={Math.round(size * 0.66)} alt="" style={{ position: 'absolute', right: 0, bottom: 0 }} />
    </span>
  );
}
