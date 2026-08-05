/**
 * The account, which is deliberately not an identity.
 *
 * Supabase anonymous sign-in gives a stable user id and nothing else — no
 * email, no password, no name. That id is all the server needs to know which
 * encrypted blob belongs to whom, and all the operator ever holds.
 *
 * Signing in is not the same as turning sync on. This module only establishes
 * *who*; `sync.ts` decides *whether*.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { generateKey, toRecoveryPhrase, fromRecoveryPhrase } from './crypto';
import { loadKey, saveKey, clearKey } from './keystore';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;

/** Null when the project is not configured, so callers degrade instead of throwing. */
export function supabase(): SupabaseClient | null {
  if (!URL || !ANON) return null;
  if (!client) {
    client = createClient(URL, ANON, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No OAuth redirects here; parsing the URL would only invite surprises.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => Uint8Array.from(h.match(/.{2}/g) ?? [], (x) => parseInt(x, 16));

export type Account = { userId: string; key: Uint8Array };

/**
 * Signs in anonymously if needed and makes sure this device has a key.
 *
 * A new key is generated only when the device has none — pairing with an
 * existing one goes through `useRecoveryPhrase` instead, which is the whole
 * point of the phrase.
 */
export async function ensureAccount(): Promise<Account | null> {
  const sb = supabase();
  if (!sb) return null;

  const { data } = await sb.auth.getSession();
  let userId = data.session?.user?.id ?? null;

  if (!userId) {
    const { data: signed, error } = await sb.auth.signInAnonymously();
    if (error || !signed.user) return null;
    userId = signed.user.id;
  }

  let hex = await loadKey();
  if (!hex) {
    hex = toHex(generateKey());
    await saveKey(hex);
  }

  return { userId, key: fromHex(hex) };
}

/** The phrase for this device, or null if there is no key yet. */
export async function recoveryPhrase(): Promise<string | null> {
  const hex = await loadKey();
  return hex ? toRecoveryPhrase(fromHex(hex)) : null;
}

/**
 * Adopts a key from a phrase typed on another device. Returns false for a
 * phrase that does not check out, so the screen can say so rather than
 * replacing a good key with a bad one.
 */
export async function useRecoveryPhrase(phrase: string): Promise<boolean> {
  const key = fromRecoveryPhrase(phrase);
  if (!key) return false;
  await saveKey(toHex(key));
  return true;
}

export async function currentUserId(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Signs out and forgets the key. The server blob stays until it is deleted. */
export async function signOutAndForget(): Promise<void> {
  await supabase()?.auth.signOut();
  await clearKey();
}
