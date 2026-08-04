/**
 * All AsyncStorage access lives here so keys and shapes stay consistent.
 * Screens were each doing their own getItem/JSON.parse with different fallbacks.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeProfile, type UserProfile } from './nutrition';
import { todayISO, weekKey, currentStreak } from './dates';
import { conversationOf, type StoredMessage } from './ai';

export { todayISO, currentStreak };

export const KEYS = {
  profile: 'onboarding_profile',
  onboardingComplete: 'onboarding_complete',
  lastPlan: 'last_meal_plan',
  planHistory: 'meal_history',
  weightLog: 'weight_log',
  groceryChecked: 'grocery_checked',
  hydration: 'hydration_today',
  premium: 'user_premium',
  planQuota: 'plan_quota',
  fastLog: 'fast_log',
  cookLog: 'cook_log',
  chatLog: 'chat_log',
} as const;

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    // Corrupt entry — drop it rather than crashing the screen on every mount.
    await AsyncStorage.removeItem(key).catch(() => {});
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to persist ${key}`, e);
  }
}


// --- Profile ---------------------------------------------------------------

export async function loadProfile(): Promise<UserProfile | null> {
  const raw = await readJSON<any>(KEYS.profile, null);
  return raw ? normalizeProfile(raw) : null;
}

/** Always returns something usable — for screens that render before onboarding. */
export async function loadProfileOrDefault(): Promise<UserProfile> {
  return normalizeProfile(await readJSON<any>(KEYS.profile, {}));
}

export async function saveProfile(p: UserProfile): Promise<void> {
  await writeJSON(KEYS.profile, normalizeProfile(p));
}

export async function isOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboardingComplete)) === 'true';
}

export async function completeOnboarding(p: UserProfile): Promise<void> {
  await saveProfile(p);
  await AsyncStorage.setItem(KEYS.onboardingComplete, 'true');
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.profile, KEYS.onboardingComplete]);
}

// --- Hydration (resets daily) ---------------------------------------------

export type Hydration = { date: string; ml: number; electrolytes: boolean };

export async function loadHydration(): Promise<Hydration> {
  const today = todayISO();
  const stored = await readJSON<Hydration>(KEYS.hydration, { date: today, ml: 0, electrolytes: false });
  // Yesterday's intake must not carry over — the old tracker never reset.
  return stored.date === today ? stored : { date: today, ml: 0, electrolytes: false };
}

export async function saveHydration(h: Hydration): Promise<void> {
  await writeJSON(KEYS.hydration, { ...h, date: todayISO() });
}

// --- Meal plans ------------------------------------------------------------

export async function loadLastPlan<T>(): Promise<T | null> {
  return readJSON<T | null>(KEYS.lastPlan, null);
}

export async function loadPlanHistory<T>(): Promise<T[]> {
  const h = await readJSON<T[]>(KEYS.planHistory, []);
  return Array.isArray(h) ? h : [];
}

export async function savePlan<T>(plan: T, keep = 10): Promise<T[]> {
  await writeJSON(KEYS.lastPlan, plan);
  const history = [plan, ...(await loadPlanHistory<T>())].slice(0, keep);
  await writeJSON(KEYS.planHistory, history);
  return history;
}

// --- Free tier quota -------------------------------------------------------

export const FREE_PLANS_PER_WEEK = 3;


export async function isPremium(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.premium)) === 'true';
}

export async function setPremium(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.premium, String(on));
}

export type Quota = { used: number; limit: number; remaining: number; premium: boolean };

export async function getQuota(): Promise<Quota> {
  if (await isPremium()) {
    return { used: 0, limit: Infinity, remaining: Infinity, premium: true };
  }
  const stored = await readJSON<{ week: string; used: number }>(KEYS.planQuota, { week: weekKey(), used: 0 });
  const used = stored.week === weekKey() ? stored.used : 0;
  return {
    used,
    limit: FREE_PLANS_PER_WEEK,
    remaining: Math.max(0, FREE_PLANS_PER_WEEK - used),
    premium: false,
  };
}

