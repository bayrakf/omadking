/**
 * Pull, merge, push. The only place the encrypted blob moves.
 *
 * The server cannot merge, so the whole cycle happens here: take what it has,
 * open it, merge it with this device, seal the result, write it back. A device
 * that has been offline for a week contributes its days rather than losing
 * them, because the merge is a union and not a replacement.
 *
 * `revision` guards the write. Two devices starting from the same state would
 * otherwise overwrite one another, and the loser would never find out.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './store';
import { exportBackup, importBackup, FORMAT, VERSION } from './backup';
import { mergeStates } from './sync-merge';
import { seal, open as openSealed } from './crypto';
import { ensureAccount, supabase, signOutAndForget } from './account';

const TABLE = 'sync_state';

const toB64 = (b: Uint8Array) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return globalThis.btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(globalThis.atob(s), (ch) => ch.charCodeAt(0));

export type SyncResult =
  | { ok: true; at: string }
  | { ok: false; reason: 'offline' | 'not_configured' | 'unreadable' | 'conflict' | 'failed'; message: string };

export async function lastSyncedAt(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.syncedAt);
}

/**
 * One full cycle. Safe to call repeatedly — the merge is idempotent, so a
 * needless sync is wasted bandwidth and nothing worse.
 */
export async function syncNow(): Promise<SyncResult> {
  const sb = supabase();
  if (!sb) return { ok: false, reason: 'not_configured', message: 'Sync is not configured in this build.' };

  const account = await ensureAccount();
  if (!account) return { ok: false, reason: 'offline', message: 'Could not reach the server.' };

  const { userId, key } = account;

  const { data: row, error: readError } = await sb
    .from(TABLE)
    .select('ciphertext, nonce, revision')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) return { ok: false, reason: 'failed', message: 'Could not read your synced data.' };

  let remoteState: Record<string, unknown> = {};
  let remoteAt = '';
  const revision: number = row?.revision ?? 0;

  if (row) {
    const plain = openSealed(key, { ciphertext: fromB64(row.ciphertext), nonce: fromB64(row.nonce) });
    if (plain === null) {
      // The key on this device does not open what the server holds. Pushing
      // now would replace data this device cannot read — the one outcome worse
      // than not syncing.
      return {
        ok: false,
        reason: 'unreadable',
        message: 'This device cannot read your synced data. Enter the recovery phrase from your other device.',
      };
    }
    try {
      const parsed = JSON.parse(plain);
      remoteState = parsed?.data ?? {};
      remoteAt = parsed?.exported_at ?? '';
    } catch {
      return { ok: false, reason: 'unreadable', message: 'The synced data could not be read.' };
    }
  }

  const local = await exportBackup();
  const merged = mergeStates(
    { state: local.data, at: local.exported_at },
    { state: remoteState, at: remoteAt }
  );

  const at = new Date().toISOString();
  const payload = JSON.stringify({ format: FORMAT, version: VERSION, exported_at: at, data: merged });

  // Locally first: if the write to the server fails, this device has still
  // gained whatever the other one knew.
  await importBackup(payload);

  const sealed = seal(key, payload);
  const record = {
    user_id: userId,
    ciphertext: toB64(sealed.ciphertext),
    nonce: toB64(sealed.nonce),
    revision: revision + 1,
    updated_at: at,
  };

  const written = row
    ? await sb.from(TABLE).update(record).eq('user_id', userId).eq('revision', revision).select('user_id')
    : await sb.from(TABLE).insert(record).select('user_id');

  if (written.error) return { ok: false, reason: 'failed', message: 'Could not save to the server.' };
  if (row && (written.data?.length ?? 0) === 0) {
    // Another device wrote in between. The local merge already happened, so
    // running again resolves it rather than losing anything.
    return { ok: false, reason: 'conflict', message: 'Another device synced at the same moment. Try again.' };
  }

  await AsyncStorage.setItem(KEYS.syncedAt, at);
  return { ok: true, at };
}

/**
 * Deletes the account itself, not just its row.
 *
 * The sync_state row cascades with the user, and the edge function derives who
 * that is from the caller's own token — there is no id to pass, so there is no
 * id to get wrong. The device keeps its local data; only the server copy, the
 * account and this device's key go.
 */
export async function deleteAccount(): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;

  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;

  try {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete_account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
  } catch {
    return false;
  }

  await AsyncStorage.removeItem(KEYS.syncedAt);
  // The key opens a blob that no longer exists; keeping it would only be
  // confusing on the next sync.
  await signOutAndForget();
  return true;
}
