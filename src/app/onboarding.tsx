import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, MaxContentWidth } from '@/constants/theme';
import {
  normalizeProfile,
  normTime,
  toMinutes,
  fromMinutes,
  type FitnessLevel,
  type Goal,
  type Sex,
} from '@/lib/nutrition';
import { completeOnboarding } from '@/lib/store';

type Draft = {
  weight_kg: string;
  height_cm: string;
  age: string;
  sex: Sex | null;
  fitness_level: FitnessLevel | null;
  goal: Goal | null;
  omad_window_start: string;
  omad_window_hours: number;
  default_training_time: string;
};

const TOTAL_STEPS = 5;
const EAT_PRESETS = ['12:00', '14:00', '16:00', '18:00'];
const TRAIN_PRESETS = ['06:00', '12:00', '18:00', '19:00'];

// Ranges the rest of the app can actually compute with.
const LIMITS = {
  weight_kg: [30, 300],
  height_cm: [120, 250],
  age: [14, 100],
} as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [mounted, setMounted] = useState(false);
  const colors = Colors[mounted && colorScheme === 'dark' ? 'dark' : 'light'];

  const [data, setData] = useState<Draft>({
    weight_kg: '',
    height_cm: '',
    age: '',
    sex: null,
    fitness_level: null,
    goal: null,
    omad_window_start: '18:00',
    omad_window_hours: 2,
    default_training_time: '18:00',
  });

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => setMounted(true), []);

  const animateTo = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: nextStep > step ? -40 : 40, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(nextStep > step ? 40 : -40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    });
  };

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const handleFinish = async () => {
    setSaving(true);
    // normalizeProfile clamps and canonicalises — the store never sees
    // 'Male' or a 400kg bodyweight.
    await completeOnboarding(normalizeProfile(data));
    router.replace('/');
  };

  /** Inline validation message for a numeric field, or null when fine. */
  const numericError = (field: 'weight_kg' | 'height_cm' | 'age'): string | null => {
    const raw = data[field];
    if (!raw) return null;
    const n = parseFloat(raw);
    const [min, max] = LIMITS[field];
    if (!isFinite(n)) return 'Numbers only';
    if (n < min || n > max) return `Must be between ${min} and ${max}`;
    return null;
  };

  const numericValid = (field: 'weight_kg' | 'height_cm' | 'age') => {
    const n = parseFloat(data[field]);
    const [min, max] = LIMITS[field];
    return isFinite(n) && n >= min && n <= max;
  };

  const isNextDisabled = () => {
    if (step === 1) {
      return !numericValid('weight_kg') || !numericValid('height_cm') || !numericValid('age') || !data.sex;
    }
    if (step === 2) return !data.fitness_level || !data.goal;
    if (step === 3) return !/^\d{1,2}:\d{2}$/.test(data.omad_window_start) || !/^\d{1,2}:\d{2}$/.test(data.default_training_time);
    return false;
  };

  const option = <K extends keyof Draft>(key: K, value: Draft[K], label: string, wide = false) => {
    const selected = data[key] === value;
    return (
      <Pressable
        key={String(value)}
        style={[
          styles.optionButton,
          wide && styles.optionWide,
          { backgroundColor: selected ? colors.primary : colors.backgroundElement },
        ]}
        onPress={() => update(key, value)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.optionText, { color: selected ? '#FFF' : colors.text }]}>{label}</Text>
      </Pressable>
    );
  };

  const numericField = (
    field: 'weight_kg' | 'height_cm' | 'age',
    label: string,
    placeholder: string
  ) => {
    const err = numericError(field);
    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.backgroundElement,
              borderColor: err ? colors.danger : 'transparent',
            },
          ]}
          keyboardType="numeric"
          inputMode="decimal"
          value={data[field]}
          onChangeText={(v) => update(field, v.replace(',', '.') as Draft[typeof field])}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={label}
        />
        {err && <Text style={[styles.errorText, { color: colors.danger }]}>{err}</Text>}
      </View>
    );
  };

  const timePicker = (
    key: 'omad_window_start' | 'default_training_time',
    presets: string[],
    label: string
  ) => {
    const isCustom = !presets.includes(data[key]);
    return (
      <>
        <Text style={[styles.label, styles.labelSpaced, { color: colors.textSecondary }]}>{label}</Text>
        <View style={styles.optionsWrap}>
          {presets.map((p) => option(key, p, p))}
          <Pressable
            style={[
              styles.optionButton,
              { backgroundColor: isCustom ? colors.primary : colors.backgroundElement },
            ]}
            onPress={() => update(key, isCustom ? presets[0] : '')}
            accessibilityRole="radio"
            accessibilityState={{ selected: isCustom }}
          >
            <Text style={[styles.optionText, { color: isCustom ? '#FFF' : colors.text }]}>Custom</Text>
          </Pressable>
        </View>
        {isCustom && (
          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.backgroundElement, marginTop: 12, borderColor: 'transparent' },
            ]}
            placeholder="HH:MM"
            placeholderTextColor={colors.textSecondary}
            value={data[key]}
            onChangeText={(v) => update(key, v)}
            onBlur={() => update(key, normTime(data[key], presets[0]))}
            accessibilityLabel={label}
          />
        )}
      </>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.emoji}>👑</Text>
            <Text style={[styles.title, { color: colors.text }]}>OMADCoach</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              One meal a day, timed around the training you actually do.
            </Text>
            <View style={styles.featureList}>
              {(
                [
                  ['⚡️', 'Eating window synced to your workout'],
                  ['🔥', 'Macros that change with session intensity'],
                  ['📈', 'Weight, streaks and progress tracking'],
                ] as const
              ).map(([emoji, text]) => (
                <View key={text} style={styles.featureRow}>
                  <Text style={styles.featureEmoji}>{emoji}</Text>
                  <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Body stats</Text>
            <Text style={[styles.stepHint, { color: colors.textSecondary }]}>
              Used to calculate your calorie and protein targets.
            </Text>
            <View style={styles.inputRow}>
              {numericField('weight_kg', 'Weight (kg)', '75')}
              {numericField('height_cm', 'Height (cm)', '180')}
            </View>
            {numericField('age', 'Age', '30')}
            <Text style={[styles.label, styles.labelSpaced, { color: colors.textSecondary }]}>Sex</Text>
            <View style={styles.optionsRow}>
              {option('sex', 'male', 'Male')}
              {option('sex', 'female', 'Female')}
              {option('sex', 'other', 'Other')}
            </View>
            <Text style={[styles.stepHint, { color: colors.textSecondary }]}>
              Affects the metabolic rate formula only.
            </Text>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Training & goal</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Fitness level</Text>
            <View style={styles.optionsCol}>
              {option('fitness_level', 'beginner', 'Beginner', true)}
              {option('fitness_level', 'intermediate', 'Intermediate', true)}
              {option('fitness_level', 'advanced', 'Advanced', true)}
            </View>
            <Text style={[styles.label, styles.labelSpaced, { color: colors.textSecondary }]}>Goal</Text>
            <View style={styles.optionsCol}>
              {option('goal', 'performance', 'Performance', true)}
              {option('goal', 'weight_loss', 'Weight loss', true)}
              {option('goal', 'muscle_gain', 'Muscle gain', true)}
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Timing</Text>
            {timePicker('omad_window_start', EAT_PRESETS, 'When does your eating window open?')}
            <Text style={[styles.label, styles.labelSpaced, { color: colors.textSecondary }]}>
              How long is your eating window?
            </Text>
            <View style={styles.optionsRow}>
              {option('omad_window_hours', 1, '1h')}
              {option('omad_window_hours', 2, '2h')}
              {option('omad_window_hours', 4, '4h')}
            </View>
            <Text style={[styles.stepHint, { color: colors.textSecondary }]}>
              That's a {24 - data.omad_window_hours}h daily fast.
            </Text>
            {timePicker('default_training_time', TRAIN_PRESETS, 'When do you usually train?')}
          </View>
        );

      case 4: {
        const p = normalizeProfile(data);
        return (
          <View style={styles.stepContent}>
            <Text style={styles.emoji}>✅</Text>
            <Text style={[styles.title, { color: colors.text }]}>You're set</Text>
            <View style={[styles.summaryCard, { backgroundColor: colors.backgroundElement }]}>
              {(
                [
                  [
                    'Eating window',
                    `${p.omad_window_start}–${fromMinutes(toMinutes(p.omad_window_start) + p.omad_window_hours * 60)}`,
                  ],
                  ['Daily fast', `${24 - p.omad_window_hours}h`],
                  ['Usual training', p.default_training_time],
                  ['Goal', p.goal.replace('_', ' ')],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You can change any of this later in Profile.
            </Text>
          </View>
        );
      }
    }
  };

  if (!mounted) return null;

  const nextLabel = step === 0 ? "Let's go" : step === TOTAL_STEPS - 1 ? 'Start planning' : 'Next';
  const disabled = isNextDisabled() || saving;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          {step > 0 && (
            <Pressable onPress={() => animateTo(step - 1)} style={styles.backButton} accessibilityRole="button">
              <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
            </Pressable>
          )}
          <View style={styles.progressContainer}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  { backgroundColor: i <= step ? colors.primary : colors.backgroundElement },
                  i === step && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={[styles.animatedContent, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}
          >
            {renderStep()}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.mainButton,
              { backgroundColor: disabled ? colors.backgroundElement : colors.primary },
            ]}
            onPress={step === TOTAL_STEPS - 1 ? handleFinish : () => animateTo(step + 1)}
            disabled={disabled}
            accessibilityRole="button"
          >
            <Text style={[styles.mainButtonText, { color: disabled ? colors.textSecondary : '#FFFFFF' }]}>
              {nextLabel}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, height: 44 },
  backButton: { position: 'absolute', left: 24, zIndex: 1, paddingVertical: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  progressContainer: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  progressDotActive: { width: 24 },

  scrollContent: { flexGrow: 1 },
  animatedContent: { flex: 1, padding: 24, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  stepContent: { flex: 1, justifyContent: 'center' },

  emoji: { fontSize: 64, marginBottom: 20, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 16, marginTop: 12, textAlign: 'center', lineHeight: 24 },
  stepTitle: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  stepHint: { fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 8 },

  featureList: { marginTop: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureEmoji: { fontSize: 24, marginRight: 14 },
  featureText: { fontSize: 16, flex: 1, fontWeight: '500' },

  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  labelSpaced: { marginTop: 24 },
  inputRow: { flexDirection: 'row', marginRight: -12 },
  inputGroup: { flex: 1, marginBottom: 16, marginRight: 12 },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, borderWidth: 1.5 },
  errorText: { fontSize: 12, marginTop: 6 },

  optionsRow: { flexDirection: 'row', marginRight: -10 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -10 },
  optionsCol: { flexDirection: 'column' },
  optionButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    marginRight: 10,
    marginBottom: 10,
  },
  optionWide: { width: '100%', marginRight: 0 },
  optionText: { fontSize: 15, fontWeight: '600' },

  summaryCard: { borderRadius: 16, padding: 18, marginTop: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },

  footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 8 : 24 },
  mainButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  mainButtonText: { fontSize: 16, fontWeight: '700' },
});
