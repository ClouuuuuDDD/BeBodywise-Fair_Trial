/**
 * Right Start state (screens 01-06): fit answers, the shelf she is building, the pick inputs and the saved plan.
 * Owner: E4. A module singleton read with `useRightStart()`, so every lazy-loaded screen shares one copy.
 *
 * Persistence: the shelf and the plan live in the vault (IndexedDB via app/src/store). The in-progress fit answers
 * (no plan exists yet, and the store has no draft slot) are kept in localStorage under DRAFT_KEY so a reload on
 * question 4 resumes. Nothing here is ever sent anywhere.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
  BodyArea,
  BodywiseProductId,
  CatalogId,
  Channel,
  FitAnswers,
  FitResult,
  ISODate,
  PickInput,
  Plan,
  PregnancyAnswer,
  ProductPick,
  ShelfAnswer,
  ShelfItem,
  ShelfSource,
  UseTime,
} from '../contracts';
import { DEFAULT_ANCHOR_PRODUCT } from '../engine/config';
import { fit as runFit, makePlanCode, pairRules, pickProduct, rulesVersion, startPlan } from '../engine';
import { randomUuid, requestPersistence } from '../store';
import { reloadLive } from './trial';
import { getStore, track } from './vault';
import { useExample } from './example';

const DRAFT_KEY = 'fairtrial.rightstart.draft';

/** A product she is adding, between the label read (04a) and the confirm screen (04b). Never persisted. */
export interface ShelfDraft {
  /** Name from the front photo, a typed name, or the catalog. */
  product: string;
  /** How it got here. */
  source: ShelfSource;
  /** Ingredient list as read or typed, one entry per ingredient (she can edit it on 04b). */
  inci: string[];
  /** Set for Bodywise products picked from the catalog (no label read needed). */
  catalogId?: CatalogId;
  /** True when it came from two label photos (changes the meta line). */
  fromPhotos: boolean;
}

/** Everything the Right Start screens read. */
export interface RightStartState {
  /** False until the vault has been read once. Guards wait for this before redirecting. */
  ready: boolean;
  /** Door she came through (`?src=`). */
  channel: Channel;
  /** Date of the fit check; shown on 06 as "Your plan from 14 October". */
  checkedOn: ISODate | undefined;
  /** Fit answers so far. */
  fit: FitAnswers;
  /** Answer to the pregnancy question (05b sheet), once asked. */
  pregnancy: PregnancyAnswer | undefined;
  /** Her shelf, in the order added. */
  shelf: ShelfItem[];
  /** Saved plan, if she saved one. */
  plan: Plan | undefined;
  /** Product being added right now. */
  draft: ShelfDraft | undefined;
}

const INITIAL: RightStartState = {
  ready: false,
  channel: 'direct',
  checkedOn: undefined,
  fit: {},
  pregnancy: undefined,
  shelf: [],
  plan: undefined,
  draft: undefined,
};

let state: RightStartState = INITIAL;
const listeners = new Set<() => void>();
let hydration: Promise<void> | undefined;

function set(patch: Partial<RightStartState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/* ---------------------------------------------------------------- local draft */

interface Draft {
  channel: Channel;
  checkedOn?: ISODate;
  fit: FitAnswers;
  pregnancy?: PregnancyAnswer;
}

function readDraft(): Draft | undefined {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : undefined;
  } catch {
    return undefined;
  }
}

function writeDraft(): void {
  try {
    const draft: Draft = { channel: state.channel, fit: state.fit };
    if (state.checkedOn) draft.checkedOn = state.checkedOn;
    if (state.pregnancy) draft.pregnancy = state.pregnancy;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* private window: the answers still work for this visit */
  }
}

function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

const seen = new Set<string>();

