import { useCallback, useState } from 'react';
import { View, StyleSheet, TextInput, Platform, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Tap, Chip, Divider, PageHeader, Button, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import {
  bmr, dailyTargets, normalizeProfile, toMinutes, fromMinutes, DEFAULT_PROFILE, type UserProfile,
} from '@/lib/nutrition';
import { loadProfileOrDefault, saveProfile, resetOnboarding, getQuota, isPremium, type Quota } from '@/lib/store';

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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, q, prem] = await Promise.all([loadProfileOrDefault(), getQuota(), isPremium()]);
        if (!active) return;
        setProfile(p); setQuota(q); setPremiumState(prem); setMounted(true);
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
              <Txt variant="data" color={c.text}>{String(profile[field])}{unit ?? ''}</Txt>
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
});
