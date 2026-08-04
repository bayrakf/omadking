import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, MaxContentWidth } from '@/constants/theme';
import {
  dailyTargets,
  fastingState,
  formatCountdown,
  DEFAULT_PROFILE,
  type UserProfile,
  type FastingState,
} from '@/lib/nutrition';
import {
  loadProfileOrDefault,
  loadHydration,
  saveHydration,
  loadFastLog,
  markFastComplete,
  currentStreak,
  loadLastPlan,
  todayISO,
  type Hydration,
} from '@/lib/store';
import type { MealPlan } from '@/lib/ai';

const WATER_TARGET_ML = 3500;

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  // Nothing time- or theme-dependent renders until after mount, otherwise the
  // static web build hydrates with a different clock than the server rendered.
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [fast, setFast] = useState<FastingState | null>(null);
  const [hydration, setHydration] = useState<Hydration>({ date: todayISO(), ml: 0, electrolytes: false });
  const [streak, setStreak] = useState(0);
  const [fastLogged, setFastLogged] = useState(false);
  const [todaysPlan, setTodaysPlan] = useState<MealPlan | null>(null);
  const [greeting, setGreeting] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    setDateStr(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
    setMounted(true);
  }, []);

  // Re-read on focus so edits made in Profile or Planner show up immediately.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, h, log, plan] = await Promise.all([
          loadProfileOrDefault(),
          loadHydration(),
          loadFastLog(),
          loadLastPlan<MealPlan>(),
        ]);
        if (!active) return;
        setProfile(p);
        setHydration(h);
        setStreak(currentStreak(log));
        setFastLogged(log.includes(todayISO()));
        setTodaysPlan(plan?.date === todayISO() ? plan : null);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    const tick = () => setFast(fastingState(profile));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [profile]);

  if (!mounted || !fast) return null;

  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { background: bg, card, primary, accent, text: txt, textSecondary: sub, backgroundElement: el } = colors;

  // Today's plan wins over the baseline estimate — otherwise the dashboard and
  // the planner quote different targets for the same day.
  const baseline = dailyTargets(profile, null);
  const targets = todaysPlan
    ? { kcal: todaysPlan.total_kcal, protein_g: todaysPlan.protein_g }
    : { kcal: baseline.kcal, protein_g: baseline.protein_g };

  const addWater = async (ml: number) => {
    const next = { ...hydration, ml: Math.min(6000, hydration.ml + ml) };
    setHydration(next);
    await saveHydration(next);
  };

  const toggleSalt = async () => {
    const next = { ...hydration, electrolytes: !hydration.electrolytes };
    setHydration(next);
    await saveHydration(next);
  };

  const logFast = async () => {
    const log = await markFastComplete();
    setStreak(currentStreak(log));
    setFastLogged(true);
  };

  const waterPct = Math.min(100, (hydration.ml / WATER_TARGET_ML) * 100);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.greeting, { color: txt }]}>{greeting}</Text>
        <Text style={[s.date, { color: sub }]}>{dateStr}</Text>

        {/* Fasting timer — the reason people open this app */}
        <View style={[s.card, s.timerCard, { backgroundColor: card }]}>
          <View style={s.rowBetween}>
            <Text style={[s.cardTitle, { color: txt }]}>Fasting Timer</Text>
            <View style={[s.pill, { backgroundColor: el }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: fast.isEating ? colors.success : accent }}>
                {fast.isEating ? '🟢 Eating window' : '🔴 Fasting'}
              </Text>
            </View>
          </View>

          <Text style={[s.timerValue, { color: fast.isEating ? colors.success : accent }]}>
            {formatCountdown(fast.remainingMs)}
          </Text>
          <Text style={[s.timerCaption, { color: sub }]}>
            {fast.isEating
              ? `left in your window — closes at ${fast.windowEnd}`
              : `until your window opens at ${fast.windowStart}`}
          </Text>

          <View style={[s.bar, { backgroundColor: el }]}>
            <View
              style={[
                s.barFill,
                { backgroundColor: fast.isEating ? colors.success : accent, width: `${fast.progressPct}%` },
              ]}
            />
          </View>
          <Text style={[s.barCaption, { color: sub }]}>
            {fast.progressPct.toFixed(0)}% through your {fast.isEating ? `${profile.omad_window_hours}h window` : `${fast.fastingHours}h fast`}
          </Text>
        </View>

        {/* Targets */}
        <View style={s.statRow}>
          {(
            [
              [String(targets.kcal), 'Target kcal', primary],
              [`${targets.protein_g}g`, 'Protein', primary],
              [`${fast.fastingHours}h`, 'Daily fast', accent],
            ] as const
          ).map(([val, lbl, color]) => (
            <View key={lbl} style={[s.stat, { backgroundColor: card }]}>
              <Text style={[s.statValue, { color }]}>{val}</Text>
              <Text style={[s.statLabel, { color: sub }]}>{lbl}</Text>
            </View>
          ))}
        </View>
        {todaysPlan ? (
          <Text style={[s.note, { color: sub }]}>
            From today's plan{todaysPlan.training_burn_kcal > 0 ? ` — includes ${todaysPlan.training_burn_kcal} kcal burned training` : ''}.
          </Text>
        ) : (
          <Text style={[s.note, { color: sub }]}>Rest-day baseline. Generate a plan to fuel a workout.</Text>
        )}

        {/* Streak — counted from fasts you actually confirmed */}
        <View style={[s.card, { backgroundColor: card, borderColor: 'rgba(245,158,11,0.35)', borderWidth: 1 }]}>
          <View style={s.rowBetween}>
            <View style={s.flex1}>
              <Text style={[s.cardTitle, { color: accent }]}>
                {streak > 0 ? `🔥 ${streak} day streak` : 'Start your streak'}
              </Text>
              <Text style={[s.cardBody, { color: sub }]}>
                {streak > 0
                  ? `${streak} consecutive ${streak === 1 ? 'day' : 'days'} completed.`
                  : 'Log your first completed fast to begin.'}
              </Text>
            </View>
            <Pressable
              onPress={logFast}
              disabled={fastLogged}
              style={[s.smallBtn, { backgroundColor: fastLogged ? el : accent }]}
              accessibilityRole="button"
            >
              <Text style={{ color: fastLogged ? sub : '#1A1A2E', fontWeight: '800', fontSize: 13 }}>
                {fastLogged ? '✅ Logged' : 'Log today'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Hydration — resets at midnight */}
        <View style={[s.card, { backgroundColor: card }]}>
          <View style={s.rowBetween}>
            <Text style={[s.cardTitle, { color: txt }]}>💧 Hydration</Text>
            <Text style={{ color: primary, fontWeight: '800', fontSize: 14 }}>
              {(hydration.ml / 1000).toFixed(1)} / {(WATER_TARGET_ML / 1000).toFixed(1)} L
            </Text>
          </View>
          <View style={[s.bar, { backgroundColor: el }]}>
            <View style={[s.barFill, { backgroundColor: '#06b6d4', width: `${waterPct}%` }]} />
          </View>
          <View style={s.btnRow}>
            {[250, 500].map((n) => (
              <Pressable
                key={n}
                style={[s.waterBtn, { backgroundColor: el }]}
                onPress={() => addWater(n)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${n} millilitres of water`}
              >
                <Text style={{ color: txt, fontWeight: '700', fontSize: 13 }}>+{n}ml</Text>
              </Pressable>
            ))}
            <Pressable
              style={[s.waterBtn, { backgroundColor: hydration.electrolytes ? 'rgba(245,158,11,0.2)' : el }]}
              onPress={toggleSalt}
              accessibilityRole="button"
            >
              <Text style={{ color: hydration.electrolytes ? accent : txt, fontWeight: '700', fontSize: 13 }}>
                {hydration.electrolytes ? '✅ Salt' : '+ Salt 🧂'}
              </Text>
            </Pressable>
          </View>
          {!hydration.electrolytes && !fast.isEating && (
            <Text style={[s.note, { color: sub, marginTop: 8 }]}>
              Plain water through a long fast dilutes sodium. Add a pinch of salt.
            </Text>
          )}
        </View>

        {/* Actions */}
        <Pressable
          style={[s.primaryBtn, { backgroundColor: primary }]}
          onPress={() => router.push('/planner')}
          accessibilityRole="button"
        >
          <Text style={s.primaryBtnText}>🍽️ Generate today's meal plan</Text>
        </Pressable>

        {(
          [
            ['/grocery', '🛒', 'Grocery list', 'Ingredients from your latest plan', accent],
            ['/progress', '📈', 'Progress', 'Log weight and track the trend', primary],
            ['/chat', '🤖', 'AI coach', 'Fasting, electrolytes and fuelling', primary],
          ] as const
        ).map(([href, emoji, title, desc, color]) => (
          <Pressable
            key={href}
            style={[s.banner, { backgroundColor: card, borderColor: color + '55' }]}
            onPress={() => router.push(href)}
            accessibilityRole="button"
          >
            <Text style={s.bannerEmoji}>{emoji}</Text>
            <View style={s.flex1}>
              <Text style={[s.cardTitle, { color: txt }]}>{title}</Text>
              <Text style={[s.cardBody, { color: sub }]}>{desc}</Text>
            </View>
            <Text style={{ color, fontWeight: '800', fontSize: 18 }}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 130, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  flex1: { flex: 1 },
  greeting: { fontSize: 28, fontWeight: '900', marginBottom: 2 },
  date: { fontSize: 14, marginBottom: 18 },

  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  timerCard: { paddingVertical: 20 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  note: { fontSize: 12, lineHeight: 17, marginBottom: 12 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },

  timerValue: { fontSize: 34, fontWeight: '900', textAlign: 'center', marginTop: 14, letterSpacing: -0.5 },
  timerCaption: { fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 14 },

  bar: { height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 10 },
  barFill: { height: '100%', borderRadius: 5 },
  barCaption: { fontSize: 12, textAlign: 'right', marginTop: 6 },

  // Negative margin cancels the trailing child's gutter — `gap` crashes this
  // RN-Web version, so spacing is done with margins throughout.
  statRow: { flexDirection: 'row', marginBottom: 8, marginRight: -10 },
  stat: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', marginRight: 10 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 3 },

  smallBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginLeft: 12 },
  btnRow: { flexDirection: 'row', marginTop: 12, marginRight: -8 },
  waterBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginRight: 8 },

  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  bannerEmoji: { fontSize: 24, marginRight: 12 },
});
