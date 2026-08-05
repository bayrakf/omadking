/**
 * Two devices, one history.
 *
 * The server holds a blob it cannot read, so it cannot merge anything. All of
 * it happens here, and the rules have to be good enough that a person who used
 * their phone in the morning and the web in the evening loses neither.
 *
 * The shape merged is the backup format from `backup.ts` — one serialiser, two
 * destinations. A sync payload and an exported file are the same thing.
 */

import { KEYS } from './store';
import { normalizeProfile } from './nutrition';

export type State = Record<string, unknown>;

/**
 * Keys a merge or a restore may never write.
 *
 * `user_premium` is read by `isPremium()`, so a hand-edited backup file
 * containing `"user_premium": "true"` used to grant premium outright — the
 * exact hole `purchases.ts` was written to close, reopened by the restore path.
 * Entitlement comes from the store, never from a file or another device.
 *
 * `plan_quota` is excluded for the same reason in miniature: restoring an old
 * backup would roll the counter back. It stays resettable by clearing storage,
 * which the README says plainly — this only stops the easy way.
 */
export const NEVER_RESTORED: readonly string[] = [KEYS.premium, KEYS.planQuota];

/** Append-only day logs: a date appearing on either device happened. */
const DATE_LOGS: readonly string[] = [KEYS.fastLog, KEYS.cookLog];

/** Records carrying their own date, deduplicated by it. */
const DATED_RECORDS: readonly { key: string; by: string }[] = [
  { key: KEYS.weightLog, by: 'date' },
  { key: KEYS.planHistory, by: 'date' },
];

/** Free-form lists deduplicated by id, order preserved. */
const ID_LISTS: readonly { key: string; by: string }[] = [{ key: KEYS.chatLog, by: 'id' }];

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function unionDates(a: unknown, b: unknown): string[] {
  const out = new Set<string>();
  for (const v of [...asArray(a), ...asArray(b)]) {
    if (typeof v === 'string' && v.trim()) out.add(v);
  }
  return [...out].sort();
}

/** Union by a field. Later wins on a clash, which is the newer edit of a day. */
function unionBy(a: unknown, b: unknown, field: string): unknown[] {
  const byKey = new Map<string, unknown>();
  for (const item of [...asArray(a), ...asArray(b)]) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as Record<string, unknown>)[field];
    if (typeof id !== 'string' || !id) continue;
    byKey.set(id, item);
  }
  return [...byKey.values()].sort((x, y) =>
    String((x as any)[field]).localeCompare(String((y as any)[field]))
  );
}

export type MergeInput = { state: State; at: string };

/**
 * Merges two states. Deterministic: same inputs, same output, whichever order
 * they arrive in — which matters because two devices run this independently
 * and must agree without talking to each other.
 */
