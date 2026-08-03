import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

export default function LandingPage() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleWaitlistSubmit = () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setSubmitted(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation */}
        <View style={styles.navRow}>
          <Text style={[styles.logo, { color: colors.text }]}>🍽️ OMADCoach</Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>Early Access</Text>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Don't Crash Your Evening Workout on OMAD.
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            AI-calculated meal timing, precise macros & reheatable prep recipes designed around your fasting window and intense evening sports.
          </Text>
        </View>

        {/* Waitlist Form Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {submitted ? (
            <View style={styles.successBox}>
              <Text style={styles.successEmoji}>🎉</Text>
              <Text style={[styles.successTitle, { color: colors.text }]}>You're on the list!</Text>
              <Text style={[styles.successSub, { color: colors.textSecondary }]}>
                We'll notify you as soon as early access spots open.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Get Priority Early Access</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                Join 500+ OMAD athletes optimizing their energy timing.
              </Text>
              <TextInput
                placeholder="Enter your email address"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.backgroundElement,
                    color: colors.text,
                    borderColor: colors.backgroundElement,
                  },
                ]}
              />
              <Pressable
                onPress={handleWaitlistSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.submitButtonText}>Join Waitlist 🚀</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Value Props Grid */}
        <View style={styles.grid}>
          <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
            <Text style={styles.gridEmoji}>⚡</Text>
            <Text style={[styles.gridTitle, { color: colors.text }]}>Zero Energy Dips</Text>
            <Text style={[styles.gridSub, { color: colors.textSecondary }]}>
              Timing calculations ensure optimal glycogen stores during heavy workout spikes.
            </Text>
          </View>

          <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
            <Text style={styles.gridEmoji}>🍲</Text>
            <Text style={[styles.gridTitle, { color: colors.text }]}>Meal Prep & Reheat Guides</Text>
            <Text style={[styles.gridSub, { color: colors.textSecondary }]}>
              AI outputs step-by-step reheating instructions for pre-cooked meals from yesterday.
            </Text>
          </View>

          <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
            <Text style={styles.gridEmoji}>📊</Text>
            <Text style={[styles.gridTitle, { color: colors.text }]}>Automatic Macro Split</Text>
            <Text style={[styles.gridSub, { color: colors.textSecondary }]}>
              Tailored Protein, Carbs & Fat breakdown calculated for performance or weight loss goals.
            </Text>
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
  scrollContent: { padding: 20, gap: 24, maxWidth: 600, alignSelf: 'center', width: '100%' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 20, fontWeight: '800' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  heroSection: { gap: 12, marginTop: 8 },
  heroTitle: { fontSize: 32, fontWeight: '800', lineHeight: 40 },
  heroSubtitle: { fontSize: 16, lineHeight: 24 },
  card: { borderRadius: 20, padding: 24, gap: 14 },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  cardSub: { fontSize: 14, lineHeight: 20 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1 },
  submitButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  successBox: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  successEmoji: { fontSize: 40 },
  successTitle: { fontSize: 20, fontWeight: '700' },
  successSub: { fontSize: 14, textAlign: 'center' },
  grid: { gap: 16 },
  gridCard: { borderRadius: 16, padding: 20, gap: 8 },
  gridEmoji: { fontSize: 28 },
  gridTitle: { fontSize: 17, fontWeight: '700' },
  gridSub: { fontSize: 14, lineHeight: 20 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 16 },
});
