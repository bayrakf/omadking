import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { router } from 'expo-router';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Enforce dark premium design for the marketing page
  const colors = Colors.dark;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation */}
        <View style={styles.navRow}>
          <Text style={[styles.logo, { color: colors.text }]}>🍽️ OMADCoach</Text>
          <Pressable onPress={() => router.push('/')}>
            <Text style={[styles.loginText, { color: colors.primary }]}>Login</Text>
          </Pressable>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            One Meal. Peak Performance.
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            The ultimate OMAD fasting app for athletes. Optimize your macros, sync your training, and achieve your peak physique.
          </Text>
        </View>

        {/* Social Proof */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.text }]}>10,000+</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Athletes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.text }]}>94%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hit Protein Goals</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.text }]}>21-day</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Streak</Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.ctaButtonText}>Start Your OMAD Journey 🚀</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/')} style={styles.secondaryAction}>
            <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>
              Already have an account? Log in
            </Text>
          </Pressable>
        </View>

        {/* Value Props */}
        <View style={styles.grid}>
          <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
            <Text style={styles.gridEmoji}>⚡</Text>
            <Text style={[styles.gridTitle, { color: colors.text }]}>Sync Training & Eating</Text>
            <Text style={[styles.gridSub, { color: colors.textSecondary }]}>
              Time your fasting window around your workouts for maximum energy and recovery.
            </Text>
          </View>

          <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
            <Text style={styles.gridEmoji}>🔥</Text>
            <Text style={[styles.gridTitle, { color: colors.text }]}>Optimize Fat Loss</Text>
            <Text style={[styles.gridSub, { color: colors.textSecondary }]}>
              Keep insulin low and fat oxidation high during your fasting state.
            </Text>
          </View>

          <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
            <Text style={styles.gridEmoji}>📈</Text>
            <Text style={[styles.gridTitle, { color: colors.text }]}>Track Progress</Text>
            <Text style={[styles.gridSub, { color: colors.textSecondary }]}>
              Monitor your weight, body fat, and workout performance over time.
            </Text>
          </View>
        </View>

        {/* How it works */}
        <View style={styles.howItWorksSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>How it works</Text>
          <View style={styles.stepsContainer}>
            <View style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Set Your Goals</Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Tell us your target weight, training schedule, and dietary preferences.</Text>
              </View>
            </View>
            <View style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Get Your Macros</Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Receive a customized macro split tailored for one massive, satisfying meal.</Text>
              </View>
            </View>
            <View style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Eat & Perform</Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Fast effortlessly, crush your workouts, and feast like a king.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          © {new Date().getFullYear()} OMADCoach. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20,  maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 60 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 22, fontWeight: '800' },
  loginText: { fontSize: 16, fontWeight: '600' },
  heroSection: {  marginTop: 12 },
  heroTitle: { fontSize: 44, fontWeight: '900', lineHeight: 52 },
  heroSubtitle: { fontSize: 18, lineHeight: 28 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  ctaContainer: {  marginVertical: 8 },
  ctaButton: { borderRadius: 16, paddingVertical: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  ctaButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  secondaryAction: { alignItems: 'center', paddingVertical: 8 },
  secondaryActionText: { fontSize: 15, fontWeight: '600' },
  grid: {  },
  gridCard: { borderRadius: 20, padding: 24 },
  gridEmoji: { fontSize: 32 },
  gridTitle: { fontSize: 20, fontWeight: '800' },
  gridSub: { fontSize: 15, lineHeight: 22 },
  howItWorksSection: {  marginTop: 16 },
  sectionTitle: { fontSize: 28, fontWeight: '800' },
  stepsContainer: {  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepNumber: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumberText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 18, fontWeight: '700' },
  stepDesc: { fontSize: 15, lineHeight: 22 },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 32, opacity: 0.6 } });
