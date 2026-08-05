/**
 * Export and import of everything the app stores.
 *
 * There are no accounts, so the device is the only copy. Uninstalling the app,
 * losing the phone or clearing site data loses months of logs. Until sync
 * exists this is the honest safety net, and it is also the only way to move
 * between web and a phone.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './store';
import { normalizeProfile } from './nutrition';
import { NEVER_RESTORED } from './sync-merge';

const FORMAT = 'omadcoach-backup';
const VERSION = 1;

export type Backup = {
  format: typeof FORMAT;
  version: number;
  exported_at: string;
  data: Record<string, unknown>;
};

/**
 * Every key the app owns, minus the ones a file must never carry.
 *
 * `user_premium` is read directly by `isPremium()`, so a backup containing
 * `"user_premium": "true"` granted premium outright — the same hole
 * `purchases.ts` was written to close, reopened by this path. Leaving it out
 * of the export as well as the import means there is nothing to tamper with in
 * the first place.
 */
const EXPORTED = Object.values(KEYS).filter((k) => !NEVER_RESTORED.includes(k));

export async function exportBackup(): Promise<Backup> {
  const pairs = await AsyncStorage.multiGet(EXPORTED);
  const data: Record<string, unknown> = {};

  for (const [key, raw] of pairs) {
    if (raw == null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      // Flags like onboarding_complete are stored as plain strings.
      data[key] = raw;
    }
  }

  return { format: FORMAT, version: VERSION, exported_at: new Date().toISOString(), data };
}

export function backupFilename(now = new Date()): string {
  return `omadcoach-${now.toISOString().slice(0, 10)}.json`;
}

export type ImportResult = { ok: true; keys: number } | { ok: false; message: string };

/**
 * Replaces local data with the backup's. Validated before anything is written,
 * so a malformed file cannot leave the app half-restored.
 */
export async function importBackup(text: string): Promise<ImportResult> {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' };
  }

  if (parsed?.format !== FORMAT) {
    return { ok: false, message: 'That is not an OMADCoach backup.' };
  }
  if (typeof parsed.version !== 'number' || parsed.version > VERSION) {
    return { ok: false, message: 'That backup came from a newer version of the app.' };
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    return { ok: false, message: 'The backup has no data in it.' };
  }

  const entries: [string, string][] = [];
  for (const key of EXPORTED) {
    if (!(key in parsed.data)) continue;
    let value = parsed.data[key];
    // The profile goes through the same clamping as every other write, so an
    // edited backup cannot inject a 400kg bodyweight.
    if (key === KEYS.profile) value = normalizeProfile(value);
    entries.push([key, typeof value === 'string' ? value : JSON.stringify(value)]);
  }

  if (entries.length === 0) {
    return { ok: false, message: 'The backup contained nothing this app recognises.' };
  }

  await AsyncStorage.multiSet(entries);
  return { ok: true, keys: entries.length };
}
