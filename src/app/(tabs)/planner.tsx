import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Share,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, MaxContentWidth, type ThemePalette } from '@/constants/theme';
import RecipeCard from '@/components/RecipeCard';
import { dailyTargets, DEFAULT_PROFILE, type Intensity, type Training, type UserProfile } from '@/lib/nutrition';
import { generateMealPlan, QuotaError, type MealPlan } from '@/lib/ai';
import { loadProfileOrDefault, loadPlanHistory, savePlan, getQuota, consumeQuota, type Quota } from '@/lib/store';

const SPORTS = [
  { id: 'running', label: '🏃 Running' },
  { id: 'weights', label: '🏋️ Weights' },
  { id: 'cycling', label: '🚴 Cycling' },
  { id: 'soccer', label: '⚽ Soccer' },
  { id: 'boxing', label: '🥊 Boxing' },
  { id: 'yoga', label: '🧘 Yoga' },
];

const DURATIONS = [30, 45, 60, 90, 120];
const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'max', label: 'Max' },
];
const TRAINING_TIMES = ['06:00', '12:00', '17:00', '18:00', '19:00', '20:00'];

export default function PlannerScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [quota, setQuota] = useState<Quota | null>(null);

  const [isRestDay, setIsRestDay] = useState(false);
  const [sport, setSport] = useState('weights');
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [trainingTime, setTrainingTime] = useState('18:00');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<MealPlan | null>(null);
  const [history, setHistory] = useState<MealPlan[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, h, q] = await Promise.all([loadProfileOrDefault(), loadPlanHistory<MealPlan>(), getQuota()]);
        if (!active) return;
        setProfile(p);
        setTrainingTime(p.default_training_time);
        setHistory(h);
        setQuota(q);
        setMounted(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!mounted) return null;

  const training: Training | null = isRestDay
    ? null
    : { sport, duration_min: duration, intensity, start_time: trainingTime };

  // Live preview — the numbers update as you change the workout, so it's obvious
  // that intensity and duration actually matter.
  const preview = dailyTargets(profile, training);

  const handleGenerate = async () => {
    if (quota && !quota.premium && quota.remaining <= 0) {
      router.push('/paywall');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const plan = await generateMealPlan(profile, training);
      setPlanResult(plan);
      setHistory(await savePlan(plan));
      await consumeQuota();
      setQuota(await getQuota());
    } catch (e) {
      if (e instanceof QuotaError) {
        router.push('/paywall');
      } else {
        // `alert()` doesn't exist on native — this used to throw on iOS/Android
        // on top of whatever failed first.
        setError('Could not generate a plan. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (plan: MealPlan) => {
    const text =
      `🍽️ ${plan.recipe.title}\n\n` +
      `⏰ Eat at ${plan.main_meal_time} (window ${plan.eating_window_start}–${plan.eating_window_end})\n` +
      (plan.pre_training_snack_time ? `⚡ Pre-training snack at ${plan.pre_training_snack_time}\n` : '') +
      `\n📊 ${plan.total_kcal} kcal — P ${plan.protein_g}g / C ${plan.carbs_g}g / F ${plan.fat_g}g\n\n` +
      `🛒 Ingredients:\n${plan.recipe.ingredients.map((i) => `• ${i}`).join('\n')}\n\n` +
      `👨‍🍳 Method:\n${plan.recipe.instructions}` +
      (plan.recipe.reheat_instructions ? `\n\n🔥 Reheat:\n${plan.recipe.reheat_instructions}` : '');

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        setError(null);
      } catch {
        setError('Could not copy to clipboard.');
      }
    } else {
      await Share.share({ message: text });
    }
  };

  const chip = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? colors.primary : colors.backgroundElement },
  ];
  const chipText = (selected: boolean) => [
    styles.chipText,
    { color: selected ? '#FFFFFF' : colors.text },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Meal Planner</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your macros and meal timing, built around today's session.
        </Text>

        {quota && !quota.premium && (
          <Pressable
            style={[styles.quotaBar, { backgroundColor: colors.backgroundElement }]}
            onPress={() => router.push('/paywall')}
            accessibilityRole="button"
          >
            <Text style={[styles.quotaText, { color: colors.textSecondary }]}>
              {quota.remaining > 0
                ? `${quota.remaining} of ${quota.limit} free plans left this week`
                : 'Free plans used up for this week'}
            </Text>
            <Text style={[styles.quotaLink, { color: colors.primary }]}>Upgrade</Text>
          </Pressable>
        )}

        {/* Live targets */}
        <View style={[styles.macroBanner, { backgroundColor: colors.card }]}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>
            {isRestDay ? 'Rest day target' : 'Training day target'}
          </Text>
          <View style={styles.bannerRow}>
            {(
              [
                [String(preview.kcal), 'kcal'],
                [`${preview.protein_g}g`, 'Protein'],
                [`${preview.carbs_g}g`, 'Carbs'],
                [`${preview.fat_g}g`, 'Fat'],
              ] as const
            ).map(([val, lbl]) => (
              <View key={lbl} style={styles.bannerItem}>
                <Text style={[styles.bannerVal, { color: colors.primary }]}>{val}</Text>
                <Text style={[styles.bannerLbl, { color: colors.textSecondary }]}>{lbl}</Text>
              </View>
            ))}
          </View>
          {preview.burn_kcal > 0 && (
            <Text style={[styles.bannerNote, { color: colors.textSecondary }]}>
              Includes ~{preview.burn_kcal} kcal for {duration}min {intensity}-intensity {sport}.
            </Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>🛋️ Rest day</Text>
            <Switch
              value={isRestDay}
              onValueChange={setIsRestDay}
              trackColor={{ false: colors.backgroundElement, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {!isRestDay && (
            <>
              <Text style={[styles.label, styles.labelSpaced, { color: colors.textSecondary }]}>Sport</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {SPORTS.map((item) => (
                  <Pressable key={item.id} onPress={() => setSport(item.id)} style={chip(sport === item.id)}>
                    <Text style={chipText(sport === item.id)}>{item.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.label, styles.labelSpaced, { color: colors.textSecondary }]}>Duration</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {DURATIONS.map((d) => (
                  <Pressable key={d} onPress={() => setDuration(d)} style={chip(duration === d)}>
                    <Text style={chipText(duration === d)}>{d} min</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.label, styles.labelSpaced, { color: colors.textSecondary }]}>Intensity</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {INTENSITIES.map((item) => (
                  <Pressable key={item.id} onPress={() => setIntensity(item.id)} style={chip(intensity === item.id)}>
                    <Text style={chipText(intensity === item.id)}>{item.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.label, styles.labelSpaced, { color: colors.textSecondary }]}>Start time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {TRAINING_TIMES.map((time) => (
                  <Pressable key={time} onPress={() => setTrainingTime(time)} style={chip(trainingTime === time)}>
                    <Text style={chipText(trainingTime === time)}>{time}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </View>

        <Pressable
          disabled={loading}
          onPress={handleGenerate}
          style={({ pressed }) => [
            styles.generateButton,
            { backgroundColor: colors.primary, opacity: pressed || loading ? 0.75 : 1 },
          ]}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateButtonText}>Generate meal plan 🍽️</Text>
          )}
        </Pressable>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>
          </View>
        )}

        {planResult ? (
          <View>
            <TimingStrip plan={planResult} colors={colors} />
            <RecipeCard
              title={planResult.recipe.title}
              reasoning={planResult.ai_reasoning}
              totalKcal={planResult.total_kcal}
              proteinG={planResult.protein_g}
              carbsG={planResult.carbs_g}
              fatG={planResult.fat_g}
              ingredients={planResult.recipe.ingredients}
              instructions={planResult.recipe.instructions}
              reheatInstructions={planResult.recipe.reheat_instructions}
              prepTimeMin={planResult.recipe.prep_time_min}
            />
            <Pressable
              onPress={() => handleShare(planResult)}
              style={({ pressed }) => [
                styles.shareButton,
                { backgroundColor: colors.backgroundElement, opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.shareButtonText, { color: colors.text }]}>
                {Platform.OS === 'web' ? 'Copy plan to clipboard 📋' : 'Share plan 📤'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Set your session above, then generate a plan with the exact times to eat.
            </Text>
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Recent plans</Text>
            {history.map((plan, idx) => (
              <Pressable
                key={`${plan.date}-${idx}`}
                style={[styles.historyCard, { backgroundColor: colors.backgroundElement }]}
                onPress={() => setPlanResult(plan)}
                accessibilityRole="button"
              >
                <View style={styles.flex1}>
                  <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                    {plan.recipe.title}
                  </Text>
                  <Text style={[styles.historyMacros, { color: colors.textSecondary }]}>
                    {plan.date} • {plan.total_kcal} kcal • {plan.protein_g}g protein
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The timing answer, which is the thing the app exists to produce. */
function TimingStrip({ plan, colors }: { plan: MealPlan; colors: ThemePalette }) {
  const rows = [
    plan.pre_training_snack_time && (['⚡ Pre-training snack', plan.pre_training_snack_time] as const),
    ['🍽️ Main meal', plan.main_meal_time] as const,
    ['🚪 Window closes', plan.eating_window_end] as const,
  ].filter(Boolean) as (readonly [string, string])[];

  return (
    <View style={[styles.timingCard, { backgroundColor: colors.card, borderColor: colors.primary + '55' }]}>
      <Text style={[styles.timingTitle, { color: colors.text }]}>Today's timing</Text>
      {rows.map(([label, time]) => (
        <View key={label} style={styles.timingRow}>
          <Text style={[styles.timingLabel, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[styles.timingTime, { color: colors.primary }]}>{time}</Text>
        </View>
      ))}
      {plan.timing_warning && (
        <Text style={[styles.timingWarning, { color: colors.accent }]}>⚠️ {plan.timing_warning}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 130, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  flex1: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 16 },

  quotaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  quotaText: { fontSize: 13 },
  quotaLink: { fontSize: 13, fontWeight: '700' },

  macroBanner: { borderRadius: 16, padding: 16, marginBottom: 12 },
  bannerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bannerItem: { alignItems: 'center', flex: 1 },
  bannerVal: { fontSize: 18, fontWeight: '800' },
  bannerLbl: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  bannerNote: { fontSize: 12, marginTop: 12, lineHeight: 17 },

  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  labelSpaced: { marginTop: 18, marginBottom: 10 },
  chipRow: { flexDirection: 'row', paddingRight: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  chipText: { fontSize: 14, fontWeight: '600' },

  generateButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  generateButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  errorBox: { borderRadius: 12, padding: 14, marginTop: 12 },

  timingCard: { borderRadius: 16, padding: 16, borderWidth: 1.5, marginTop: 16 },
  timingTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  timingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  timingLabel: { fontSize: 14 },
  timingTime: { fontSize: 17, fontWeight: '800' },
  timingWarning: { fontSize: 13, lineHeight: 19, marginTop: 8 },

  shareButton: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  shareButtonText: { fontSize: 15, fontWeight: '600' },

  emptyCard: { borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  historySection: { marginTop: 24 },
  sectionHeading: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  historyCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyTitle: { fontSize: 15, fontWeight: '700' },
  historyMacros: { fontSize: 12, marginTop: 3 },
});
