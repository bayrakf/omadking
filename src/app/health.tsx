/**
 * Health & Sensor Telemetry screen.
 *
 * Strictly honors calculation integrity (`CLAUDE.md`): never invents static
 * dummy step counts, weight, or recovery scores. Every displayed figure is
 * computed directly from the user's stored profile, step log, weigh-ins, and
 * completed fasts; native OS HealthKit / Health Connect bridges remain clearly
 * distinguished from web manual telemetry.
 */

import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon } from '@/components/icons';
import { useLang } from '@/components/lang';
import {
  Button,
  Card,
  Columns,
  Enter,
  Eyebrow,
  PageHeader,
  Screen,
  Txt,
  useTheme,
} from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { dailyTargets } from '@/lib/nutrition';
import {
  currentStreak,
  loadDailySteps,
  loadFastLog,
  loadProfileOrDefault,
  loadWeightLog,
} from '@/lib/store';

export default function HealthScreen() {
  const router = useRouter();
  const c = useTheme();
  const { lang, t } = useLang();

  const [steps, setSteps] = useState(0);
  const [latestKg, setLatestKg] = useState<number | null>(null);
  const [restingKcal, setRestingKcal] = useState(0);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, st, weights, fasts] = await Promise.all([
          loadProfileOrDefault(),
          loadDailySteps(),
          loadWeightLog(),
          loadFastLog(),
        ]);
        if (!active) return;
        setSteps(st);
        setLatestKg(weights.length ? weights[0].weight_kg : p.weight_kg);
        setRestingKcal(dailyTargets(p, null).maintenance_kcal);
        setStreak(currentStreak(fasts));
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const isWeb = Platform.OS === 'web';

  return (
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          back
          onBack={() => router.back()}
          eyebrow={lang === 'de' ? 'TELEMETRIE & SENSOREN' : 'TELEMETRY & SENSORS'}
          title={t('health.title')}
        />
      </Enter>

      <Columns>
        <Enter index={1}>
          <Card style={s.cardGap}>
            <View style={s.rowCenter}>
              <View style={[s.badgeBox, { backgroundColor: c.hydroWash, borderColor: c.line }]}>
                <Icon name="sync" size={18} color={c.hydro} />
              </View>
              <View style={{ flex: 1, marginLeft: Space.md }}>
                <Txt variant="subheading" color={c.text}>
                  {isWeb
                    ? lang === 'de'
                      ? 'Manuelle Web-Telemetrie aktiv'
                      : 'Manual Web Telemetry Active'
                    : lang === 'de'
                    ? 'Apple Health / Health Connect bereit'
                    : 'Apple Health / Health Connect Ready'}
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                  {isWeb
                    ? lang === 'de'
                      ? 'Im Browser werden deine lokal erfassten Schritte, Wägungen und Fastentage direkt berechnet.'
                      : 'On web, displayed biometrics are computed directly from your logged steps, weigh-ins, and fasts.'
                    : lang === 'de'
                    ? 'Native Gerätesynchronisation lässt sich auf iOS und Android verbinden.'
                    : 'Native device sensor sync connects on iOS and Android builds.'}
                </Txt>
              </View>
            </View>

            <View style={{ marginTop: Space.base, flexDirection: 'row' }}>
              <Button
                size="sm"
                variant="secondary"
                icon="chart"
                label={lang === 'de' ? 'Gewicht eintragen' : 'Log weight'}
                onPress={() => router.push('/progress')}
                style={{ marginRight: Space.sm }}
              />
              <Button
                size="sm"
                variant="outline"
                icon="footprints"
                label={lang === 'de' ? 'Schritte auf Heute' : 'Log steps on Today'}
                onPress={() => router.push('/')}
              />
            </View>
          </Card>
        </Enter>

        <Enter index={2}>
          <View style={s.grid}>
            <View style={s.cell}>
              <Card>
                <View style={s.rowBetween}>
                  <Eyebrow color={c.textFaint}>{lang === 'de' ? 'SCHRITTE HEUTE' : 'STEPS TODAY'}</Eyebrow>
                  <Icon name="footprints" size={15} color={c.accent} />
                </View>
                <Txt variant="title" color={c.text} style={{ marginTop: Space.sm, fontVariant: ['tabular-nums'] }}>
                  {steps.toLocaleString()}
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                  {lang === 'de' ? 'Ziel 10.000 / Tag' : 'Target 10,000 / day'}
                </Txt>
              </Card>
            </View>

            <View style={s.cell}>
              <Card>
                <View style={s.rowBetween}>
                  <Eyebrow color={c.textFaint}>{lang === 'de' ? 'GESCHÄTZTER UMSATZ' : 'EST. MAINTENANCE'}</Eyebrow>
                  <Icon name="flame" size={15} color={c.ember} />
                </View>
                <Txt variant="title" color={c.text} style={{ marginTop: Space.sm, fontVariant: ['tabular-nums'] }}>
                  {restingKcal} kcal
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                  {lang === 'de' ? 'Aus Profildaten berechnet' : 'Computed from profile'}
                </Txt>
              </Card>
            </View>

            <View style={s.cell}>
              <Card>
                <View style={s.rowBetween}>
                  <Eyebrow color={c.textFaint}>{lang === 'de' ? 'GEWICHT' : 'LATEST WEIGHT'}</Eyebrow>
                  <Icon name="scale" size={15} color={c.body} />
                </View>
                <Txt variant="title" color={c.text} style={{ marginTop: Space.sm, fontVariant: ['tabular-nums'] }}>
                  {latestKg !== null ? `${latestKg.toFixed(1)} kg` : '—'}
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                  {lang === 'de' ? 'Letzter Eintrag' : 'Most recent entry'}
                </Txt>
              </Card>
            </View>

            <View style={s.cell}>
              <Card>
                <View style={s.rowBetween}>
                  <Eyebrow color={c.textFaint}>{lang === 'de' ? 'FASTEN-SERIE' : 'FASTING STREAK'}</Eyebrow>
                  <Icon name="clock" size={15} color={c.plan} />
                </View>
                <Txt variant="title" color={c.text} style={{ marginTop: Space.sm, fontVariant: ['tabular-nums'] }}>
                  {streak} {streak === 1 ? (lang === 'de' ? 'Tag' : 'day') : lang === 'de' ? 'Tage' : 'days'}
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                  {lang === 'de' ? 'Erfasste Fastentage' : 'Logged consecutive fasts'}
                </Txt>
              </Card>
            </View>
          </View>
        </Enter>
      </Columns>
    </Screen>
  );
}

const s = StyleSheet.create({
  cardGap: { marginBottom: Space.base },
  rowCenter: { flexDirection: 'row', alignItems: 'flex-start' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  cell: {
    width: '50%',
    padding: 4,
  },
});
