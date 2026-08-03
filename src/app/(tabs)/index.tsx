import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';

const DEFAULT_PROFILE = {
  weight_kg: 75,
  height_cm: 175,
  age: 30,
  sex: 'male',
  goal: 'performance',
  omad_window_start: '18:00',
  omad_window_hours: 1,
  default_training_time: '18:00',
  fitness_level: 'intermediate',
};

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [profile, setProfile] = useState<any>(DEFAULT_PROFILE);

  const now = new Date();
  const currentHour = now.getHours();
  let greeting = 'Good morning';
  if (currentHour >= 12 && currentHour < 17) greeting = 'Good afternoon';
  else if (currentHour >= 17) greeting = 'Good evening';

  const todayStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    AsyncStorage.getItem('onboarding_profile').then((stored) => {
      if (stored) {
        try { setProfile(JSON.parse(stored)); } catch (_) {}
      }
    });
  }, []);

  // Calculations
  const weightNum = Number(profile.weight_kg) || 75;
  const heightNum = Number(profile.height_cm) || 175;
  const ageNum = Number(profile.age) || 30;
  const sexVal = profile.sex || 'male';
  const goalVal = profile.goal || 'performance';
  const omadWindowHoursVal = Number(profile.omad_window_hours) || 1;
  const omadWindowStartVal = profile.omad_window_start || '18:00';

  let bmr = sexVal === 'female'
    ? 447.593 + 9.247 * weightNum + 3.098 * heightNum - 4.33 * ageNum
    : 88.362 + 13.397 * weightNum + 4.799 * heightNum - 5.677 * ageNum;

  const actMult = profile.fitness_level === 'advanced' ? 1.9 : profile.fitness_level === 'intermediate' ? 1.725 : 1.55;
  let kcal = Math.round(bmr * actMult);
  if (goalVal === 'weight_loss') kcal -= 500;
  if (goalVal === 'muscle_gain') kcal += 300;

  const protein = goalVal === 'weight_loss' ? Math.round(weightNum * 1.6)
    : goalVal === 'muscle_gain' ? Math.round(weightNum * 2.2)
    : Math.round(weightNum * 2.0);
  const fastingHours = 24 - omadWindowHoursVal;

  const bg = colors.background;
  const card = colors.card;
  const primary = colors.primary;
  const accent = colors.accent;
  const txt = colors.text;
  const sub = colors.textSecondary;
  const el = colors.backgroundElement;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={[s.greeting, { color: txt }]}>{greeting} 👑</Text>
          <Text style={[s.date, { color: sub }]}>{todayStr}</Text>
        </View>

        {/* Hero Banner — pure CSS gradient, no image require */}
        <View style={[s.hero, { backgroundColor: '#1a0533' }]}>
          <Text style={s.heroBadge}>👑 OMAD ATHLETE PROTOCOL</Text>
          <Text style={s.heroTitle}>Fuel Your{'\n'}Performance</Text>
          <Text style={[s.heroSub, { color: accent }]}>One meal. Peak output. 🔥</Text>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={[s.statBox, { backgroundColor: card }]}>
            <Text style={[s.statVal, { color: primary }]}>{kcal}</Text>
            <Text style={[s.statLabel, { color: sub }]}>Target kcal</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: card }]}>
            <Text style={[s.statVal, { color: primary }]}>{protein}g</Text>
            <Text style={[s.statLabel, { color: sub }]}>Protein</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: card }]}>
            <Text style={[s.statVal, { color: accent }]}>{fastingHours}h</Text>
            <Text style={[s.statLabel, { color: sub }]}>Fasting</Text>
          </View>
        </View>

        {/* Fasting Window */}
        <View style={[s.card, { backgroundColor: card }]}>
          <Text style={[s.cardTitle, { color: txt }]}>⏱ Today's Fasting Window</Text>
          <Text style={[s.cardBody, { color: sub }]}>Eating window opens at <Text style={{ color: primary, fontWeight: '800' }}>{omadWindowStartVal}</Text> for <Text style={{ color: accent, fontWeight: '800' }}>{omadWindowHoursVal}h</Text></Text>
          <Text style={[s.cardBody, { color: sub }]}>Fasting duration: <Text style={{ color: primary, fontWeight: '800' }}>{fastingHours}h</Text></Text>
        </View>

        {/* Streak */}
        <View style={[s.card, { backgroundColor: card, borderColor: 'rgba(245,158,11,0.4)', borderWidth: 1.5 }]}>
          <View style={s.row}>
            <Text style={{ fontSize: 36 }}>🦁</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: accent }]}>🔥 7 Day OMAD Streak</Text>
              <Text style={[s.cardBody, { color: sub }]}>Level 3 Fasting Lion • 100% On Track</Text>
            </View>
          </View>
          <View style={s.badgesRow}>
            {[['⚡', '7-Day Warrior'], ['🏆', 'Macro Master'], ['🏋️', 'Workout Fueled']].map(([em, lbl]) => (
              <View key={lbl} style={[s.badge, { backgroundColor: el }]}>
                <Text style={{ fontSize: 20 }}>{em}</Text>
                <Text style={[s.badgeLbl, { color: txt }]}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Water Tracker */}
        <WaterWidget colors={{ card, primary, accent, text: txt, secondary: sub, el }} />

        {/* Micronutrients */}
        <View style={[s.card, { backgroundColor: card }]}>
          <Text style={[s.cardTitle, { color: txt }]}>🔬 Daily Science Targets</Text>
          {[
            ['🌾 Dietary Fiber', '28g', '35g', '#22c55e'],
            ['🧂 Sodium', '3800mg', '4000mg', '#f59e0b'],
            ['🍌 Potassium', '3100mg', '3500mg', '#3b82f6'],
            ['🥑 Magnesium', '390mg', '420mg', '#a855f7'],
            ['💧 Hydration', '3.2L', '3.5L', '#06b6d4'],
          ].map(([label, current, target, color]) => (
            <View key={label as string} style={{ marginBottom: 8 }}>
              <View style={s.row}>
                <Text style={[s.micro, { color: txt }]}>{label}</Text>
                <Text style={[s.microVal, { color: color as string }]}>{current} / {target}</Text>
              </View>
              <View style={[s.track, { backgroundColor: el }]}>
                <View style={[s.fill, { backgroundColor: color as string, width: '80%' }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Link href="/planner" asChild>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: primary }]}>
            <Text style={s.actionBtnTxt}>🍽️ Generate AI Meal Plan</Text>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity style={[s.banner, { backgroundColor: card, borderColor: 'rgba(245,158,11,0.4)' }]} onPress={() => router.push('/grocery' as any)}>
          <Text style={{ fontSize: 24 }}>🛒</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: txt }]}>Weekly Grocery List</Text>
            <Text style={[s.cardBody, { color: sub }]}>Checklist for OMAD ingredients</Text>
          </View>
          <Text style={{ color: accent, fontWeight: '800' }}>View ›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.banner, { backgroundColor: card, borderColor: 'rgba(124,58,237,0.4)' }]} onPress={() => router.push('/progress' as any)}>
          <Text style={{ fontSize: 24 }}>📈</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: txt }]}>Weight Progress</Text>
            <Text style={[s.cardBody, { color: sub }]}>Log & track your OMAD results</Text>
          </View>
          <Text style={{ color: primary, fontWeight: '800' }}>Log ›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.banner, { backgroundColor: card, borderColor: 'rgba(124,58,237,0.4)' }]} onPress={() => router.push('/chat')}>
          <Text style={{ fontSize: 24 }}>🤖</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: txt }]}>Ask AI Coach</Text>
            <Text style={[s.cardBody, { color: sub }]}>Instant timing & electrolyte advice</Text>
          </View>
          <Text style={{ color: primary, fontWeight: '800' }}>Chat ›</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// Inline Water widget — no separate file import risk