/** Call after a plan is successfully generated. No-op for premium. */
export async function consumeQuota(): Promise<void> {
  if (await isPremium()) return;
  const q = await getQuota();
  await writeJSON(KEYS.planQuota, { week: weekKey(), used: q.used + 1 });
}

// --- Weight log ------------------------------------------------------------

export type WeightEntry = { id: string; date: string; weight_kg: number };

export async function loadWeightLog(): Promise<WeightEntry[]> {
  const log = await readJSON<WeightEntry[]>(KEYS.weightLog, []);
  if (!Array.isArray(log)) return [];
  return log
    .filter((e) => e && typeof e.weight_kg === 'number' && isFinite(e.weight_kg) && typeof e.date === 'string')
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveWeightLog(entries: WeightEntry[]): Promise<void> {
  await writeJSON(KEYS.weightLog, entries);
}

// --- Fasting streak --------------------------------------------------------

/** Dates (YYYY-MM-DD) on which the user confirmed they completed their fast. */
export async function loadFastLog(): Promise<string[]> {
  const log = await readJSON<string[]>(KEYS.fastLog, []);
  return Array.isArray(log) ? log.filter((d) => typeof d === 'string') : [];
}

export async function markFastComplete(date = todayISO()): Promise<string[]> {
  const log = await loadFastLog();
  if (log.includes(date)) return log;
  const next = [...log, date].sort().slice(-400);
  await writeJSON(KEYS.fastLog, next);
  return next;
}

export async function unmarkFastComplete(date = todayISO()): Promise<string[]> {
  const next = (await loadFastLog()).filter((d) => d !== date);
  await writeJSON(KEYS.fastLog, next);
  return next;
}

// --- Coach conversation ----------------------------------------------------

/**
 * The thread survives closing the app. Without this the coach reopened blank
 * every time and `askCoach` received an empty history, so it genuinely could
 * not remember a question asked two hours earlier.
 */
export async function loadChat(): Promise<StoredMessage[]> {
  const raw = await readJSON<StoredMessage[]>(KEYS.chatLog, []);
  return Array.isArray(raw) ? conversationOf(raw) : [];
}

/** Stores only what counts as conversation, capped, via the same rule the
 *  coach's context uses. */
export async function saveChat(messages: StoredMessage[]): Promise<void> {
  const kept = conversationOf(messages);
  // Nothing left is the same as never having had one; writing `[]` would leave
  // a stray key behind after clearing.
  if (kept.length === 0) return clearChat();
  await writeJSON(KEYS.chatLog, kept);
}

export async function clearChat(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.chatLog);
}

// --- Meal prep -------------------------------------------------------------

/** Dates on which the day's meal was actually cooked. */
export async function loadCookLog(): Promise<string[]> {
  const log = await readJSON<string[]>(KEYS.cookLog, []);
  return Array.isArray(log) ? log.filter((d) => typeof d === 'string') : [];
}

export async function isCooked(date = todayISO()): Promise<boolean> {
  return (await loadCookLog()).includes(date);
}

/**
 * Marking a day cooked also clears the shopping ticks: the ingredients are in
 * the pan, so leaving them ticked would carry stale state into the next list.
 * This is what closes the planner -> shopping -> kitchen loop.
 */
export async function markCooked(date = todayISO()): Promise<string[]> {
  const log = await loadCookLog();
  if (!log.includes(date)) {
    const next = [...log, date].sort().slice(-400);
    await writeJSON(KEYS.cookLog, next);
    await AsyncStorage.removeItem(KEYS.groceryChecked).catch(() => {});
    return next;
  }
  return log;
}

export async function unmarkCooked(date = todayISO()): Promise<string[]> {
  const next = (await loadCookLog()).filter((d) => d !== date);
  await writeJSON(KEYS.cookLog, next);
  return next;
}
