/**
 * All AsyncStorage access lives here so keys and shapes stay consistent.
 * Screens were each doing their own getItem/JSON.parse with different fallbacks.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeProfile, normalizeSession, type SessionDraft, type UserProfile } from './nutrition';
import { todayISO, weekKey, currentStreak } from './dates';
import { conversationOf, type StoredMessage } from './ai';
import { recipeRotation, type CookedRecipe } from './grocery';

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
  lastSession: 'last_session',
  portions: 'cook_portions',
  intakeLog: 'intake_log',
  cookedRecipes: 'cooked_recipes',
  syncedAt: 'sync_last',
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

/**
 * Removes everything this app has ever stored on the device.
 *
 * `resetOnboarding` only clears the profile, which is what "start over" means
 * — but a deletion request means the weight log, the fast log and the chat
 * history go too. Those survived a reset, so anyone who pressed it expecting
 * their data gone was wrong.
 *
 * Enumerated from KEYS rather than listed by hand, so a new key cannot be
 * forgotten here.
 */
export async function eraseEverything(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
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

// --- What was actually eaten -----------------------------------------------

/**
 * One answer per day to "how did today go".
 *
 * Deliberately not a food diary. The app promises fewer decisions, so the
 * signal is three taps and an honest factor; fourteen of those measure a
 * metabolism better than a formula does, and people actually keep doing it.
 */
export type IntakeEntry = { date: string; factor: number; target_kcal: number };

export async function loadIntakeLog(): Promise<IntakeEntry[]> {
  const rows = await readJSON<IntakeEntry[]>(KEYS.intakeLog, []);
  return Array.isArray(rows)
    ? rows.filter((r) => r && typeof r.date === 'string' && isFinite(r.factor) && isFinite(r.target_kcal))
    : [];
}

/** One entry per day; answering again corrects the day rather than adding to it. */
export async function recordIntake(factor: number, targetKcal: number, date = todayISO()): Promise<IntakeEntry[]> {
  const log = (await loadIntakeLog()).filter((r) => r.date !== date);
  const next = [...log, { date, factor, target_kcal: Math.round(targetKcal) }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-400);
  await writeJSON(KEYS.intakeLog, next);
  return next;
}

/**
 * Removes a day's answer entirely.
 *
 * Without it the strip could only ever add: an accidental tap on an untouched
 * day would invent an answer nobody gave, and the measured maintenance is built
 * on exactly these entries. Same reason `unmarkFastComplete` exists.
 */
export async function clearIntake(date: string): Promise<IntakeEntry[]> {
  const next = (await loadIntakeLog()).filter((r) => r.date !== date);
  await writeJSON(KEYS.intakeLog, next);
  return next;
}

export async function intakeFor(date = todayISO()): Promise<IntakeEntry | null> {
  return (await loadIntakeLog()).find((r) => r.date === date) ?? null;
}

// --- Batch size ------------------------------------------------------------

/** How many portions the user cooks at a time. Clamped, never NaN. */
export async function loadPortions(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.portions);
  const n = Number(raw);
  return n === 2 || n === 3 ? n : 1;
}

export async function savePortions(n: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.portions, String(n === 2 || n === 3 ? n : 1));
}

// --- Last planner input ----------------------------------------------------

/** Prefill only. Nothing is submitted on the user's behalf. */
export async function loadLastSession(fallbackTime: string): Promise<SessionDraft> {
  return normalizeSession(await readJSON<any>(KEYS.lastSession, null), fallbackTime);
}

export async function saveLastSession(session: SessionDraft): Promise<void> {
  await writeJSON(KEYS.lastSession, session);
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
/**
 * Recipes that survive the ten-plan window.
 *
 * Kept apart from `planHistory` on purpose: that list is a rolling ten, so a
 * favourite cooked in April would be gone by May. A rotation has to outlive it.
 */
export async function loadCookedRecipes(): Promise<CookedRecipe[]> {
  return recipeRotation(await readJSON<unknown[]>(KEYS.cookedRecipes, []));
}

async function rememberRecipe(plan: any, date: string): Promise<void> {
  const title = typeof plan?.recipe?.title === 'string' ? plan.recipe.title.trim() : '';
  if (!title) return;

  const rows = await loadCookedRecipes();
  const seen = rows.find((r) => r.title === title);
  const next = seen
    ? rows.map((r) => (r.title === title ? { ...r, count: r.count + 1, lastCooked: date } : r))
    : [...rows, { title, count: 1, lastCooked: date, recipe: plan.recipe }];

  await writeJSON(KEYS.cookedRecipes, next.slice(-60));
}

export async function markCooked(date = todayISO(), plan?: unknown): Promise<string[]> {
  const log = await loadCookLog();
  if (plan) await rememberRecipe(plan, date);
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