export function mergeStates(local: MergeInput, remote: MergeInput): State {
  const l = local?.state ?? {};
  const r = remote?.state ?? {};
  // A missing or unparsable timestamp must not win by accident.
  const lAt = Date.parse(local?.at ?? '') || 0;
  const rAt = Date.parse(remote?.at ?? '') || 0;
  const newer = rAt > lAt ? r : l;
  const older = rAt > lAt ? l : r;

  const out: State = {};

  for (const key of Object.values(KEYS)) {
    if (NEVER_RESTORED.includes(key)) {
      // Whatever this device already believes, untouched by the other one.
      if (key in l) out[key] = l[key];
      continue;
    }

    const dateLog = DATE_LOGS.includes(key);
    const dated = DATED_RECORDS.find((d) => d.key === key);
    const idList = ID_LISTS.find((d) => d.key === key);

    if (dateLog) {
      const merged = unionDates(l[key], r[key]);
      if (merged.length) out[key] = merged;
    } else if (dated) {
      const merged = unionBy(l[key], r[key], dated.by);
      if (merged.length) out[key] = merged;
    } else if (idList) {
      const merged = unionBy(l[key], r[key], idList.by);
      if (merged.length) out[key] = merged;
    } else if (key in newer) {
      out[key] = newer[key];
    } else if (key in older) {
      out[key] = older[key];
    }
  }

  // The profile goes through the same clamping as every other write, so a
  // tampered blob cannot inject a 400kg bodyweight by way of the merge.
  if (out[KEYS.profile]) out[KEYS.profile] = normalizeProfile(out[KEYS.profile]);

  return out;
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };
  const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  const OLD = '2026-08-01T10:00:00.000Z';
  const NEW = '2026-08-05T10:00:00.000Z';

  // --- logs are unioned, never replaced ------------------------------------

  const phone = { state: { [KEYS.fastLog]: ['2026-08-01', '2026-08-02'] }, at: OLD };
  const web = { state: { [KEYS.fastLog]: ['2026-08-02', '2026-08-04'] }, at: NEW };
  const merged = mergeStates(phone, web);
  assert(
    eq(merged[KEYS.fastLog], ['2026-08-01', '2026-08-02', '2026-08-04']),
    `every logged day survives: ${JSON.stringify(merged[KEYS.fastLog])}`
  );

  // The property two devices depend on: order must not change the answer.
  assert(eq(mergeStates(web, phone), mergeStates(phone, web)), 'the merge is commutative');
  assert(
    eq(mergeStates({ state: merged, at: NEW }, web), mergeStates({ state: merged, at: NEW }, web)),
    'and stable'
  );

  // Idempotent: merging a result back in changes nothing.
  const twice = mergeStates({ state: merged, at: NEW }, { state: merged, at: NEW });
  assert(eq(twice[KEYS.fastLog], merged[KEYS.fastLog]), 'merging twice changes nothing');

  // --- dated records --------------------------------------------------------

  const wLocal = { state: { [KEYS.weightLog]: [{ date: '2026-08-01', weight_kg: 83 }] }, at: OLD };
  const wRemote = {
    state: {
      [KEYS.weightLog]: [
        { date: '2026-08-01', weight_kg: 82.5 },
        { date: '2026-08-03', weight_kg: 82 },
      ],
    },
    at: NEW,
  };
  const w = mergeStates(wLocal, wRemote)[KEYS.weightLog] as any[];
  assert(w.length === 2, `one entry per day, not per device: ${JSON.stringify(w)}`);
  assert(w[0].weight_kg === 82.5, 'a corrected weigh-in wins over the original');

  // --- scalars follow the clock --------------------------------------------

  const older = { state: { [KEYS.portions]: '1' }, at: OLD };
  const newer = { state: { [KEYS.portions]: '3' }, at: NEW };
  assert(mergeStates(older, newer)[KEYS.portions] === '3', 'the newer scalar wins');
  assert(mergeStates(newer, older)[KEYS.portions] === '3', 'regardless of argument order');

  // A missing or broken timestamp must not silently win.
  assert(
    mergeStates({ state: { [KEYS.portions]: '2' }, at: 'nonsense' }, newer)[KEYS.portions] === '3',
    'an unparsable timestamp does not beat a real one'
  );

  // --- the rule that protects the paywall ----------------------------------

  const honest = { state: { [KEYS.premium]: 'false' }, at: OLD };
  const tampered = { state: { [KEYS.premium]: 'true' }, at: NEW };
  assert(
    mergeStates(honest, tampered)[KEYS.premium] === 'false',
    'premium never arrives from the other side, however new it claims to be'
  );
  assert(
    mergeStates({ state: {}, at: OLD }, tampered)[KEYS.premium] === undefined,
    'and a device with no entitlement does not gain one'
  );
  assert(
    mergeStates({ state: { [KEYS.premium]: 'true' }, at: OLD }, honest)[KEYS.premium] === 'true',
    'a real purchase on this device is left alone'
  );
  assert(
    mergeStates({ state: { [KEYS.planQuota]: 9 }, at: OLD }, { state: { [KEYS.planQuota]: 0 }, at: NEW })[
      KEYS.planQuota
    ] === 9,
    'and quota cannot be rolled back by restoring an older state'
  );

  // The same rule has to hold for the file path, which is where the hole
  // actually was: a hand-edited backup granted premium until now.
  assert(NEVER_RESTORED.includes(KEYS.premium), 'entitlement is on the never-restored list');
  assert(NEVER_RESTORED.includes(KEYS.planQuota), 'so is the quota counter');

  // --- hostile and empty input ---------------------------------------------

  assert(eq(mergeStates({ state: {}, at: OLD }, { state: {}, at: NEW }), {}), 'two empty states merge to nothing');
  assert(mergeStates(null as any, null as any) !== null, 'missing input does not throw');
  const junk = mergeStates(
    { state: { [KEYS.fastLog]: 'not an array' as any }, at: OLD },
    { state: { [KEYS.fastLog]: [null, 5, '2026-08-01'] as any }, at: NEW }
  );
  assert(eq(junk[KEYS.fastLog], ['2026-08-01']), `junk entries are dropped: ${JSON.stringify(junk[KEYS.fastLog])}`);

  // The profile is clamped on the way through, like every other write.
  const wild = mergeStates({ state: {}, at: OLD }, { state: { [KEYS.profile]: { weight_kg: 400 } }, at: NEW });
  assert((wild[KEYS.profile] as any).weight_kg < 400, 'a tampered bodyweight is clamped by the merge');

  // Nothing outside the app's own keys is carried across.
  const smuggled = mergeStates({ state: {}, at: OLD }, { state: { evil_key: 'x' } as any, at: NEW });
  assert(!('evil_key' in smuggled), 'unknown keys are not carried across');

  return 'sync-merge.ts: all checks passed';
}
