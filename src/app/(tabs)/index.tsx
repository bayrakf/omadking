import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import FastingRing from '@/components/FastingRing';
import EnergyChart from '@/components/EnergyChart';
import MicronutrientsCard from '@/components/MicronutrientsCard';
import StreakCard from '@/components/StreakCard';
import WaterTracker from '@/components/WaterTracker';
import PhotoMealLogger from '@/components/PhotoMealLogger';

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentHour = now.getHours();
  let greeting = 'Good morning';
  if (currentHour >= 12 && currentHour < 17) greeting = 'Good afternoon';
  else if (currentHour >= 17) greeting = 'Good evening';

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const todayStr = now.toLocaleDateString(undefined, dateOptions);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem('onboarding_profile');
        if (stored) {
          setProfile(JSON.parse(stored));
        } else {
          setProfile({
            weight_kg: 75,
            height_cm: 175,
            age: 30,
            sex: 'male',
            goal: 'performance',
            omad_window_start: '18:00',
            omad_window_hours: 1,
            default_training_time: '18:00',
            fitness_level: 'intermediate',
          });
        }
      } catch (e) {
        console.error('Failed to load profile', e);
        setProfile({
          weight_kg: 75,
          height_cm: 175,
          age: 30,
          sex: 'male',
          goal: 'performance',
          omad_window_start: '18:00',
          omad_window_hours: 1,
          default_training_time: '18:00',
          fitness_level: 'intermediate',
        });
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const effectiveProfile = profile || {
    weight_kg: 75,
    height_cm: 175,
    age: 30,
    sex: 'male',
    goal: 'performance',
    omad_window_start: '18:00',
    omad_window_hours: 1,
    default_training_time: '18:00',
    fitness_level: 'intermediate',
  };

  const weightNum = Number(effectiveProfile.weight_kg) || 75;
  const heightNum = Number(effectiveProfile.height_cm) || 175;
  const ageNum = Number(effectiveProfile.age) || 30;
  const sexVal = effectiveProfile.sex || 'male';
  const goalVal = effectiveProfile.goal || 'performance';
  const omadWindowHoursVal = Number(effectiveProfile.omad_window_hours) || 1;
  const omadWindowStartVal = effectiveProfile.omad_window_start || '14:00';
  const defaultTrainingTimeVal = effectiveProfile.default_training_time || '18:00';

  let bmr = 0;
  if (sexVal === 'female') {
    bmr = 447.593 + (9.247 * weightNum) + (3.098 * heightNum) - (4.330 * ageNum);
  } else {
    bmr = 88.362 + (13.397 * weightNum) + (4.799 * heightNum) - (5.677 * ageNum);
  }

  let activityMultiplier = 1.55;
  if (effectiveProfile.fitness_level === 'intermediate') activityMultiplier = 1.725;
  else if (effectiveProfile.fitness_level === 'advanced') activityMultiplier = 1.9;

  let targetCalories = Math.round(bmr * activityMultiplier);
  if (goalVal === 'weight_loss') targetCalories -= 500;
  if (goalVal === 'muscle_gain') targetCalories += 300;

  let proteinTarget = 0;
  if (goalVal === 'weight_loss') proteinTarget = Math.round(weightNum * 1.6);
  else if (goalVal === 'muscle_gain') proteinTarget = Math.round(weightNum * 2.2);
  else proteinTarget = Math.round(weightNum * 2.0);

  const fastingHours = 24 - omadWindowHoursVal;
  const startHour = parseInt((omadWindowStartVal || '14:00').split(':')[0], 10) || 14;
  const trainingHour = parseInt((defaultTrainingTimeVal || '18:00').split(':')[0], 10) || 18;

  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: colorScheme === 'dark' ? 'rgba(124, 58, 237, 0.25)' : 'rgba(0,0,0,0.06)',
    },
  ];
  const textStyle = { color: colors.text };
  const textSecondaryStyle = { color: colors.textSecondary };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, textStyle]}>{greeting}</Text>
          <Text style={[styles.date, textSecondaryStyle]}>{todayStr}</Text>
        </View>

        {/* Hero Banner Asset */}
        <View style={styles.heroBannerContainer}>
          <Image
            source={
              Platform.OS === 'web'
                ? { uri: '/assets/hero_banner.jpg' }
                : require('../../../assets/images/hero_banner.jpg')
            }
            style={styles.heroBannerImg}
            resizeMode="cover"
          />
          <View style={styles.heroBannerOverlay}>
            <Text style={styles.heroBannerBadge}>👑 OMAD ATHLETE PROTOCOL</Text>
            <Text style={styles.heroBannerTitle}>Fuel Your Performance</Text>
          </View>
        </View>

        {/* Circular Fasting Ring Widget */}
        <View style={cardStyle}>
          <Text style={[styles.cardTitle, textStyle]}>Fasting Window Ring</Text>
          <FastingRing
            startHour={startHour}
            durationHours={omadWindowHoursVal}
            trainingHour={trainingHour}
          />
        </View>

        {/* Energy & Glycogen Curve SVG Chart */}
        <EnergyChart startHour={startHour} trainingHour={trainingHour} />

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{targetCalories}</Text>
            <Text style={[styles.statLabel, textSecondaryStyle]}>Target kcal</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{proteinTarget}g</Text>
            <Text style={[styles.statLabel, textSecondaryStyle]}>Protein</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{fastingHours}h</Text>
            <Text style={[styles.statLabel, textSecondaryStyle]}>Fasting</Text>
          </View>
        </View>

        {/* Daily Science & Micronutrients Protocol */}
        <MicronutrientsCard weightKg={weightNum} proteinG={proteinTarget} />

        {/* Today's Plan Card */}
        <View style={cardStyle}>
          <Text style={[styles.cardTitle, textStyle]}>Today's Plan</Text>
          <Text style={[styles.emptyText, textSecondaryStyle]}>No meal plan generated yet</Text>
          <Link href="/planner" asChild>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]}>
              <Text style={styles.buttonText}>Generate AI Meal Plan 🍽️</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Fasting Streak & Badges Widget */}
        <StreakCard streakDays={7} />

        {/* Water & Electrolyte Tracker */}
        <WaterTracker />

        {/* AI Photo Meal Logger */}
        <PhotoMealLogger />

        {/* Weekly Grocery List Banner */}
        <TouchableOpacity
          style={[styles.coachBanner, { backgroundColor: colors.card, borderColor: colors.accent }]}
          onPress={() => router.push('/grocery' as any)}
        >
          <Text style={{ fontSize: 24 }}>🛒</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.coachTitle, { color: colors.text }]}>Weekly Grocery List</Text>
            <Text style={[styles.coachSub, { color: colors.textSecondary }]}>Checklist for OMAD ingredients</Text>
          </View>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>View ›</Text>
        </TouchableOpacity>

        {/* AI Coach Banner */}
        <TouchableOpacity
          style={[styles.coachBanner, { backgroundColor: colors.card, borderColor: colors.primary }]}
          onPress={() => router.push('/chat')}
        >
          <Text style={{ fontSize: 24 }}>🤖</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.coachTitle, { color: colors.text }]}>Ask AI Coach</Text>
            <Text style={[styles.coachSub, { color: colors.textSecondary }]}>Get instant timing & electrolyte advice</Text>
          </View>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Chat ›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 16, marginTop: 8 },
  greeting: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  date: { fontSize: 16 },
  card: { borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  button: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  coachBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, gap: 12, marginTop: 4 },
  coachTitle: { fontSize: 16, fontWeight: '700' },
  coachSub: { fontSize: 12 },
  heroBannerContainer: { height: 160, borderRadius: 20, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  heroBannerImg: { width: '100%', height: '100%' },
  heroBannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.45)', padding: 16, justifyContent: 'flex-end' },
  heroBannerBadge: { color: '#F59E0B', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroBannerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 2 },
});
