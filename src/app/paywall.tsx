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
/**
 * offer.ts orders the claims as an argument: the measurement first, the lifted
 * cap last, "because it is a limit being lifted, not a capability being gained".
 * Rendering all ten at equal weight threw that ordering away — a person deciding
 * whether to pay reads two or three, and the two that matter were sitting in a
 * list of ten identical rows.
 *
 * Split here rather than in offer.ts: the argument and the inventory are the
 * same data, and the module's self-check still sees every claim.
 */
const LEAD = PREMIUM_CLAIMS.slice(0, 2);
const REST = PREMIUM_CLAIMS.slice(2);

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
          <Icon name="crown" size={30} color={c.accent} />
          <Txt variant="display" style={{ marginTop: Space.lg, fontSize: 34 }}>Premium</Txt>
          <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
            Your maintenance, measured from your own eating and weigh-ins instead of assumed from a
            formula — and a daily target that follows it as it moves.
          </Txt>
          {/* Still said, just not first. What free gives you is a fact a buyer
              needs; it is not the reason anyone pays. */}
          <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
            The free plan gives you {FREE_PLANS_PER_WEEK} meal plans a week. Premium removes the cap.
          </Txt>
        </View>
      </Enter>

      <Enter index={2}>
        <Card style={{ marginTop: Space.xl, paddingVertical: Space.sm }}>
          {LEAD.map(({ title, body }, i) => (
            <View key={title}>
              {i > 0 && <Divider />}
              <View style={s.feature}>
                <Icon name="check" size={16} color={c.accent} strokeWidth={2.2} />
                <View style={{ flex: 1, marginLeft: Space.md }}>
                  <Txt variant="subheading">{title}</Txt>
                  <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>{body}</Txt>
                </View>
              </View>
            </View>
          ))}
        </Card>
      </Enter>

      <Enter index={3}>
        <Eyebrow style={{ marginTop: Space.xl, marginBottom: Space.md, marginLeft: Space.xs }}>
          Also included
        </Eyebrow>
        <Card style={{ paddingVertical: Space.sm }}>
          {REST.map(({ title, body }, i) => (
            <View key={title}>
              {i > 0 && <Divider />}
              <View style={s.feature}>
                <Icon name="check" size={16} color={c.textFaint} strokeWidth={2.2} />
                <View style={{ flex: 1, marginLeft: Space.md }}>
                  <Txt variant="bodyMedium">{title}</Txt>
                  <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>{body}</Txt>
                </View>
              </View>
            </View>
          ))}
        </Card>
      </Enter>

      <Enter index={4}>
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
                    {pkg.period === 'annual' && <Eyebrow color={c.accent}>Best value</Eyebrow>}
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
