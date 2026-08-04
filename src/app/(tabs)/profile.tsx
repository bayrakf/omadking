import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Platform, Alert, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, MaxContentWidth } from '@/constants/theme';
import {
  bmr,
  dailyTargets,
  normalizeProfile,
  toMinutes,
  fromMinutes,
  DEFAULT_PROFILE,
  type UserProfile,
} from '@/lib/nutrition';
import { loadProfileOrDefault, saveProfile, resetOnboarding, getQuota, isPremium, type Quota } from '@/lib/store';

type EditableField = 'weight_kg' | 'height_cm' | 'age' | 'omad_window_start' | 'omad_window_hours' | 'default_training_time';

const CHOICES = {
  sex: [
    ['male', 'Male'],
    ['female', 'Female'],
    ['other', 'Other'],
  ],
  fitness_level: [
    ['beginner', 'Beginner'],
    ['intermediate', 'Intermediate'],
    ['advanced', 'Advanced'],
  ],
  goal: [
    ['performance', 'Performance'],
    ['weight_loss', 'Weight loss'],
    ['muscle_gain', 'Muscle gain'],
  ],
} as const;

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [premium, setPremiumState] = useState(false);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, q, prem] = await Promise.all([loadProfileOrDefault(), getQuota(), isPremium()]);
        if (!active) return;
        setProfile(p);
        setQuota(q);
        setPremiumState(prem);
        setMounted(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!mounted) return null;

  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const persist = async (next: UserProfile) => {
    // Everything goes through normalizeProfile, so an out-of-range edit is
    // clamped here rather than producing NaN targets three screens away.
    const clean = normalizeProfile(next);
    setProfile(clean);
    await saveProfile(clean);
  };

  const commitEdit = async (field: EditableField) => {
    await persist({ ...profile, [field]: editValue } as unknown as UserProfile);
    setEditingField(null);
  };

  const handleReset = () => {
    const run = async () => {
      await resetOnboarding();
      router.replace('/onboarding');
    };
    const msg = 'This clears your profile and restarts onboarding. Your weight log and meal plans are kept.';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) run();
      return;
    }
    Alert.alert('Reset profile', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: run },
    ]);
  };

  const targets = dailyTargets(profile, null);
  const restingKcal = bmr(profile);
  const windowEnd = fromMinutes(toMinutes(profile.omad_window_start) + profile.omad_window_hours * 60);

  const editableRow = (label: string, field: EditableField, suffix = '') => {
    const isEditing = editingField === field;
    return (
      <View key={field} style={[styles.row, { borderBottomColor: colors.backgroundElement }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.primary }]}
            value={editValue}
            onChangeText={setEditValue}
            onBlur={() => commitEdit(field)}
            onSubmitEditing={() => commitEdit(field)}
            keyboardType={field.includes('time') || field.includes('start') ? 'default' : 'numeric'}
            autoFocus
            accessibilityLabel={label}
          />
        ) : (
          <Pressable
            onPress={() => {
              setEditingField(field);
              setEditValue(String(profile[field]));
            }}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${label}`}
          >
            <Text style={[styles.value, { color: colors.text }]}>
              {String(profile[field])}
              {suffix} <Text style={{ color: colors.primary, fontSize: 13 }}>✎</Text>
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const choiceRow = <K extends 'sex' | 'fitness_level' | 'goal'>(label: string, field: K) => (
    <View style={styles.choiceBlock}>
      <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 10 }]}>{label}</Text>
      <View style={styles.choiceRow}>
        {CHOICES[field].map(([value, text]) => {
          const selected = profile[field] === value;
          return (
            <Pressable
              key={value}
              onPress={() => persist({ ...profile, [field]: value })}
              style={[
                styles.choiceChip,
                { backgroundColor: selected ? colors.primary : colors.backgroundElement },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={{ color: selected ? '#FFF' : colors.text, fontWeight: '600', fontSize: 13 }}>
                {text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

        {/* Subscription */}
        <Pressable
          style={[styles.planCard, { backgroundColor: premium ? colors.primary : colors.card }]}
          onPress={() => !premium && router.push('/paywall')}
          disabled={premium}
          accessibilityRole="button"
        >
          <View style={styles.flex1}>
            <Text style={[styles.planName, { color: premium ? '#FFF' : colors.text }]}>
              {premium ? '👑 Premium' : 'Free plan'}
            </Text>
            <Text style={[styles.planSub, { color: premium ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}>
              {premium
                ? 'Unlimited meal plans'
                : quota
                ? `${quota.remaining} of ${quota.limit} plans left this week`
                : ''}
            </Text>
          </View>
          {!premium && <Text style={{ color: colors.primary, fontWeight: '800' }}>Upgrade ›</Text>}
        </Pressable>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Body stats</Text>
          {editableRow('Weight', 'weight_kg', ' kg')}
          {editableRow('Height', 'height_cm', ' cm')}
          {editableRow('Age', 'age')}
          {choiceRow('Sex', 'sex')}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Training & goal</Text>
          {choiceRow('Fitness level', 'fitness_level')}
          {choiceRow('Goal', 'goal')}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Fasting window</Text>
          {editableRow('Window opens', 'omad_window_start')}
          {editableRow('Window length', 'omad_window_hours', ' h')}
          {editableRow('Usual training time', 'default_training_time')}
          <Text style={[styles.summaryNote, { color: colors.textSecondary }]}>
            Eating {profile.omad_window_start}–{windowEnd} · {24 - profile.omad_window_hours}h daily fast
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your numbers</Text>
          {(
            [
              ['Resting metabolism (BMR)', `${restingKcal} kcal`],
              ['Rest-day maintenance', `${targets.maintenance_kcal} kcal`],
              ['Rest-day target', `${targets.kcal} kcal`],
              ['Daily protein', `${targets.protein_g} g`],
            ] as const
          ).map(([label, value], i, arr) => (
            <View
              key={label}
              style={[
                styles.row,
                { borderBottomColor: colors.backgroundElement },
                i === arr.length - 1 && styles.lastRow,
              ]}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
            </View>
          ))}
          <Text style={[styles.summaryNote, { color: colors.textSecondary }]}>
            Mifflin-St Jeor. Training days add the session's estimated burn on top.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>App</Text>
          <View style={[styles.row, styles.lastRow]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.value, { color: colors.text }]}>1.0.0</Text>
          </View>
          <Pressable
            style={[styles.resetButton, { borderColor: colors.danger }]}
            onPress={handleReset}
            accessibilityRole="button"
          >
            <Text style={[styles.resetText, { color: colors.danger }]}>Reset profile</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 130, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  flex1: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16 },

  planCard: {
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: { fontSize: 17, fontWeight: '800' },
  planSub: { fontSize: 13, marginTop: 3 },

  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: { borderBottomWidth: 0 },
  label: { fontSize: 15, flex: 1, marginRight: 12 },
  value: { fontSize: 15, fontWeight: '600' },
  input: {
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: 1.5,
    minWidth: 90,
    textAlign: 'right',
    paddingVertical: 2,
  },

  choiceBlock: { paddingVertical: 14 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -8 },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },

  summaryNote: { fontSize: 12, lineHeight: 17, marginTop: 12 },

  resetButton: { marginTop: 16, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1.5 },
  resetText: { fontSize: 15, fontWeight: '700' },
});
