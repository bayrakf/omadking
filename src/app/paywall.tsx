import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaywallScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // RevenueCat Purchase call (simulated fallback for dev)
      await AsyncStorage.setItem('user_premium', 'true');
      Alert.alert('Welcome to Premium! 🎉', 'You now have unlimited AI meal plans and features.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Purchase Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      Alert.alert('Restored', 'No previous subscription found.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Close */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={[styles.closeTxt, { color: colors.textSecondary }]}>✕</Text>
          </Pressable>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>👑</Text>
          <Text style={[styles.title, { color: colors.text }]}>Unlock OMAD Premium</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Fuel your fasting & peak workout performance with unlimited AI plans.
          </Text>
        </View>

        {/* Features List */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.featureRow}>
            <Text style={styles.check}>✨</Text>
            <Text style={[styles.featureTxt, { color: colors.text }]}>Unlimited AI Meal Plans & Recipes</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.check}>⚡</Text>
            <Text style={[styles.featureTxt, { color: colors.text }]}>Workout-Specific Macro & Timing Calculations</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.check}>🔥</Text>
            <Text style={[styles.featureTxt, { color: colors.text }]}>Meal-Prep Reheat Instructions</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.check}>💬</Text>
            <Text style={[styles.featureTxt, { color: colors.text }]}>AI Nutritionist Coaching Chat</Text>
          </View>
        </View>

        {/* Pricing Cards */}
        <View style={styles.pricingRow}>
          {/* Monthly */}
          <Pressable
            onPress={() => setSelectedPlan('monthly')}
            style={[
              styles.priceCard,
              {
                backgroundColor: colors.card,
                borderColor: selectedPlan === 'monthly' ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={[styles.planName, { color: colors.text }]}>Monthly</Text>
            <Text style={[styles.planPrice, { color: colors.primary }]}>€6.99</Text>
            <Text style={[styles.planSub, { color: colors.textSecondary }]}>/ month</Text>
          </Pressable>

          {/* Yearly */}
          <Pressable
            onPress={() => setSelectedPlan('yearly')}
            style={[
              styles.priceCard,
              {
                backgroundColor: colors.card,
                borderColor: selectedPlan === 'yearly' ? colors.primary : 'transparent',
              },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeTxt}>SAVE 30%</Text>
            </View>
            <Text style={[styles.planName, { color: colors.text }]}>Annual</Text>
            <Text style={[styles.planPrice, { color: colors.primary }]}>€58.99</Text>
            <Text style={[styles.planSub, { color: colors.textSecondary }]}>€4.91 / mo</Text>
          </Pressable>
        </View>

        {/* Action Button */}
        <Pressable
          disabled={loading}
          onPress={handleSubscribe}
          style={({ pressed }) => [
            styles.subBtn,
            { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.subBtnTxt}>Start 7-Day Free Trial</Text>
          )}
        </Pressable>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Pressable onPress={handleRestore}>
            <Text style={[styles.footerTxt, { color: colors.textSecondary }]}>Restore Purchases</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, rowGap: 20, columnGap: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  closeBtn: { padding: 8 },
  closeTxt: { fontSize: 20, fontWeight: '700' },
  hero: { alignItems: 'center', rowGap: 8, columnGap: 8 },
  heroEmoji: { fontSize: 48 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  card: { borderRadius: 16, padding: 20, rowGap: 14, columnGap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', rowGap: 12, columnGap: 12 },
  check: { fontSize: 18 },
  featureTxt: { fontSize: 15, fontWeight: '600', flex: 1 },
  pricingRow: { flexDirection: 'row', rowGap: 12, columnGap: 12 },
  priceCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    rowGap: 4, columnGap: 4,
    borderWidth: 2,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: '#000000' },
  planName: { fontSize: 14, fontWeight: '600' },
  planPrice: { fontSize: 24, fontWeight: '800' },
  planSub: { fontSize: 12 },
  subBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  subBtnTxt: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  footerRow: { alignItems: 'center', marginTop: 8 },
  footerTxt: { fontSize: 13, textDecorationLine: 'underline' },
});
