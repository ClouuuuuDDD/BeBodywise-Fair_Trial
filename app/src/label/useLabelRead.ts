import { useCallback, useRef, useState } from 'react';
import { readLabelPhoto } from './readLabel';
import type { LabelKind, LabelReadResult } from './types';

export type LabelReadState =
  | { phase: 'idle' }
  | { phase: 'reading'; kind: LabelKind }
  | { phase: 'done'; result: LabelReadResult };

/**
 * For screens 04a/04b. `read(photo, kind)` resolves with the result and also updates `state`.
 * A newer read cancels the effect of an older one. Copy: s04a.reading while phase is "reading";
 * s04a.retake when result.status is "retake"; "type it in" when "manual".
 */
export function useLabelRead() {
  const [state, setState] = useState<LabelReadState>({ phase: 'idle' });
  const run = useRef(0);

  const read = useCallback(async (photo: Blob, kind: LabelKind) => {
    const id = ++run.current;
    setState({ phase: 'reading', kind });
    const result = await readLabelPhoto(photo, kind);
    if (id === run.current) setState({ phase: 'done', result });
    return result;
  }, []);

  const reset = useCallback(() => {
    run.current++;
    setState({ phase: 'idle' });
  }, []);

  return { state, read, reset };
}