function WaterWidget({ colors }: { colors: any }) {
  const [ml, setMl] = useState(1500);
  const [salt, setSalt] = useState(false);

  const add = (n: number) => setMl((p) => Math.min(5000, p + n));
  const pct = Math.round((ml / 3500) * 100);

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: 'rgba(6,182,212,0.4)', borderWidth: 1 }]}>
      <View style={s.row}>
        <Text style={[s.cardTitle, { color: colors.text }]}>💧 Water & Electrolytes</Text>
        <Text style={[s.microVal, { color: colors.primary }]}>{(ml / 1000).toFixed(1)} / 3.5L</Text>
      </View>
      <View style={[s.track, { backgroundColor: colors.el }]}>
        <View style={[s.fill, { backgroundColor: '#06b6d4', width: `${pct}%` }]} />
      </View>
      <View style={s.row}>
        {[250, 500].map((n) => (
          <TouchableOpacity key={n} style={[s.waterBtn, { backgroundColor: colors.el, flex: 1 }]} onPress={() => add(n)}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>+{n}ml 💧</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.waterBtn, { backgroundColor: salt ? 'rgba(245,158,11,0.2)' : colors.el, flex: 1 }]}
          onPress={() => setSalt(!salt)}
        >
          <Text style={{ color: salt ? colors.accent : colors.text, fontWeight: '700', fontSize: 13 }}>
            {salt ? '✅ Salt' : '+ Salt 🧂'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 120 },
  header: { marginBottom: 14 },
  greeting: { fontSize: 28, fontWeight: '900' },
  date: { fontSize: 15, marginTop: 2 },
  hero: { borderRadius: 20, padding: 24, marginBottom: 16, minHeight: 120, justifyContent: 'flex-end' },
  heroBadge: { color: '#F59E0B', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', lineHeight: 32 },
  heroSub: { marginTop: 6, fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  card: { borderRadius: 18, padding: 18, marginBottom: 14, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardBody: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgesRow: { flexDirection: 'row', gap: 8 },
  badge: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  badgeLbl: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  micro: { flex: 1, fontSize: 13, fontWeight: '600' },
  microVal: { fontSize: 13, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 4 },
  waterBtn: { borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  actionBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 14 },
  actionBtnTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  banner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, gap: 12, marginBottom: 12 },
});
