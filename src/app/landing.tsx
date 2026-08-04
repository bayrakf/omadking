import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { FREE_PLANS_PER_WEEK } from '@/lib/store';

const VALUE_PROPS = [
  {
    emoji: '⚡',
    title: 'Timing, not guesswork',
    body: 'Tell it when you train. It works out whether you eat before, after, or split around the session — and gives you the clock times.',
  },
  {
    emoji: '🔥',
    title: 'Macros that follow the work',
    body: 'A two-hour max-intensity session and a rest day are not the same calorie target. Duration and intensity feed straight into the numbers.',
  },
  {
    emoji: '🍲',
    title: 'Built for meal prep',
    body: 'Every recipe comes with reheat instructions for skillet, air fryer and microwave, because you cooked it yesterday.',
  },
];

const STEPS: [string, string][] = [
  ['Set your profile', 'Bodyweight, training schedule and goal. Takes about a minute.'],
  ['Log the session', 'Sport, duration, intensity and start time.'],
  ['Eat on schedule', 'Get your window, your macros and a recipe that fits them.'],
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // The marketing page is deliberately dark in both themes.
  const colors = Colors.dark;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.navRow}>
          <Text style={[styles.logo, { color: colors.text }]}>🍽️ OMADCoach</Text>
        </View>

        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>One meal.{'\n'}Timed properly.</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            An OMAD planner for people who train hard in the evening. It works out when to eat around your session
            and what to put on the plate.
          </Text>
        </View>

        <View style={styles.ctaContainer}>
          <Pressable
            onPress={() => router.replace('/onboarding')}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaButtonText}>Get started — free</Text>
          </Pressable>
          {/* Honest about the tier, and no "log in" link when there are no accounts. */}
          <Text style={[styles.ctaNote, { color: colors.textSecondary }]}>
            {FREE_PLANS_PER_WEEK} meal plans a week on the free tier. No account needed — your data stays on your
            device.
          </Text>
        </View>

        <View style={styles.grid}>
          {VALUE_PROPS.map((p) => (
            <View key={p.title} style={[styles.gridCard, { backgroundColor: colors.card }]}>
              <Text style={styles.gridEmoji}>{p.emoji}</Text>
              <Text style={[styles.gridTitle, { color: colors.text }]}>{p.title}</Text>
              <Text style={[styles.gridSub, { color: colors.textSecondary }]}>{p.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.howItWorksSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>How it works</Text>
          {STEPS.map(([title, desc], i) => (
            <View key={title} style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.replace('/onboarding')}
          style={({ pressed }) => [
            styles.ctaButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.ctaButtonText}>Start your first plan</Text>
        </Pressable>

        <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
          OMADCoach gives general nutrition and training guidance. It is not medical advice. Talk to a clinician
          before starting extended fasting, especially if you are pregnant, diabetic, or taking medication.
        </Text>

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          © {new Date().getFullYear()} OMADCoach
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, maxWidth: 640, alignSelf: 'center', width: '100%', paddingBottom: 60 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 20, fontWeight: '800' },

  heroSection: { marginBottom: 28 },
  heroTitle: { fontSize: 40, fontWeight: '900', lineHeight: 46, letterSpacing: -1 },
  heroSubtitle: { fontSize: 17, lineHeight: 26, marginTop: 18 },

  ctaContainer: { marginBottom: 44 },
  ctaButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  ctaNote: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 14 },

  grid: { marginBottom: 40 },
  gridCard: { borderRadius: 20, padding: 22, marginBottom: 14 },
  gridEmoji: { fontSize: 28, marginBottom: 10 },
  gridTitle: { fontSize: 19, fontWeight: '800', marginBottom: 8 },
  gridSub: { fontSize: 15, lineHeight: 22 },

  howItWorksSection: { marginBottom: 36 },
  sectionTitle: { fontSize: 26, fontWeight: '800', marginBottom: 22 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  stepNumberText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  stepDesc: { fontSize: 15, lineHeight: 22 },

  disclaimer: { fontSize: 12, lineHeight: 18, marginTop: 32, textAlign: 'center' },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 20, opacity: 0.6 },
});