/** True the first time a key is used in this page load. Keeps a StrictMode double effect from writing an event twice. */
export function firstTime(key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

/** Today on her phone as YYYY-MM-DD (local time). */
export function todayISO(now: Date = new Date()): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/* ---------------------------------------------------------------- hydrate */

/** Reads the vault and the local draft once. Safe to call from every screen. */
export function hydrate(): Promise<void> {
  hydration ??= (async () => {
    try {
      const store = await getStore();
      const [plan, shelf] = await Promise.all([store.getPlan(), store.listShelf()]);
      const draft = readDraft();
      set({
        ready: true,
        plan,
        shelf: plan && shelf.length === 0 ? plan.shelf : shelf,
        channel: draft?.channel ?? plan?.channel ?? 'direct',
        checkedOn: draft?.checkedOn ?? plan?.checkedOn,
        fit: draft?.fit ?? plan?.fit ?? {},
        pregnancy: draft?.pregnancy ?? plan?.pregnancy,
      });
    } catch {
      set({ ready: true });
    }
  })();
  return hydration;
}

/**
 * The Right Start state; reads the vault on first use. In example mode it shows Riya's seeded answers and shelf
 * from the example plan instead, without writing them into her real state.
 */
export function useRightStart(): RightStartState {
  useEffect(() => {
    void hydrate();
  }, []);
  const real = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  const example = useExample();
  return useMemo(() => {
    if (!example) return real;
    const { fit, shelf, pregnancy, checkedOn } = example.plan;
    return { ...real, ready: true, fit, shelf, pregnancy, checkedOn };
  }, [real, example]);
}

/** True when she has answered at least the shade question: the guard for 05 and 05b. */
export function hasFitAnswers(s: RightStartState): boolean {
  return s.fit.shade !== undefined;
}

/* ---------------------------------------------------------------- derived */

/** Shelf answers against the default anchor (the 4% roll-on): feeds 05 and the pick. */
export function shelfAnswersFor(shelf: ShelfItem[], anchor: BodywiseProductId = DEFAULT_ANCHOR_PRODUCT): ShelfAnswer[] {
  return pairRules(shelf, anchor);
}

/** The pick for the current answers. Second pass (FR-M3-08): her shelf is rechecked against the product she would buy. */
export function pickFor(s: Pick<RightStartState, 'fit' | 'shelf' | 'pregnancy'>): {
  pick: ProductPick;
  shelfAnswers: ShelfAnswer[];
  fitResult: FitResult;
  input: PickInput;
} {
  const first = shelfAnswersFor(s.shelf);
  const base: PickInput = { fit: s.fit, shelf: s.shelf, shelfAnswers: first };
  if (s.pregnancy) base.pregnancy = s.pregnancy;
  const initial = pickProduct(base);
  const target = initial.pick;
  const shelfAnswers = target && target !== DEFAULT_ANCHOR_PRODUCT ? shelfAnswersFor(s.shelf, target) : first;
  const input: PickInput = { ...base, shelfAnswers };
  const pick = target && target !== DEFAULT_ANCHOR_PRODUCT ? pickProduct(input) : initial;
  return { pick, shelfAnswers, fitResult: runFit(s.fit), input };
}

/* ---------------------------------------------------------------- actions */

/** Remembers the door (`?src=`). */
export function setChannel(channel: Channel): void {
  if (state.channel === channel) return;
  set({ channel });
  writeDraft();
}

/** Stores one fit answer. Q1 also stamps the check date. */
export function answerFit<K extends keyof FitAnswers>(key: K, value: NonNullable<FitAnswers[K]>): void {
  const checkedOn = state.checkedOn ?? todayISO();
  set({ fit: { ...state.fit, [key]: value }, checkedOn });
  writeDraft();
}

/** Stores the pregnancy answer. */
export function answerPregnancy(answer: PregnancyAnswer): void {
  set({ pregnancy: answer });
  writeDraft();
}

/** Starts the fit check again from a clean slate (shelf and plan are kept). */
export function restartFit(): void {
  set({ fit: {}, pregnancy: undefined, checkedOn: undefined });
  writeDraft();
}

/** Sets or clears the product being added. */
export function setDraft(draft: ShelfDraft | undefined): void {
  set({ draft });
}

/** Adds a confirmed product to the shelf and saves it. */
export async function addShelfItem(item: ShelfItem): Promise<void> {
  set({ shelf: [...state.shelf, item], draft: undefined });
  try {
    await (await getStore()).putShelfItem(item);
  } catch {
    /* kept in memory for this visit */
  }
}

/** Changes where or when she uses a product already on the shelf. */
export async function updateShelfItem(id: string, patch: { areas?: BodyArea[]; times?: UseTime }): Promise<void> {
  const next = state.shelf.map((i) => (i.id === id ? { ...i, ...patch } : i));
  set({ shelf: next });
  const updated = next.find((i) => i.id === id);
  if (!updated) return;
  try {
    await (await getStore()).putShelfItem(updated);
  } catch {
    /* ignore */
  }
}

/** Removes a product from the shelf. */
export async function removeShelfItem(id: string): Promise<ShelfItem | undefined> {
  const gone = state.shelf.find((i) => i.id === id);
  set({ shelf: state.shelf.filter((i) => i.id !== id) });
  try {
    await (await getStore()).deleteShelfItem(id);
  } catch {
    /* ignore */
  }
  return gone;
}

/** A fresh id for a shelf item. */
export function newItemId(): string {
  return randomUuid();
}

/**
 * "Save my plan" (FR-M4-05, FR-M5-01): makes the plan code, stores the plan on the phone and asks the browser to keep
 * the storage. Never requires a purchase; a purchase never requires this.
 */
export async function savePlan(): Promise<Plan> {
  const store = await getStore();
  const { pick, shelfAnswers, fitResult } = pickFor(state);
  const product = pick.pick ?? undefined;
  const plan: Plan = {
    planCode: state.plan?.planCode ?? makePlanCode(Math.random),
    trialId: await store.getTrialId(),
    mode: 'live',
    checkedOn: state.checkedOn ?? todayISO(),
    channel: state.channel,
    fit: state.fit,
    fitResult,
    shelf: state.shelf,
    shelfAnswers,
    pick,
    startPlan: startPlan(pick, state.shelf, shelfAnswers, state.fit, product),
    dayLog: state.plan?.dayLog ?? [],
    reactions: state.plan?.reactions ?? [],
    photoIds: state.plan?.photoIds ?? [],
    photosSkipped: state.plan?.photosSkipped ?? false,
    rulesVersion: rulesVersion(),
  };
  if (state.pregnancy) plan.pregnancy = state.pregnancy;
  if (product) plan.trialProduct = product;
  await store.putPlan(plan);
  set({ plan });
  // A trial screen (or the demo bar) may already have read the vault before this plan existed.
  await reloadLive();
  clearDraft();
  void requestPersistence();
  track('plan_saved', '05b', { channel: plan.channel, product_id: product ?? null });
  return plan;
}

/** Loads answers and a shelf from elsewhere (the example trial's "check" stop). Does not touch the vault. */
export function seed(input: { fit: FitAnswers; shelf: ShelfItem[]; pregnancy?: PregnancyAnswer; checkedOn?: ISODate }): void {
  set({
    ready: true,
    fit: input.fit,
    shelf: input.shelf,
    pregnancy: input.pregnancy,
    checkedOn: input.checkedOn ?? state.checkedOn,
  });
}

/** Forgets everything in memory (after "Delete everything from this phone"). The vault is wiped by the caller. */
export function reset(): void {
  clearDraft();
  hydration = undefined;
  set({ ...INITIAL, ready: true });
}

/** Test hook: back to a clean module. */
export function resetForTests(): void {
  seen.clear();
  state = INITIAL;
  hydration = undefined;
  listeners.clear();
}
