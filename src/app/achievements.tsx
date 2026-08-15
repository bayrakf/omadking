import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import { Screen, Card, Txt, Eyebrow, Enter, Bar, useTheme, PageHeader, SegmentedControl } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { useLang } from '@/components/lang';
import { loadProfileOrDefault, loadFastLog, loadWeightLog, loadIntakeLog, isPremium, currentStreak } from '@/lib/store';
import { effectiveMaintenance } from '@/lib/energy';
import { dailyTargets } from '@/lib/nutrition';
import { evaluateAchievements, type AchievementBadge } from '@/lib/achievements';

export default function AchievementsScreen() {
  const c = useTheme();
  const { t } = useLang();

  const [category, setCategory] = useState<string>('all');
  const [badges, setBadges] = useState<AchievementBadge[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);

  const refresh = useCallback(async () => {
    const [p, fl, weights, intake, prem] = await Promise.all([
      loadProfileOrDefault(),
      loadFastLog(),
      loadWeightLog(),
      loadIntakeLog(),
      isPremium(),
    ]);

    const streak = currentStreak(fl);
    const measured = effectiveMaintenance(intake, weights, dailyTargets(p, null).maintenance_kcal, prem);
    const hasMeasured = measured !== undefined && measured !== dailyTargets(p, null).maintenance_kcal;

    const list = evaluateAchievements({
      streak,
      fastLog: fl,
      weighInCount: weights.length,
      workoutsLogged: fl.length > 0 ? Math.floor(fl.length / 2) : 0, // estimate from fast activity
      measuredMaintenance: hasMeasured,
    });

    setBadges(list);
    setUnlockedCount(list.filter((b) => b.unlocked).length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh().then(() => active);
      return () => { active = false; };
    }, [refresh])
  );

  const filtered = category === 'all' ? badges : badges.filter((b) => b.category === category);
  const totalRatio = badges.length > 0 ? (unlockedCount / badges.length) * 100 : 0;

  return (
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          back
          eyebrow="OMAD Trophäen"
          title={t('achievements.title')}
          sub={t('achievements.sub')}
        />

        {/* Hero Progress Banner */}
        <Card style={[s.heroCard, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
          <View style={s.heroHead}>
            <View style={[s.trophyCircle, { backgroundColor: c.goldWash }]}>
              <Icon name="crown" size={24} color={c.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: Space.md }}>
              <Txt variant="subheading" style={{ fontSize: 18, fontWeight: '800' }}>
                {unlockedCount} von {badges.length} freigeschaltet
              </Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                {Math.round(totalRatio)}% aller Meilensteine erreicht
              </Txt>
            </View>
          </View>
          <View style={{ marginTop: Space.base }}>
            <Bar pct={totalRatio} color={c.gold} />
          </View>
        </Card>

        {/* Category Filters */}
        <SegmentedControl
          selected={category}
          onSelect={setCategory}
          values={[
            { id: 'all', label: 'Alle' },
            { id: 'streak', label: 'Serie' },
            { id: 'fasting', label: 'Fasten' },
            { id: 'body', label: 'Körper' },
            { id: 'workout', label: 'Training' },
          ]}
          style={{ marginBottom: Space.base }}
        />
      </Enter>

      {/* Badges Grid */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={s.grid}>
          {filtered.map((b, index) => {
            return (
              <Enter key={b.id} index={index + 1} style={s.tileWrap}>
                <Card
                  style={[
                    s.tile,
                    {
                      borderColor: b.unlocked ? b.color : c.line,
                      backgroundColor: b.unlocked ? c.surfaceElevated ?? c.surface : c.surface,
                      opacity: b.unlocked ? 1 : 0.7,
                    },
                  ]}
                >
                  <View style={s.tileTop}>
                    <View
                      style={[
                        s.badgeIcon,
                        {
                          backgroundColor: b.unlocked ? b.wash : c.well,
                          borderColor: b.unlocked ? b.color : c.line,
                        },
                      ]}
                    >
                      <Icon
                        name={b.icon as IconName}
                        size={22}
                        color={b.unlocked ? b.color : c.textFaint}
                      />
                    </View>
                    <View
                      style={[
                        s.statusPill,
                        {
                          backgroundColor: b.unlocked ? b.wash : c.well,
                          borderColor: b.unlocked ? b.color : c.line,
                        },
                      ]}
                    >
                      <Txt
                        variant="data"
                        color={b.unlocked ? b.color : c.textFaint}
                        style={{ fontSize: 10, fontWeight: '700' }}
                      >
                        {b.unlocked ? 'Freigeschaltet' : 'Gesperrt'}
                      </Txt>
                    </View>
                  </View>

                  <Txt
                    variant="subheading"
                    style={{ fontSize: 15, fontWeight: '700', marginTop: Space.sm }}
                  >
                    {t(b.titleKey as any)}
                  </Txt>
                  <Txt variant="small" color={c.textDim} style={{ fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                    {t(b.descKey as any)}
                  </Txt>

                  <View style={{ marginTop: Space.md }}>
                    <View style={s.progressLabelRow}>
                      <Eyebrow color={c.textFaint}>Fortschritt</Eyebrow>
                      <Txt variant="data" color={b.unlocked ? b.color : c.textDim} style={{ fontSize: 11 }}>
                        {b.progressLabel}
                      </Txt>
                    </View>
                    <Bar pct={b.progress * 100} color={b.unlocked ? b.color : c.lineStrong} />
                  </View>
                </Card>
              </Enter>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  heroCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trophyCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Space.xs,
  },
  tileWrap: {
    width: '50%',
    paddingHorizontal: Space.xs,
    marginBottom: Space.sm,
  },
  tile: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});
