/**
 * Web stub for the RevenueCat wrapper.
 *
 * Metro resolves `.web.ts` ahead of `.ts` for the web platform, so the native
 * module in `purchases.ts` is never reached by the web bundler. Without this
 * split the `require('react-native-purchases')` in that file — even though it
 * sits inside a guarded function — was statically resolved and pulled the whole
 * native SDK into the web bundle (~900KB for code that can never run there).
 *
 * There is no browser billing integration, so every entry point reports
 * unavailable rather than pretending a purchase could happen.
 */

import type { Package, PurchaseResult } from './purchases';

export type { Package, PurchaseResult } from './purchases';

const UNAVAILABLE = 'In-app purchases are only available in the iOS and Android apps.';

export function isBillingAvailable(): boolean {
  return false;
}

export async function getOfferings(): Promise<Package[]> {
  return [];
}

export async function purchase(_pkg: Package): Promise<PurchaseResult> {
  return { ok: false, message: UNAVAILABLE };
}

export async function restore(): Promise<PurchaseResult> {
  return { ok: false, message: UNAVAILABLE };
}

export async function syncEntitlement(): Promise<void> {
  // Nothing to sync without a store.
}
