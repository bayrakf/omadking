import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import { Screen, Card, Txt, Eyebrow, Enter, Button, Tap, Divider, Notice, useTheme } from '@/components/ui';
import { Icon } from '@/components/icons';
import { getOfferings, isBillingAvailable, purchase, restore, type Package } from '@/lib/purchases';
import { PREMIUM_CLAIMS } from '@/lib/offer';
import { FREE_PLANS_PER_WEEK } from '@/lib/store';

/**
 * The offer lives in src/lib/offer.ts, not here.
 *
 * The list that used to sit in this file sold three things the free plan
 * already does. A screen cannot check itself; a pure module with a self-check
 * can, and does — see `overpromises()`.
 */
const FEATURES = PREMIUM_CLAIMS;

export default function PaywallScreen() {
  const c = useTheme();
  const router = useRouter();

  const [packages, setPackages] = useState<Package[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const billing = isBillingAvailable();

  useEffect(() => {
    getOfferings().then((pkgs) => {
      setPackages(pkgs);
      // Default to annual when offered — it is the better value.
      setSelected(pkgs.find((p) => p.period === 'annual')?.identifier ?? pkgs[0]?.identifier ?? null);
    });
  }, []);

  const subscribe = async () => {
    const pkg = packages.find((p) => p.identifier === selected);
    if (!pkg) return setStatus('Subscriptions are not available yet. The free plan keeps working.');
    setBusy(true); setStatus(null);
    const res = await purchase(pkg);
    setBusy(false);
    if (res.ok) router.back();
    else if (!res.cancelled) setStatus(res.message ?? 'Purchase failed.');
  };

  const restorePurchases = async () => {
    setBusy(true); setStatus(null);
    const res = await restore();
    setBusy(false);
    if (res.ok) router.back();
    else setStatus(res.message ?? 'Nothing to restore.');
  };

  return (
    <Screen tabBar={false} edges={['top', 'bottom']}>
      <Enter index={0}>
        <View style={s.top}>
          <Tap onPress={() => router.back()} accessibilityLabel="Close">
            <View style={s.close}><Icon name="close" size={20} color={c.textDim} /></View>
          </Tap>
        </View>
      </Enter>

      <Enter index={1}>
        <View style={s.hero}>
          <Icon name="crown" size={30} color={c.ember} />
          <Txt variant="display" style={{ marginTop: Space.lg, fontSize: 34 }}>Premium</Txt>
          <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
            The free plan gives you {FREE_PLANS_PER_WEEK} meal plans a week. Premium removes the cap.
          </Txt>
        </View>
      </Enter>

      <Enter index={2}>
        <Card style={{ marginTop: Space.xl, paddingVertical: Space.sm }}>
          {FEATURES.map(({ title, body }, i) => (
            <View key={title}>
              {i > 0 && <Divider />}
              <View style={s.feature}>
                <Icon name="check" size={16} color={c.accent} strokeWidth={2.2} />
                <View style={{ flex: 1, marginLeft: Space.md }}>
                  <Txt variant="bodyMedium">{title}</Txt>
                  <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>{body}</Txt>
                </View>
              </View>
            </View>
          ))}
        </Card>
      </Enter>

      <Enter index={3}>
        {packages.length > 0 ? (
          <View style={s.prices}>
            {packages.map((pkg) => {
              const on = selected === pkg.identifier;
              return (
                <Tap
                  key={pkg.identifier}
                  onPress={() => setSelected(pkg.identifier)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={pkg.period}
                  style={s.priceWrap}
                >
                  <View style={[s.price, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentWash : c.surface }]}>
                    {pkg.period === 'annual' && <Eyebrow color={c.ember}>Best value</Eyebrow>}
                    <Txt variant="bodyMedium" color={c.textDim} style={{ marginTop: 4 }}>
                      {pkg.period === 'annual' ? 'Annual' : pkg.period === 'monthly' ? 'Monthly' : pkg.identifier}
                    </Txt>
                    {/* Prices come from the store, localised — never hardcoded. */}
                    <Txt variant="heading" style={{ marginTop: 6 }}>{pkg.priceString}</Txt>
                  </View>
                </Tap>
              );
            })}
          </View>
        ) : (
          <Card style={{ marginTop: Space.lg }}>
            <Txt variant="small" color={c.textDim} style={{ textAlign: 'center' }}>
              {billing
                ? 'Loading subscription options…'
                : 'Subscriptions are only available in the iOS and Android apps. Everything on the free plan keeps working here.'}
            </Txt>
          </Card>
        )}
      </Enter>

      <Enter index={4}>
        <View style={{ marginTop: Space.lg }}>
          {busy ? (
            <View style={[s.busy, { backgroundColor: c.well }]}><ActivityIndicator color={c.accent} /></View>
          ) : (
            <Button
              label={packages.length === 0 ? 'Unavailable' : 'Subscribe'}
              onPress={subscribe}
              disabled={packages.length === 0}
            />
          )}
          {status && <Notice tone="error">{status}</Notice>}

          {billing && (
            <Tap onPress={restorePurchases} disabled={busy} accessibilityLabel="Restore purchases">
              <View style={s.restore}>
                <Txt variant="small" color={c.textDim}>Restore purchases</Txt>
              </View>
            </Tap>
          )}

          <Txt variant="small" color={c.textFaint} style={s.legal}>
            Subscriptions renew until cancelled. Manage or cancel any time in your App Store or Google Play account.
          </Txt>
        </View>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: Space.lg, paddingHorizontal: Space.base },
  feature: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Space.base },
  prices: { flexDirection: 'row', marginTop: Space.lg, marginRight: -Space.md },
  priceWrap: { flex: 1, marginRight: Space.md },
  price: { borderRadius: Radius.md, borderWidth: 1.5, padding: Space.base, alignItems: 'center' },
  busy: { height: 54, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  restore: { alignItems: 'center', paddingVertical: Space.base, marginTop: Space.sm },
  legal: { textAlign: 'center', marginTop: Space.md },
});
