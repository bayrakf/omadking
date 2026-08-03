import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import RecipeCard from '@/components/RecipeCard';

const SPORTS = [
  { id: 'running', label: '🏃 Running' },
  { id: 'weights', label: '🏋️ Weights' },
  { id: 'cycling', label: '🚴 Cycling' },
  { id: 'soccer', label: '⚽ Soccer' },
  { id: 'boxing', label: '🥊 Boxing' },
  { id: 'yoga', label: '🧘 Yoga' },
];

const DURATIONS = [30, 45, 60, 90, 120];

const INTENSITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'max', label: 'Max' },
];

const TRAINING_TIMES = ['17:00', '18:00', '19:00', '20:00'];

type MealPlanResult = {
  eating_window_start: string;
  eating_window_end: string;
  total_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  pre_training_snack_time: string | null;
  main_meal_time: string;
  ai_reasoning: string;
  recipe: {
    title: string;
    ingredients: string[];
    instructions: string;
    reheat_instructions: string;
    prep_time_min: number;
    is_meal_prep: boolean;
  };
};

export default function PlannerScreen() {
  const colors = Colors.dark;

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [macroTargets, setMacroTargets] = useState<{ kcal: number; protein: number; carbs: number; fat: number } | null>(null);

  const [isRestDay, setIsRestDay] = useState<boolean>(false);
  const [sport, setSport] = useState<string>('weights');
  const [duration, setDuration] = useState<number>(60);
  const [intensity, setIntensity] = useState<string>('medium');
  const [trainingTime, setTrainingTime] = useState<string>('18:00');

  const [loading, setLoading] = useState(false);
  const [planResult, setPlanResult] = useState<MealPlanResult | null>(null);
  const [mealHistory, setMealHistory] = useState<MealPlanResult[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const profileStr = await AsyncStorage.getItem('onboarding_profile');
        let parsed = null;
        if (profileStr) {
          parsed = JSON.parse(profileStr);
          setProfile(parsed);
          if (parsed?.default_training_time) {
            setTrainingTime(parsed.default_training_time);
          }

          // Calculate today's macro targets locally
          const weight = Number(parsed.weight_kg) || 75;
          const height = Number(parsed.height_cm) || 175;
          const age = Number(parsed.age) || 30;
          const sex = parsed.sex || 'male';
          const goal = parsed.goal || 'performance';
          
          let bmr = 10 * weight + 6.25 * height - 5 * age;
          bmr += sex === 'female' ? -161 : 5;
          
          let tdee = Math.round(bmr * 1.55);
          if (goal === 'weight_loss') tdee -= 400;
          if (goal === 'muscle_gain') tdee += 300;
          
          const protein = Math.round(weight * (goal === 'muscle_gain' ? 2.2 : 2.0));
          const fat = Math.round((tdee * 0.25) / 9);
          const carbs = Math.round((tdee - (protein * 4 + fat * 9)) / 4);

          setMacroTargets({ kcal: tdee, protein, carbs, fat });
        }

        const historyStr = await AsyncStorage.getItem('meal_history');
        if (historyStr) {
          setMealHistory(JSON.parse(historyStr));
        }
      } catch (e) {
        console.error('Error init planner:', e);
      } finally {
        setMounted(true);
      }
    };
    init();
  }, []);

  if (!mounted) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setPlanResult(null);

    try {
      const payload = {
        weight_kg: Number(profile?.weight_kg) || 75,
        height_cm: Number(profile?.height_cm) || 175,
        age: Number(profile?.age) || 30,
        sex: profile?.sex || 'male',
        fitness_level: profile?.fitness_level || 'intermediate',
        goal: profile?.goal || 'performance',
        omad_window_start: profile?.omad_window_start || '18:00',
        omad_window_hours: Number(profile?.omad_window_hours) || 1,
        sport_type: isRestDay ? 'Rest Day' : (SPORTS.find((s) => s.id === sport)?.label || sport),
        duration_min: isRestDay ? 0 : duration,
        intensity: isRestDay ? 'low' : intensity,
        planned_start_time: trainingTime,
      };

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/generate_meal_plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify(payload),
      });

      let data;
      if (!res.ok) {
        throw new Error('Failed to generate meal plan');
      } else {
        data = await res.json();
      }

      setPlanResult(data);

      // Save raw plan to last_meal_plan
      await AsyncStorage.setItem('last_meal_plan', JSON.stringify(data));

      // Save to history
      const newHistory = [data, ...mealHistory].slice(0, 3);
      setMealHistory(newHistory);
      await AsyncStorage.setItem('meal_history', JSON.stringify(newHistory));

    } catch (e) {
      console.error('Plan generation failed:', e);
      alert('Failed to generate meal plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (plan: MealPlanResult) => {
    const text = `🍽️ ${plan.recipe.title}\n\n📊 Macros: ${plan.total_kcal} kcal (P: ${plan.protein_g}g, C: ${plan.carbs_g}g, F: ${plan.fat_g}g)\n\n🛒 Ingredients:\n${plan.recipe.ingredients.map((i) => `• ${i}`).join('\n')}\n\n👨‍🍳 Instructions:\n${plan.recipe.instructions}`;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        alert('Meal plan copied to clipboard! 📋');
      } catch (err) {
        console.error('Failed to copy', err);
      }
    } else {
      await Share.share({ message: text });
    }
  };

  const renderHistory = () => {
    if (mealHistory.length === 0) return null;
    return (
      <View style={styles.historySection}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>📜 Recent Meal Plans</Text>
        {mealHistory.map((plan, idx) => (
          <Pressable
            key={idx}
            style={[styles.historyCard, { backgroundColor: colors.backgroundElement }]}
            onPress={() => {
              setPlanResult(plan);
              // scroll to top logic if needed, but they can just see it above
            }}
          >
            <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
              {plan.recipe.title}
            </Text>
            <Text style={[styles.historyMacros, { color: colors.textSecondary }]}>
              {plan.total_kcal} kcal | P: {plan.protein_g}g
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Meal Planner</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Plan your ultimate OMAD feast
          </Text>
        </View>

        {/* Macro Targets Banner */}
        {macroTargets && (
          <View style={[styles.macroBanner, { backgroundColor: colors.card }]}>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>Today's Target</Text>
            <View style={styles.bannerRow}>
              <View style={styles.bannerItem}>
                <Text style={[styles.bannerVal, { color: colors.primary }]}>{macroTargets.kcal}</Text>
                <Text style={[styles.bannerLbl, { color: colors.textSecondary }]}>kcal</Text>
              </View>
              <View style={styles.bannerItem}>
                <Text style={[styles.bannerVal, { color: colors.primary }]}>{macroTargets.protein}g</Text>
                <Text style={[styles.bannerLbl, { color: colors.textSecondary }]}>Protein</Text>
              </View>
              <View style={styles.bannerItem}>
                <Text style={[styles.bannerVal, { color: colors.primary }]}>{macroTargets.carbs}g</Text>
                <Text style={[styles.bannerLbl, { color: colors.textSecondary }]}>Carbs</Text>
              </View>
              <View style={styles.bannerItem}>
                <Text style={[styles.bannerVal, { color: colors.primary }]}>{macroTargets.fat}g</Text>
                <Text style={[styles.bannerLbl, { color: colors.textSecondary }]}>Fat</Text>
              </View>
            </View>
          </View>
        )}

        {/* Training Input Section Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          
          {/* Rest Day Toggle */}
          <View style={[styles.inputGroup, styles.rowBetween]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>🛋️ Rest Day (No Workout)</Text>
            <Switch
              value={isRestDay}
              onValueChange={setIsRestDay}
              trackColor={{ false: colors.backgroundElement, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {!isRestDay && (
            <>
              {/* Sport Type */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Sport Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {SPORTS.map((item) => {
                    const isSelected = sport === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setSport(item.id)}
                        style={[
                          styles.chip,
                          { backgroundColor: isSelected ? colors.primary : colors.backgroundElement },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Duration */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Duration</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {DURATIONS.map((d) => {
                    const isSelected = duration === d;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => setDuration(d)}
                        style={[
                          styles.chip,
                          { backgroundColor: isSelected ? colors.primary : colors.backgroundElement },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                          {d}min
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Intensity */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Intensity</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {INTENSITIES.map((item) => {
                    const isSelected = intensity === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setIntensity(item.id)}
                        style={[
                          styles.chip,
                          { backgroundColor: isSelected ? colors.primary : colors.backgroundElement },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Training Time */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Training Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {TRAINING_TIMES.map((time) => {
                    const isSelected = trainingTime === time;
                    return (
                      <Pressable
                        key={time}
                        onPress={() => setTrainingTime(time)}
                        style={[
                          styles.chip,
                          { backgroundColor: isSelected ? colors.primary : colors.backgroundElement },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                          {time}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </View>

        {/* Generate Button */}
        <Pressable
          disabled={loading}
          onPress={handleGenerate}
          style={({ pressed }) => [
            styles.generateButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed || loading ? 0.8 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.generateButtonText, { color: '#FFFFFF' }]}>
              Generate Meal Plan 🍽️
            </Text>
          )}
        </Pressable>

        {/* Result Area */}
        {planResult ? (
          <View>
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
                {
                  backgroundColor: colors.backgroundElement,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.shareButtonText, { color: colors.text }]}>
                Share / Copy to Clipboard 📋
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.resultCardEmpty, { backgroundColor: colors.card }]}>
            <Text style={[styles.resultText, { color: colors.textSecondary }]}>
              Select workout & tap Generate to create meal plan
            </Text>
          </View>
        )}

        {/* History Area */}
        {renderHistory()}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, rowGap: 20, columnGap: 20, paddingBottom: 60 },
  header: { marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  
  macroBanner: { borderRadius: 16, padding: 16, rowGap: 12, columnGap: 12 },
  bannerTitle: { fontSize: 16, fontWeight: '700' },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bannerItem: { alignItems: 'center' },
  bannerVal: { fontSize: 18, fontWeight: '800' },
  bannerLbl: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  card: { borderRadius: 16, padding: 16, rowGap: 16, columnGap: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputGroup: { rowGap: 8, columnGap: 8 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', rowGap: 8, columnGap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  
  generateButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  generateButtonText: { fontSize: 16, fontWeight: '700' },
  
  shareButton: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  shareButtonText: { fontSize: 15, fontWeight: '600' },
  
  resultCardEmpty: { borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  resultText: { fontSize: 14, textAlign: 'center' },

  historySection: { marginTop: 10, rowGap: 10, columnGap: 10 },
  sectionHeading: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  historyCard: { padding: 16, borderRadius: 12, rowGap: 4, columnGap: 4 },
  historyTitle: { fontSize: 16, fontWeight: '600' },
  historyMacros: { fontSize: 13 },
});
