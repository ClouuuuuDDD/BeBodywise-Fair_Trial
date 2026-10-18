// Runs the shared Store contract against the real IndexedDB store, on fake-indexeddb in Node.
// The polyfill is installed for this file only (Vitest isolates test files), so other suites keep
// testing the no-IndexedDB fallback.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createStore, openIdbStore } from '../index';
import { contract } from './storeContract';

let n = 0;
contract('idb (fake-indexeddb)', () => openIdbStore(`test-${++n}`));

describe('createStore with IndexedDB present', () => {
  it('opens the IndexedDB store, not the memory fallback', async () => {
    const s = await createStore(`test-create-${++n}`);
    expect(s.kind).toBe('idb');
    s.close();
  });
});
