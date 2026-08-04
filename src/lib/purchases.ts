/**
 * RevenueCat wrapper.
 *
 * The previous paywall granted premium by writing `user_premium=true` on tap —
 * no payment involved. That ships an app where the upgrade button is a lie and
 * every user is premium. This module only grants entitlement on a real
 * verified purchase; when billing isn't configured it says so instead.
 */

import { Platform } from 'react-native';
import { setPremium } from './store';

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

const ENTITLEMENT = 'premium';

/** Billing only exists in a native build with a configured RevenueCat key. */
export function isBillingAvailable(): boolean {
  return Platform.OS !== 'web' && !!API_KEY;
}

type PurchasesModule = typeof import('react-native-purchases').default;

let configured = false;

async function getPurchases(): Promise<PurchasesModule> {
  // Required at call time: importing on web pulls in native modules that
  // don't exist there and would crash the bundle at load.
  const mod = require('react-native-purchases');
  const Purchases: PurchasesModule = mod.default ?? mod;
  if (!configured) {
    await Purchases.configure({ apiKey: API_KEY! });
    configured = true;
  }
  return Purchases;
}

export type Package = {
  identifier: string;
  priceString: string;
  period: 'monthly' | 'annual' | 'other';
  raw: unknown;
};

function periodOf(pkg: any): Package['period'] {
  const t = String(pkg?.packageType ?? '').toUpperCase();
  if (t === 'MONTHLY') return 'monthly';
  if (t === 'ANNUAL') return 'annual';
  return 'other';
}

export async function getOfferings(): Promise<Package[]> {
  if (!isBillingAvailable()) return [];
  try {
    const Purchases = await getPurchases();
    const offerings = await Purchases.getOfferings();
    const available = offerings.current?.availablePackages ?? [];
    return available.map((p: any) => ({
      identifier: p.identifier,
      priceString: p.product?.priceString ?? '',
      period: periodOf(p),
      raw: p,
    }));
  } catch (e) {
    console.warn('Could not load offerings', e);
    return [];
  }
}

function hasEntitlement(info: any): boolean {
  return !!info?.entitlements?.active?.[ENTITLEMENT];
}

export type PurchaseResult = { ok: boolean; cancelled?: boolean; message?: string };

export async function purchase(pkg: Package): Promise<PurchaseResult> {
  if (!isBillingAvailable()) {
    return { ok: false, message: 'In-app purchases are not available on this platform.' };
  }
  try {
    const Purchases = await getPurchases();
    const { customerInfo } = await Purchases.purchasePackage(pkg.raw as any);
    const active = hasEntitlement(customerInfo);
    // Entitlement is only written after RevenueCat confirms the receipt.
    await setPremium(active);
    return active ? { ok: true } : { ok: false, message: 'Purchase completed but no entitlement was granted.' };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, message: e?.message ?? 'Purchase failed.' };
  }
}

export async function restore(): Promise<PurchaseResult> {
  if (!isBillingAvailable()) {
    return { ok: false, message: 'In-app purchases are not available on this platform.' };
  }
  try {
    const Purchases = await getPurchases();
    const customerInfo = await Purchases.restorePurchases();
    const active = hasEntitlement(customerInfo);
    await setPremium(active);
    return active ? { ok: true } : { ok: false, message: 'No active subscription found for this account.' };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Could not restore purchases.' };
  }
}

/** Re-checks entitlement on launch so an expired or refunded sub loses access. */
export async function syncEntitlement(): Promise<void> {
  if (!isBillingAvailable()) return;
  try {
    const Purchases = await getPurchases();
    const info = await Purchases.getCustomerInfo();
    await setPremium(hasEntitlement(info));
  } catch (e) {
    // Offline: leave the cached entitlement alone rather than locking a paying
    // user out because their train went into a tunnel.
    console.warn('Entitlement sync skipped', e);
  }
}
