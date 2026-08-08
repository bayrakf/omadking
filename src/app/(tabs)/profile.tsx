import { useCallback, useState } from 'react';
import { View, StyleSheet, TextInput, Platform, Alert, Switch, Share } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Tap, Chip, Divider, PageHeader, Button, Notice, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import {
  bmr, dailyTargets, normalizeProfile, toMinutes, fromMinutes, PROTOCOLS, protocolForHours,
  targetWeight, DEFAULT_PROFILE, type UserProfile,
} from '@/lib/nutrition';
import {
  loadProfileOrDefault, saveProfile, resetOnboarding, eraseEverything, getQuota, isPremium,
  loadLastPlan, loadFastLog, loadCookLog, loadWeightLog, loadIntakeLog, todayISO, type Quota,
} from '@/lib/store';
import {
  isSupported as remindersSupported, isEnabled as remindersOn,
  setEnabled as setReminders, scheduledCount, resync,
} from '@/lib/notify';
import { exportBackup, importBackup } from '@/lib/backup';
import { healthSummary } from '@/lib/review';
import { syncNow, lastSyncedAt, deleteAccount } from '@/lib/sync';
import { currentUserId } from '@/lib/account';
import { saveBackup, pickBackup } from '@/lib/backup-file';
import type { MealPlan } from '@/lib/ai';

type EditField = 'weight_kg' | 'height_cm' | 'age' | 'omad_window_start' | 'omad_window_hours' | 'default_training_time' | 'target_weight_kg';

