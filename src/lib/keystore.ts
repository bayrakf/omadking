/**
 * Where the encryption key lives on this device.
 *
 * The key is the one thing that must not leak: it opens every blob the server
 * holds. On native that means the OS keychain, not AsyncStorage.
 *
 * `keystore.web.ts` is the browser twin — Metro resolves it first there, so
 * expo-secure-store never reaches the web bundle.
 */

import * as SecureStore from 'expo-secure-store';

const KEY = 'omadcoach_sync_key';

/** The key as a hex string, or null if this device has none. */
export async function loadKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    // A locked or unavailable keychain is not a crash; the caller offers to
    // pair again.
    return null;
  }
}

export async function saveKey(hex: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, hex, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* already gone */
  }
}
