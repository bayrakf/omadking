/**
 * Local reminders for the day's moments.
 *
 * This is the feature the app was missing: it knows exactly when to eat, but
 * only told you if you opened it. Everything here is *local* — no server, no
 * push token, no account. The only thing the user does is grant permission once.
 *
 * Web has no counterpart (scheduled local notifications need a service worker
 * and Web Push), so `notify.web.ts` stubs this out. Metro resolves `.web.ts`
 * first, which also keeps the native module out of the web bundle.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayAgenda, type AgendaItem, type PlanLike } from './agenda';
import { toMinutes, type UserProfile } from './nutrition';

const ENABLED_KEY = 'notifications_enabled';
const CHANNEL_ID = 'omad-timing';

/** Foreground behaviour: a reminder that fires while the app is open is still
 *  worth showing — the whole point is that the user is not watching a timer. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function isSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function isEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

async function setEnabledFlag(on: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, String(on));
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Meal timing',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Asks only when the user turns reminders on. Prompting at launch, before the
 * app has shown any value, is the fastest route to a permanent "Don't allow".
 */
export async function ensurePermission(): Promise<boolean> {
  if (!isSupported()) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Which agenda moments are worth interrupting someone for. */
const REMINDERS: Partial<Record<AgendaItem['kind'], { lead: number }>> = {
  cook: { lead: 0 },
  window_open: { lead: 10 },
  snack: { lead: 10 },
  meal: { lead: 0 },
  window_close: { lead: 15 },
  log_fast: { lead: 0 },
};

function bodyFor(item: AgendaItem, lead: number): string {
  if (item.kind === 'window_close') return `Last bite at ${item.at}. ${item.body}`;
  if (lead > 0) return `${item.at} — ${item.body}`;
  return item.body;
}

/**
 * Rebuilds the whole schedule. Always cancels first: scheduling incrementally
 * is how you end up with three copies of the same reminder after a few profile
 * edits.
 *
 * Window boundaries repeat daily (they come from the profile and rarely
 * change). Plan-specific moments are one-offs for today, so no background task
 * is needed to keep them fresh — the app reschedules whenever it opens.
 */
export async function syncSchedule(
  profile: UserProfile,
  plan: PlanLike | null,
  state: { cooked: boolean; fastLogged: boolean }
): Promise<void> {
  if (!isSupported()) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await isEnabled())) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  await ensureChannel();

  const now = new Date();
  const { items } = dayAgenda(profile, plan, state, now);
  const windowStart = toMinutes(profile.omad_window_start);

  for (const item of items) {
    const rule = REMINDERS[item.kind];
    if (!rule || item.done) continue;

    const fireMinutes = toMinutes(item.at) - rule.lead;
    const hour = Math.floor(((fireMinutes % 1440) + 1440) % 1440 / 60);
    const minute = Math.round(((fireMinutes % 1440) + 1440) % 1440 % 60);

    const content = {
      title: item.title,
      body: bodyFor(item, rule.lead),
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    };

    const repeats = item.kind === 'window_open' || item.kind === 'window_close';

    if (repeats) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      continue;
    }

    // One-off: only schedule if it is still ahead of us today.
    const fireAt = new Date(now);
    fireAt.setHours(hour, minute, 0, 0);
    // An item whose clock time already passed but whose offset is still ahead
    // belongs to a window that crosses midnight, so it fires tomorrow.
    if (fireAt.getTime() <= now.getTime()) {
      if (item.offset <= 0 || toMinutes(item.at) >= windowStart) continue;
      fireAt.setDate(fireAt.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  }
}

export async function setEnabled(
  on: boolean,
  profile: UserProfile,
  plan: PlanLike | null,
  state: { cooked: boolean; fastLogged: boolean }
): Promise<boolean> {
  if (!isSupported()) return false;
  if (on) {
    const granted = await ensurePermission();
    if (!granted) return false;
    await setEnabledFlag(true);
    await syncSchedule(profile, plan, state);
    return true;
  }
  await setEnabledFlag(false);
  await Notifications.cancelAllScheduledNotificationsAsync();
  return false;
}

/**
 * The single entry point callers use. Loads current state itself so no screen
 * has to remember which four things the schedule depends on.
 */
export async function resync(): Promise<void> {
  if (!isSupported()) return;
  const store = await import('./store');
  const [profile, plan, fastLog, cookLog] = await Promise.all([
    store.loadProfileOrDefault(),
    store.loadLastPlan<PlanLike & { date: string }>(),
    store.loadFastLog(),
    store.loadCookLog(),
  ]);
  const today = store.todayISO();
  await syncSchedule(profile, plan?.date === today ? plan : null, {
    cooked: cookLog.includes(today),
    fastLogged: fastLog.includes(today),
  });
}

/** Diagnostic for the settings screen — how many reminders are actually queued. */
export async function scheduledCount(): Promise<number> {
  if (!isSupported()) return 0;
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}