const CHOICES = {
  sex: [['male', 'Male'], ['female', 'Female'], ['other', 'Other']],
  fitness_level: [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']],
  goal: [['performance', 'Performance'], ['weight_loss', 'Lose fat'], ['muscle_gain', 'Build muscle']],
} as const;

export default function ProfileScreen() {
  const c = useTheme();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [premium, setPremiumState] = useState(false);
  const [avoid, setAvoid] = useState('');

  /** Saved on blur like the numeric rows, so there is no extra button. */
  const commitAvoid = async () => {
    if (avoid === profile.avoid) return;
    const next = normalizeProfile({ ...profile, avoid });
    setProfile(next);
    setAvoid(next.avoid);
    await saveProfile(next);
  };
  const [editing, setEditing] = useState<EditField | null>(null);
  const [draft, setDraft] = useState('');
  const [remindOn, setRemindOn] = useState(false);
  const [queued, setQueued] = useState(0);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // `lastSyncedAt` was imported and never called, so this screen opened
        // believing nobody had ever synced. It reads "Not synced yet" to a daily
        // syncer, and — because the delete-account row hangs off the same state
        // — it hid the way to delete the server copy behind pressing "Sync now"
        // first. Asking to be forgotten should not begin with an upload.
        const [p, q, prem, rOn, n, sy] = await Promise.all([
          loadProfileOrDefault(), getQuota(), isPremium(), remindersOn(), scheduledCount(),
          lastSyncedAt(),
        ]);
        if (!active) return;
        setProfile(p); setQuota(q); setPremiumState(prem); setAvoid(p.avoid);
        setRemindOn(rOn); setQueued(n); setSyncedAt(sy); setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  if (!mounted) return null;

  const persist = async (next: UserProfile) => {
    // Everything routes through normalizeProfile, so an out-of-range edit is
    // clamped here rather than producing NaN targets three screens away.
    const clean = normalizeProfile(next);
    setProfile(clean);
    await saveProfile(clean);
    // Window times drive the reminders, so the schedule follows the edit.
    await resync();
    setQueued(await scheduledCount());
  };

  const commit = async (field: EditField) => {
    await persist({ ...profile, [field]: draft } as unknown as UserProfile);
    setEditing(null);
  };

  const reset = () => {
    const run = async () => { await resetOnboarding(); router.replace('/onboarding'); };
    const msg = 'This clears your profile and restarts setup. Your weight log and plans stay.';
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); return; }
    Alert.alert('Reset profile', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: run },
    ]);
  };

  /** Deletion, not reset. Everything, including the logs a reset leaves alone. */
  const eraseAll = () => {
    const run = async () => {
      // The account goes first. `eraseEverything` enumerates KEYS, and neither
      // the encryption key nor the Supabase session lives there — so erasing
      // alone left a device that could still open the server copy, and the next
      // "Sync now" unioned all of it back over the empty state. Clearing the key
      // instead of deleting the account would strand a blob nobody can read or
      // remove, which is the one outcome worse than the resurrection.
      if (await currentUserId()) {
        if (!(await deleteAccount())) {
          setNotice({
            text: 'Could not reach the server, so nothing was deleted. Your data is untouched — try again online.',
            ok: false,
          });
          return;
        }
        setSyncedAt(null);
      }
      await eraseEverything();
      router.replace('/onboarding');
    };
    const msg =
      'This deletes everything on this device: profile, weight log, fast log, plans, shopping list '
      + 'and chat history — and, if you have one, your account and the encrypted copy on the server. '
      + 'It cannot be undone. Export first if you want a copy.';
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); return; }
    Alert.alert('Delete all data', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: run },
    ]);
  };

  const runSync = async () => {
    setNotice(null);
    setSyncing(true);
    const res = await syncNow();
    setSyncing(false);
    if (res.ok) {
      setSyncedAt(res.at);
      setNotice({ text: 'Synced.', ok: true });
    } else {
      setNotice({ text: res.message, ok: false });
    }
  };

  const removeAccount = () => {
    const run = async () => {
      const ok = await deleteAccount();
      if (ok) setSyncedAt(null);
      setNotice({
        text: ok
          ? 'Account and server copy deleted. Your data stays on this device.'
          : 'Could not reach the server.',
        ok,
      });
    };
    const msg =
      'This deletes your account and the encrypted copy on the server. Your data stays on this '
      + 'device, but other devices will no longer receive it and the recovery phrase stops working.';
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); return; }
    Alert.alert('Delete account', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  const toggleReminders = async (on: boolean) => {
    setNotice(null);
    const today = todayISO();
    const [plan, fastLog, cookLog] = await Promise.all([loadLastPlan<MealPlan>(), loadFastLog(), loadCookLog()]);
    const result = await setReminders(
      on,
      profile,
      plan?.date === today ? plan : null,
      { cooked: cookLog.includes(today), fastLogged: fastLog.includes(today) }
    );
    setRemindOn(result);
    setQueued(await scheduledCount());
    if (on && !result) {
      setNotice({ text: 'Notifications are blocked. Turn them on for OMADCoach in your device settings.', ok: false });
    }
  };

  const doExport = async () => {
    setNotice(null);
    const res = await saveBackup(await exportBackup());
    if (!res.ok && res.message) setNotice({ text: res.message, ok: false });
  };

  /**
   * The same numbers as plain text, for the appointment where they are worth
   * most and reach least. A record, not a report — everything in it is read out
   * of the logs, and review.ts holds the rule that nothing interprets.
   */
  const doSummary = async () => {
    setNotice(null);
    const [weights, fasts, intake] = await Promise.all([
      loadWeightLog(), loadFastLog(), loadIntakeLog(),
    ]);
    const text = healthSummary({
      windowStart: profile.omad_window_start,
      windowHours: profile.omad_window_hours,
      weights, intakeLog: intake, fastLog: fasts,
    });
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        setNotice({ text: 'Copied. Paste it wherever you need it.', ok: true });
      } catch {
        setNotice({ text: 'Could not reach the clipboard.', ok: false });
      }
    } else {
      await Share.share({ message: text });
    }
  };

  const doImport = async () => {
    setNotice(null);
    const text = await pickBackup();
    if (text == null) return;
    const res = await importBackup(text);
    if (res.ok) {
      setProfile(await loadProfileOrDefault());
      setQuota(await getQuota());
      await resync();
      setNotice({ text: 'Backup restored.', ok: true });
    } else {
      setNotice({ text: res.message, ok: false });
    }
  };

  const targets = dailyTargets(profile, null);
  const resting = bmr(profile);
  const windowEnd = fromMinutes(toMinutes(profile.omad_window_start) + profile.omad_window_hours * 60);

  const row = (label: string, field: EditField, unit?: string) => (
    <ProfileRow
      key={field}
      label={label}
      field={field}
      unit={unit}
      profile={profile}
      editing={editing}
      draft={draft}
      setDraft={setDraft}
      onEdit={(f, v) => { setEditing(f); setDraft(v); }}
      onCommit={commit}
    />
  );

  const Choice = <K extends keyof typeof CHOICES>({ label, field }: { label: string; field: K }) => (
    <View style={{ paddingVertical: Space.md }}>
      <Eyebrow style={{ marginBottom: Space.md }}>{label}</Eyebrow>
      <View style={s.wrap}>
        {CHOICES[field].map(([value, text]) => (
          <Chip
            key={value}
            label={text}
            selected={profile[field] === value}
            onPress={() => persist({ ...profile, [field]: value })}
            style={s.chip}
          />
        ))}
      </View>
    </View>
  );

  return (
    <Screen>
      <Enter index={0}><PageHeader title="You" /></Enter>

      <Enter index={1}>
        <Tap onPress={() => !premium && router.push('/paywall')} disabled={premium} accessibilityLabel="Subscription">
          <View style={[s.plan, { backgroundColor: premium ? c.accent : c.surface, borderColor: premium ? c.accent : c.line }]}>
            <Icon name="crown" size={20} color={premium ? c.onAccent : c.textFaint} />
            <View style={{ flex: 1, marginLeft: Space.md }}>
              <Txt variant="subheading" color={premium ? c.onAccent : c.text}>
                {premium ? 'Premium' : 'Free plan'}
              </Txt>
              <Txt variant="small" color={premium ? c.onAccent : c.textDim} style={{ marginTop: 2, opacity: premium ? 0.8 : 1 }}>
                {premium ? 'Unlimited plans' : quota ? `${quota.remaining} of ${quota.limit} plans left this week` : ''}
              </Txt>
            </View>
            {!premium && <Icon name="chevronRight" size={18} color={c.textFaint} />}
          </View>
        </Tap>
      </Enter>

      <Enter index={2}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>Body</Eyebrow>
          {row('Weight', 'weight_kg', ' kg')}
          <Divider />
          {row('Height', 'height_cm', ' cm')}
          <Divider />
          {row('Age', 'age')}
          <Divider />
          {row('Target weight', 'target_weight_kg', ' kg')}
          <Txt variant="small" color={c.textFaint} style={{ marginBottom: Space.md }}>
            Left alone, the app aims at a healthy BMI. That is a population midpoint and often too
            low for someone carrying muscle, so set your own and the forecast follows it.
          </Txt>
          <Divider />
          {/* Free text, not a menu of diets: "no fish, no dairy, no mushrooms"
              covers more real people than any list, and the model reads prose
              better than a taxonomy. Its own row rather than a ProfileRow —
              that component treats null as "use the default target". */}
          <View style={{ paddingVertical: Space.md }}>
            <Txt variant="body" color={c.textDim}>Never put in a recipe</Txt>
            <TextInput
              value={avoid}
              onChangeText={setAvoid}
              onBlur={commitAvoid}
              placeholder="no fish, no dairy…"
              placeholderTextColor={c.textFaint}
              maxLength={120}
              accessibilityLabel="Never put in a recipe"
              style={[Type.data, s.avoidInput, { color: c.text, backgroundColor: c.well, borderColor: c.line }]}
            />
            <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
              Goes to the recipe as a hard constraint. Your numbers are unaffected.
            </Txt>
          </View>
          <Divider />
          <Choice label="Sex" field="sex" />
        </Card>
      </Enter>

      <Enter index={3}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow>Training</Eyebrow>
          <Choice label="Level" field="fitness_level" />
          <Divider />
          <Choice label="Goal" field="goal" />
        </Card>
      </Enter>

      <Enter index={4}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>Window</Eyebrow>
          {row('Opens', 'omad_window_start')}
          <Divider />
          {row('Length', 'omad_window_hours', ' h')}
          <View style={s.wrap}>
            {PROTOCOLS.map((proto) => (
              <Chip
                key={proto.id}
                label={proto.label}
                selected={profile.omad_window_hours === proto.windowHours}
                onPress={() => persist({ ...profile, omad_window_hours: proto.windowHours })}
                style={s.chip}
              />
            ))}
          </View>
          {/* A hand-typed length that matches nothing keeps working; it simply
              has no name to show. */}
          {protocolForHours(profile.omad_window_hours) && (
            <Txt variant="small" color={c.textDim} style={{ marginBottom: Space.sm }}>
              {protocolForHours(profile.omad_window_hours)!.note}
            </Txt>
          )}
          <Divider />
          {row('Usual training', 'default_training_time')}
          <View style={[s.summary, { backgroundColor: c.well }]}>
            <Txt variant="data" color={c.accent}>
              {profile.omad_window_start}–{windowEnd}
            </Txt>
            <Txt variant="data" color={c.textFaint}>{24 - profile.omad_window_hours}h fast</Txt>
          </View>
        </Card>
      </Enter>

      <Enter index={5}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>Your numbers</Eyebrow>
          {([
            ['Resting metabolism', `${resting} kcal`],
            ['Rest-day maintenance', `${targets.maintenance_kcal} kcal`],
            ['Rest-day target', `${targets.kcal} kcal`],
            ['Daily protein', `${targets.protein_g} g`],
          ] as const).map(([label, value], i) => (
            <View key={label}>
              {i > 0 && <Divider />}
              <View style={s.row}>
                <Txt variant="body" color={c.textDim}>{label}</Txt>
                <Txt variant="data" color={c.text}>{value}</Txt>
              </View>
            </View>
          ))}
          <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md }}>
            Mifflin-St Jeor. Training days add the session’s estimated burn on top.
          </Txt>
        </Card>
      </Enter>

      <Enter index={6}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>Reminders</Eyebrow>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: Space.base }}>
              <Txt variant="body">Tell me when to eat</Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                {!remindersSupported()
                  ? 'Only available in the iOS and Android apps.'
                  : remindOn
                  ? `${queued} reminder${queued === 1 ? '' : 's'} scheduled`
                  : 'Cooking, window opening, meal and last bite.'}
              </Txt>
            </View>
            <Switch
              value={remindOn}
              onValueChange={toggleReminders}
              disabled={!remindersSupported()}
              trackColor={{ false: c.well, true: c.accentDim }}
              thumbColor={remindOn ? c.accent : '#FFFFFF'}
            />
          </View>
        </Card>
      </Enter>

      {/* Everything above is about the person; everything below is about the
          app. Ten cards in a row read as a junk drawer without this break. */}
      <Enter index={7} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>App</Eyebrow>
        <Card>
          <Eyebrow style={{ marginBottom: Space.sm }}>Your data</Eyebrow>
          <Txt variant="small" color={c.textDim}>
            Everything lives on this device. An account is optional and only ever holds an encrypted
            copy, so a backup file is still the only copy you can read yourself.
          </Txt>
          <View style={s.dataRow}>
            <Button label="Export" variant="secondary" icon="share" onPress={doExport} style={s.dataBtn} />
            <Button label="Restore" variant="ghost" onPress={doImport} style={s.dataBtn} />
          </View>
          {/* Free, and not as a concession: the readable form of your own
              record is data portability, and charging for it would be absurd.
              Separate from Export because that file is for the app to read
              back and this text is for a person. */}
          <Button
            label="Summary for an appointment"
            variant="ghost"
            onPress={doSummary}
            style={{ marginTop: Space.sm }}
          />
          {notice && <Notice tone={notice.ok ? 'ok' : 'error'}>{notice.text}</Notice>}
          <Divider style={{ marginVertical: Space.base }} />
          {/* Separate from Reset on purpose: that one keeps the logs, this one
              does not, and confusing the two costs someone their history. */}
          <Tap onPress={eraseAll} accessibilityLabel="Delete all data">
            <View style={s.row}>
              <Txt variant="body" color={c.negative}>Delete all data</Txt>
              <Icon name="chevronRight" size={16} color={c.negative} />
            </View>
          </Tap>
        </Card>
      </Enter>

      <Enter index={8}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>Sync across devices</Eyebrow>
          <Txt variant="small" color={c.textDim}>
            Your data is encrypted on this device before it is sent. The server stores a blob nobody
            can read — not us either. That also means only your recovery phrase can restore it.
          </Txt>
          <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
            {syncedAt ? `Last synced ${new Date(syncedAt).toLocaleString()}` : 'Not synced yet'}
          </Txt>
          <Button
            label={syncing ? 'Syncing…' : 'Sync now'}
            onPress={runSync}
            disabled={syncing}
            style={{ marginTop: Space.md }}
          />
          <Tap onPress={() => router.push('/recovery')} accessibilityLabel="Recovery phrase">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>Recovery phrase</Txt>
              <View style={s.value}>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </View>
          </Tap>
          {syncedAt && (
            <Tap onPress={removeAccount} accessibilityLabel="Delete account">
              <View style={s.row}>
                <Txt variant="small" color={c.negative}>Delete account and server copy</Txt>
              </View>
            </Tap>
          )}
        </Card>
      </Enter>

      <Enter index={9}>
        <Card style={{ marginTop: Space.base }}>
          <Tap onPress={() => router.push('/about')} accessibilityLabel="About OMAD">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>About OMAD</Txt>
              <View style={s.value}>
                <Txt variant="data" color={c.accent}>Read</Txt>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </View>
          </Tap>
          <Divider />
          <Tap onPress={() => router.push('/legal?tab=privacy')} accessibilityLabel="Privacy">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>Privacy</Txt>
              <View style={s.value}>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </View>
          </Tap>
          <Divider />
          <Tap onPress={() => router.push('/legal?tab=imprint')} accessibilityLabel="Imprint">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>Imprint</Txt>
              <View style={s.value}>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </View>
          </Tap>
          <Divider />
          {/* The landing page was fully designed and reachable only by URL. */}
          <Tap onPress={() => router.push('/landing')} accessibilityLabel="What this app is for">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>What this app is for</Txt>
              <View style={s.value}>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </View>
          </Tap>
          <Divider />
          <View style={s.row}>
            <Txt variant="body" color={c.textDim}>Version</Txt>
            <Txt variant="data" color={c.textFaint}>1.0.0</Txt>
          </View>
          <Button label="Reset profile" variant="ghost" onPress={reset} style={{ marginTop: Space.md }} />
        </Card>
      </Enter>
    </Screen>
  );
}

