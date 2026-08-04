/**
 * Web stub for reminders.
 *
 * Scheduled local notifications need a service worker and Web Push, which
 * expo-notifications does not provide for web. Metro resolves `.web.ts` ahead
 * of `.ts`, so this file also keeps the native module out of the web bundle —
 * the same split that cut 900KB when `react-native-purchases` was leaking in.
 *
 * Everything reports "unsupported" rather than silently pretending to schedule.
 */

import type { PlanLike } from './agenda';
import type { UserProfile } from './nutrition';

type State = { cooked: boolean; fastLogged: boolean };

export function isSupported(): boolean {
  return false;
}

export async function isEnabled(): Promise<boolean> {
  return false;
}

export async function ensurePermission(): Promise<boolean> {
  return false;
}

export async function syncSchedule(_p: UserProfile, _plan: PlanLike | null, _s: State): Promise<void> {
  // No scheduler on web.
}

export async function setEnabled(_on: boolean, _p: UserProfile, _plan: PlanLike | null, _s: State): Promise<boolean> {
  return false;
}

export async function resync(): Promise<void> {
  // No scheduler on web.
}

export async function scheduledCount(): Promise<number> {
  return 0;
}
