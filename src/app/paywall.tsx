import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Colors, MaxContentWidth } from '@/constants/theme';
import { getOfferings, isBillingAvailable, purchase, restore, type Package } from '@/lib/purchases';
import { FREE_PLANS_PER_WEEK } from '@/lib/store';

const FEATURES = [
  ['✨', 'Unlimited AI meal plans and recipes'],
  ['⚡', 'Macros and timing tuned to each session'],
  ['🔥', 'Meal-prep and reheat instructions'],
  ['💬', 'Unlimited AI nutrition coaching'],
] as const;

export default function PaywallScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  const billingAvailable = isBillingAvailable();

  useEffect(() => {
    setMounted(true);
    getOfferings().then((pkgs) => {
      setPackages(pkgs);
      // Default to annual when offered — it's the better value.
      setSelected(pkgs.find((p) => p.period === 'annual')?.identifier ?? pkgs[0]?.identifier ?? null);
    });
  }, []);

  if (!mounted) return null;

  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const handleSubscribe = async () => {
    const pkg = packages.find((p) => p.identifier === selected);
    if (!pkg) {
      setStatus({
        text: 'Subscriptions are not available yet. You can keep using the free plan.',
        ok: false,
      });
      return;
    }
    setBusy(true);
    setStatus(null);
    const result = await purchase(pkg);
    setBusy(false);
    if (result.ok) {
      router.back();
    } else if (!result.cancelled) {
      setStatus({ text: result.message ?? 'Purchase failed.', ok: false });
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setStatus(null);
    const result = await restore();
    setBusy(false);
    if (result.ok) router.back();
    else setStatus({ text: result.message ?? 'Nothing to restore.', ok: false });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.closeTxt, { color: colors.textSecondary }]}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>👑</Text>
          <Text style={[styles.title, { color: colors.text }]}>OMADCoach Premium</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            The free plan gives you {FREE_PLANS_PER_WEEK} meal plans a week. Premium removes the limit.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {FEATURES.map(([icon, text]) => (
            <View key={text} style={styles.featureRow}>
              <Text style={styles.check}>{icon}</Text>
              <Text style={[styles.featureTxt, { color: colors.text }]}>{text}</Text>
            </View>
          ))}
        </View>

        {packages.length > 0 ? (
          <View style={styles.pricingRow}>
            {packages.map((pkg) => {
              const isSelected = selected === pkg.identifier;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => setSelected(pkg.identifier)}
                  style={[
                    styles.priceCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.primary : 'transparent',
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  {pkg.period === 'annual' && (
                    <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.badgeTxt}>BEST VALUE</Text>
                    </View>
                  )}
                  <Text style={[styles.planName, { color: colors.text }]}>
                    {pkg.period === 'annual' ? 'Annual' : pkg.period === 'monthly' ? 'Monthly' : pkg.identifier}
                  </Text>
                  {/* Prices come from the store, localised — never hardcoded. */}
                  <Text style={[styles.planPrice, { color: colors.primary }]}>{pkg.priceString}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.noticeCard, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              {billingAvailable
                ? 'Loading subscription options…'
                : 'Subscriptions are only available in the iOS and Android apps. Everything on the free plan keeps working here.'}
            </Text>
          </View>
        )}

        <Pressable
          disabled={busy || packages.length === 0}
          onPress={handleSubscribe}
          style={({ pressed }) => [
            styles.subBtn,
            {
              backgroundColor: packages.length === 0 ? colors.backgroundElement : colors.primary,
              opacity: pressed || busy ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.subBtnTxt,
                { color: packages.length === 0 ? colors.textSecondary : '#FFFFFF' },
              ]}
            >
              {packages.length === 0 ? 'Unavailable' : 'Subscribe'}
            </Text>
          )}
        </Pressable>

        {status && (
          <Text style={[styles.status, { color: status.ok ? colors.success : colors.danger }]}>
            {status.text}
          </Text>
        )}

        {billingAvailable && (
          <Pressable onPress={handleRestore} disabled={busy} style={styles.footerRow} accessibilityRole="button">
            <Text style={[styles.footerTxt, { color: colors.textSecondary }]}>Restore purchases</Text>
          </Pressable>
        )}

        <Text style={[styles.legal, { color: colors.textSecondary }]}>
          Subscriptions renew automatically until cancelled. Manage or cancel any time in your App Store or Google
          Play account settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  closeBtn: { padding: 8, minWidth: 44, alignItems: 'flex-end' },
  closeTxt: { fontSize: 20, fontWeight: '700' },

  hero: { alignItems: 'center', marginBottom: 24 },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12, marginTop: 10 },

  card: { borderRadius: 16, padding: 20, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  check: { fontSize: 18, marginRight: 12 },
  featureTxt: { fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 21 },

  pricingRow: { flexDirection: 'row', marginRight: -12, marginBottom: 20 },
  priceCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    marginRight: 12,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: '#1A1A2E' },
  planName: { fontSize: 14, fontWeight: '600' },
  planPrice: { fontSize: 22, fontWeight: '800', marginTop: 6 },

  noticeCard: { borderRadius: 12, padding: 16, marginBottom: 20 },
  noticeText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },

  subBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  subBtnTxt: { fontSize: 17, fontWeight: '700' },
  status: { fontSize: 14, textAlign: 'center', marginTop: 14, lineHeight: 20 },

  footerRow: { alignItems: 'center', marginTop: 18, padding: 8 },
  footerTxt: { fontSize: 14, textDecorationLine: 'underline' },

  legal: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 20 },
});