/**
 * Defined at module scope, and that is the whole point.
 *
 * This used to live inside ProfileScreen, which made it a *new component type*
 * on every render. React cannot know the new type is the old one, so it
 * unmounted the TextInput and mounted a fresh one — after every single
 * keystroke, because typing sets state and re-renders. The field lost focus on
 * each character and had to be tapped again to continue.
 */
function ProfileRow({
  label, field, unit, profile, editing, draft, setDraft, onEdit, onCommit,
}: {
  label: string;
  field: EditField;
  unit?: string;
  profile: UserProfile;
  editing: EditField | null;
  draft: string;
  setDraft: (v: string) => void;
  onEdit: (field: EditField, value: string) => void;
  onCommit: (field: EditField) => void;
}) {
  const c = useTheme();
  const active = editing === field;
  const raw = profile[field];
  // An unset target is not "null": it is the app's default, shown as the figure
  // it will actually aim at, so the row never reads as broken.
  const shown = raw == null ? `${targetWeight(profile)} (default)` : String(raw);

  return (
    <View style={s.row}>
      <Txt variant="body" color={c.textDim}>{label}</Txt>
      {active ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={() => onCommit(field)}
          onSubmitEditing={() => onCommit(field)}
          autoFocus
          keyboardType={field.includes('time') || field.includes('start') ? 'default' : 'numeric'}
          accessibilityLabel={label}
          style={[Type.data, s.input, { color: c.accent, borderColor: c.accent }]}
        />
      ) : (
        <Tap
          onPress={() => onEdit(field, raw == null ? '' : String(raw))}
          accessibilityLabel={`Edit ${label}`}
        >
          <View style={s.value}>
            <Txt variant="data" color={c.text} style={s.valueText}>{shown}{raw == null ? '' : unit ?? ''}</Txt>
            <Icon name="edit" size={13} color={c.textFaint} />
          </View>
        </Tap>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base },
  value: { flexDirection: 'row', alignItems: 'center' },
  valueText: { marginRight: Space.sm },
  input: { minWidth: 90, textAlign: 'right', borderBottomWidth: 1.5, paddingVertical: 2, fontSize: 13 },
  avoidInput: {
    marginTop: Space.sm, borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Space.md, paddingVertical: Space.md, fontSize: 13,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -Space.sm },
  chip: { marginRight: Space.sm, marginBottom: Space.sm },
  plan: {
    flexDirection: 'row', alignItems: 'center', padding: Space.base,
    borderRadius: Radius.md, borderWidth: 1,
  },
  summary: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: Space.md, borderRadius: Radius.sm, marginTop: Space.base,
  },
  dataRow: { flexDirection: 'row', marginTop: Space.base, marginRight: -Space.sm },
  dataBtn: { flex: 1, marginRight: Space.sm },
});
