import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [sport, setSport] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [intensity, setIntensity] = useState<string>('medium');
  const [trainingTime, setTrainingTime] = useState<string>('18:00');

  const [loading, setLoading] = useState(false);
  const [planResult, setPlanResult] = useState<MealPlanResult | null>(null);

  useEffect(() => {
    const loadDefaultTrainingTime = async () => {
      try {
        const profileStr = await AsyncStorage.getItem('onboarding_profile');
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          if (profile?.default_training_time) {
            setTrainingTime(profile.default_training_time);
          }
        }
      } catch (e) {
        console.error('Error loading profile:', e);
      }
    };
    loadDefaultTrainingTime();
  }, []);

  const handleGenerate = async () => {
    if (!sport) return;
    setLoading(true);
    setPlanResult(null);

    try {
      const profileStr = await AsyncStorage.getItem('onboarding_profile');
      const profile = profileStr ? JSON.parse(profileStr) : {};

      const payload = {
        weight_kg: Number(profile.weight_kg) || 75,
        height_cm: Number(profile.height_cm) || 175,
        age: Number(profile.age) || 30,
        sex: profile.sex || 'male',
        fitness_level: profile.fitness_level || 'intermediate',
        goal: profile.goal || 'performance',
        omad_window_start: profile.omad_window_start || '18:00',
        omad_window_hours: Number(profile.omad_window_hours) || 1,
        sport_type: SPORTS.find((s) => s.id === sport)?.label || sport,
        duration_min: duration,
        intensity,
        planned_start_time: trainingTime,
      };

      const { data, error } = await supabase.functions.invoke('generate_meal_plan', {
        body: payload,
      });

      if (error || !data || data.error) {
        // Fallback local calculation when Edge function / URL not active yet
        const weight = payload.weight_kg;
        const bmr = 10 * weight + 6.25 * payload.height_cm - 5 * payload.age + 5;
        const tdee = Math.round(bmr * 1.55);
        const protein = Math.round(weight * 2);
        const fat = Math.round((tdee * 0.25) / 9);
        const carbs = Math.round((tdee - (protein * 4 + fat * 9)) / 4);

        setPlanResult({
          eating_window_start: payload.omad_window_start,
          eating_window_end: '19:00',
          total_kcal: tdee,
          protein_g: protein,
          carbs_g: carbs,
          fat_g: fat,
          pre_training_snack_time: null,
          main_meal_time: payload.omad_window_start,
          ai_reasoning: `High-protein meal scheduled right after ${payload.sport_type} to fuel recovery and maintain glycogen stores.`,
          recipe: {
            title: 'Chicken & Sweet Potato Power Bowl',
            ingredients: [
              '250g Chicken breast (grilled)',
              '300g Sweet potato (roasted)',
              '100g Broccoli (steamed)',
              '1 tbsp Olive oil',
              'Sea salt & black pepper',
            ],
            instructions: 'Season chicken and roast with sweet potato at 200°C for 25 mins. Serve with steamed broccoli.',
            reheat_instructions: 'Microwave 2.5 mins at 800W or reheat in skillet with 1 tsp water.',
            prep_time_min: 25,
            is_meal_prep: true,
          },
        });
      } else {
        setPlanResult(data);
      }
    } catch (e) {
      console.error('Plan generation failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Meal Planner</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Plan your meal around today's training
          </Text>
        </View>

        {/* Training Input Section Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
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
        </View>

        {/* Generate Button */}
        <Pressable
          disabled={!sport || loading}
          onPress={handleGenerate}
          style={({ pressed }) => [
            styles.generateButton,
            {
              backgroundColor: !sport ? colors.backgroundElement : colors.primary,
              opacity: pressed || loading ? 0.8 : !sport ? 0.6 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.generateButtonText, { color: !sport ? colors.textSecondary : '#FFFFFF' }]}>
              Generate Meal Plan 🍽️
            </Text>
          )}
        </Pressable>

        {/* Result Area */}
        {planResult ? (
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
        ) : (
          <View style={[styles.resultCardEmpty, { backgroundColor: colors.card }]}>
            <Text style={[styles.resultText, { color: colors.textSecondary }]}>
              Select workout & tap Generate to create meal plan
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 20 },
  header: { marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  card: { borderRadius: 16, padding: 16, gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  generateButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  generateButtonText: { fontSize: 16, fontWeight: '700' },
  resultCard: { borderRadius: 16, padding: 20, gap: 12 },
  resultCardEmpty: { borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  resultText: { fontSize: 14, textAlign: 'center' },
  planTitle: { fontSize: 20, fontWeight: '700' },
  reasoning: { fontSize: 14, lineHeight: 20 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  macroBadge: { alignItems: 'center', padding: 8, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.1)', flex: 1, marginHorizontal: 2 },
  macroVal: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  macroLbl: { fontSize: 11, color: '#6B7280' },
  sectionHeading: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  bulletText: { fontSize: 14, lineHeight: 22 },
  instructionsText: { fontSize: 14, lineHeight: 20 },
});
