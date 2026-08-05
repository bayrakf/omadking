import { useCallback, useState } from 'react';
import { View, StyleSheet, TextInput, Platform, Alert, Switch } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Tap, Chip, Divider, PageHeader, Button, Notice, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import {
  bmr, dailyTargets, normalizeProfile, toMinutes, fromMinutes, PROTOCOLS, protocolForHours,
  DEFAULT_PROFILE, type UserProfile,
} from '@/lib/nutrition';
import {
  loadProfileOrDefault, saveProfile, resetOnboarding, eraseEverything, getQuota, isPremium,
  loadLastPlan, loadFastLog, loadCookLog, todayISO, type Quota,
} from '@/lib/store';
import {
  isSupported as remindersSupported, isEnabled as remindersOn,
  setEnabled as setReminders, scheduledCount, resync,
} from '@/lib/notify';
import { exportBackup, importBackup } from '@/lib/backup';
import { saveBackup, pickBackup } from '@/lib/backup-file';
import type { MealPlan } from '@/lib/ai';

type EditField = 'weight_kg' | 'height_cm' | 'age' | 'omad_window_start' | 'omad_window_hours' | 'default_training_time';

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
  const [editing, setEditing] = useState<EditField | null>(null);
  const [draft, setDraft] = useState('');
  const [remindOn, setRemindOn] = useState(false);
  const [queued, setQueued] = useState(0);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, q, prem, rOn, n] = await Promise.all([
          loadProfileOrDefault(), getQuota(), isPremium(), remindersOn(), scheduledCount(),
        ]);
        if (!active) return;
        setProfile(p); setQuota(q); setPremiumState(prem);
        setRemindOn(rOn); setQueued(n); setMounted(true);
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
    const run = async () => { await eraseEverything(); router.replace('/onboarding'); };
    const msg =
      'This deletes everything on this device: profile, weight log, fast log, plans, shopping list '
      + 'and chat history. It cannot be undone. Export first if you want a copy.';
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); return; }
    Alert.alert('Delete all data', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: run },
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

  const Row = ({ label, field, unit }: { label: string; field: EditField; unit?: string }) => {
    const active = editing === field;
    return (
      <View style={s.row}>
        <Txt variant="body" color={c.textDim}>{label}</Txt>
        {active ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={() => commit(field)}
            onSubmitEditing={() => commit(field)}
            autoFocus
            keyboardType={field.includes('time') || field.includes('start') ? 'default' : 'numeric'}
            accessibilityLabel={label}
            style={[Type.data, s.input, { color: c.accent, borderColor: c.accent }]}
          />
        ) : (
          <Tap
            onPress={() => { setEditing(field); setDraft(String(profile[field])); }}
            accessibilityLabel={`Edit ${label}`}
          >
            <View style={s.value}>
              <Txt variant="data" color={c.text} style={s.valueText}>{String(profile[field])}{unit ?? ''}</Txt>
              <Icon name="edit" size={13} color={c.textFaint} />
            </View>
          </Tap>
        )}
      </View>
    );
  };

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
          <Row label="Weight" field="weight_kg" unit=" kg" />
          <Divider />
          <Row label="Height" field="height_cm" unit=" cm" />
          <Divider />
          <Row label="Age" field="age" />
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
          <Row label="Opens" field="omad_window_start" />
          <Divider />
          <Row label="Length" field="omad_window_hours" unit=" h" />
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
          <Row label="Usual training" field="default_training_time" />
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

      <Enter index={7}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>Your data</Eyebrow>
          <Txt variant="small" color={c.textDim}>
            Everything lives on this device. There are no accounts, so a backup is the only copy that
            survives reinstalling.
          </Txt>
          <View style={s.dataRow}>
            <Button label="Export" variant="secondary" icon="share" onPress={doExport} style={s.dataBtn} />
            <Button label="Restore" variant="ghost" onPress={doImport} style={s.dataBtn} />
          </View>
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
          {/* The landing page was fully designed and reachable only by URL. */}
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

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base },
  value: { flexDirection: 'row', alignItems: 'center' },
  valueText: { marginRight: Space.sm },
  input: { minWidth: 90, textAlign: 'right', borderBottomWidth: 1.5, paddingVertical: 2, fontSize: 13 },
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
