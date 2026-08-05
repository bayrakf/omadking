/**
 * The browser has no keychain.
 *
 * localStorage is the only thing available, and it is worth being honest about
 * what that means: clearing site data takes the key with it, and anything that
 * can run script on this origin can read it. The recovery phrase is what makes
 * that survivable, which is why the UI insists on it being written down.
 */

const KEY = 'omadcoach_sync_key';

export async function loadKey(): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    // Private mode and blocked storage both throw rather than return null.
    return null;
  }
}

export async function saveKey(hex: string): Promise<void> {
  globalThis.localStorage?.setItem(KEY, hex);
}

export async function clearKey(): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* already gone */
  }
}
