import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';

const DEFAULT_PROFILE = {
  weight_kg: 75, height_cm: 175, age: 30,
  sex: 'male', goal: 'performance',
  omad_window_start: '18:00', omad_window_hours: 4,
  fitness_level: 'intermediate',
};

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  // SSR-safe: don't render anything colorScheme/time-dependent until client mount
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<any>(DEFAULT_PROFILE);
  const [greeting, setGreeting] = useState('Good morning');
  const [dateStr, setDateStr] = useState('');
  const [water, setWater] = useState(1500);
  const [salt, setSalt] = useState(false);

  const [countdownText, setCountdownText] = useState('');
  const [isEating, setIsEating] = useState(false);
  const [fastProgress, setFastProgress] = useState(0);

  useEffect(() => {
    // Time-dependent — client only
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    setDateStr(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));

    // Profile
    AsyncStorage.getItem('onboarding_profile').then((v) => {
      if (v) { try { setProfile(JSON.parse(v)); } catch (_) {} }
    });

    setMounted(true);
  }, []);

  useEffect(() => {
    // Timer logic
    const eatStartStr = profile.omad_window_start || '18:00';
    let eatH = Number(profile.omad_window_hours) || 4;
    // Handle case if they put 20 for omad_window_hours meaning 20h fast
    if (eatH > 12) {
      eatH = 24 - eatH;
    }
    const fastH = 24 - eatH;
    const [startH, startM] = eatStartStr.split(':').map(Number);

    const updateTimer = () => {
      const d = new Date();
      const nowMs = d.getTime();
      
      const eatStartToday = new Date(d);
      eatStartToday.setHours(startH, startM, 0, 0);
      
      const eatEndToday = new Date(eatStartToday);
      eatEndToday.setHours(eatStartToday.getHours() + eatH);
      
      let startMs = eatStartToday.getTime();
      let endMs = eatEndToday.getTime();
      
      let currentlyEating = false;
      let remainingMs = 0;
      let totalFastingMs = fastH * 3600 * 1000;
      let elapsedFastingMs = 0;

      if (nowMs >= startMs && nowMs < endMs) {
        currentlyEating = true;
      } else {
        if (nowMs < startMs) {
          remainingMs = startMs - nowMs;
          const prevEnd = endMs - 24 * 3600 * 1000;
          elapsedFastingMs = nowMs - prevEnd;
        } else {
          const nextStart = startMs + 24 * 3600 * 1000;
          remainingMs = nextStart - nowMs;
          elapsedFastingMs = nowMs - endMs;
        }
      }

      setIsEating(currentlyEating);
      
      if (currentlyEating) {
        setCountdownText('EATING WINDOW OPEN');
        setFastProgress(100);
      } else {
        const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);
        setCountdownText(`Fasting: ${hrs}h ${mins}m ${secs}s remaining`);
        
        let p = (elapsedFastingMs / totalFastingMs) * 100;
        setFastProgress(Math.min(100, Math.max(0, p)));
      }
    };
    
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [profile]);

  // Show nothing during SSR / before hydration to avoid mismatch
  if (!mounted) return null;

  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Calculations (safe — all numbers)
  const w = Number(profile.weight_kg) || 75;
  const h = Number(profile.height_cm) || 175;
  const a = Number(profile.age) || 30;
  const sex = (profile.sex || '').toLowerCase();
  const goal = (profile.goal || '').toLowerCase();
  const fitness = (profile.fitness_level || '').toLowerCase();
  
  let eatHours = Number(profile.omad_window_hours) || 4;
  if (eatHours > 12) eatHours = 24 - eatHours;
  const fastH = 24 - eatHours;

  const bmr = sex === 'female'
    ? 447.593 + 9.247 * w + 3.098 * h - 4.33 * a
    : 88.362 + 13.397 * w + 4.799 * h - 5.677 * a;
  const mult = fitness === 'advanced' ? 1.9 : fitness === 'intermediate' ? 1.725 : 1.55;
  let kcal = Math.round(bmr * mult);
  if (goal.includes('loss')) kcal -= 500;
  if (goal.includes('muscle') || goal.includes('gain')) kcal += 300;
  const protein = goal.includes('muscle') ? Math.round(w * 2.2) : goal.includes('loss') ? Math.round(w * 1.6) : Math.round(w * 2.0);

  const { background: bg, card, primary, accent, text: txt, textSecondary: sub, backgroundElement: el } = colors;
  const addWater = (n: number) => setWater((p) => Math.min(5000, p + n));

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]} suppressHydrationWarning>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Text style={[s.greeting, { color: txt }]}>{greeting} 👑</Text>
        <Text style={[s.date, { color: sub }]}>{dateStr}</Text>

        {/* Hero */}
        <View style={[s.hero, { backgroundColor: '#1a0533' }]}>
          <Text style={s.heroBadge}>👑 OMAD ATHLETE PROTOCOL</Text>
          <Text style={s.heroTitle}>Fuel Your{'\n'}Performance</Text>
          <Text style={[s.heroSub, { color: accent }]}>One meal. Peak output. 🔥</Text>
        </View>

        {/* Stats */}
        <View style={s.row}>
          {([
            [kcal + '', 'Target kcal', primary],
            [protein + 'g', 'Protein', primary],
            [fastH + 'h', 'Fasting', accent],
          ] as [string, string, string][]).map(([val, lbl, color]) => (
            <View key={lbl} style={[s.stat, { backgroundColor: card }]}>
              <Text style={[s.statV, { color }]}>{val}</Text>
              <Text style={[s.statL, { color: sub }]}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* Fasting window widget */}
        <View style={[s.card, { backgroundColor: card }]}>
          <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }]}>
            <Text style={[s.ct, { color: txt }]}>⏱ Fasting Timer</Text>
            <View style={[s.statusBadge, { backgroundColor: el }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: isEating ? '#22c55e' : '#ef4444' }}>
                {isEating ? '🟢 Eating Window' : '🔴 Fasting'}
              </Text>
            </View>
          </View>
          
          <Text style={[s.timerText, { color: isEating ? primary : accent }]}>
            {countdownText}
          </Text>

          <View style={[s.bar, { backgroundColor: el, height: 12, borderRadius: 6, marginTop: 4 }]}>
            <View style={[s.fill, { backgroundColor: isEating ? '#22c55e' : accent, width: `${fastProgress}%` as any, borderRadius: 6 }]} />
          </View>
          <Text style={[s.cb, { color: sub, textAlign: 'right', marginTop: 4 }]}>
            {isEating ? '100%' : `${fastProgress.toFixed(1)}%`} Completed
          </Text>
        </View>

        {/* Streak */}
        <View style={[s.card, { backgroundColor: card, borderColor: 'rgba(245,158,11,0.4)', borderWidth: 1.5 }]}>
          <View style={s.row}>
            <Text style={{ fontSize: 32 }}>🦁</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.ct, { color: accent }]}>🔥 7 Day Streak</Text>
              <Text style={[s.cb, { color: sub }]}>Level 3 Fasting Lion</Text>
            </View>
          </View>
          <View style={s.row}>
            {(['⚡ 7-Day', '🏆 Macro', '🏋️ Fueled'] as string[]).map((b) => (
              <View key={b} style={[s.badge, { backgroundColor: el }]}>
                <Text style={[s.badgeT, { color: txt }]}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Water */}
        <View style={[s.card, { backgroundColor: card, borderColor: 'rgba(6,182,212,0.35)', borderWidth: 1 }]}>
          <View style={s.row}>
            <Text style={[s.ct, { color: txt }]}>💧 Water</Text>
            <Text style={[s.cb, { color: primary, fontWeight: '800' }]}>{(water / 1000).toFixed(1)} / 3.5L</Text>
          </View>
          <View style={[s.bar, { backgroundColor: el }]}>
            <View style={[s.fill, { backgroundColor: '#06b6d4', width: `${Math.min(100, (water / 3500) * 100)}%` as any }]} />
          </View>
          <View style={s.row}>
            {[250, 500].map((n) => (
              <TouchableOpacity key={n} style={[s.wBtn, { backgroundColor: el }]} onPress={() => addWater(n)}>
                <Text style={{ color: txt, fontWeight: '700', fontSize: 13 }}>+{n}ml 💧</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.wBtn, { backgroundColor: salt ? 'rgba(245,158,11,0.2)' : el }]}
              onPress={() => setSalt(!salt)}
            >
              <Text style={{ color: salt ? accent : txt, fontWeight: '700', fontSize: 13 }}>
                {salt ? '✅ Salt' : '+ Salt 🧂'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Micronutrients */}
        <View style={[s.card, { backgroundColor: card }]}>
          <Text style={[s.ct, { color: txt }]}>🔬 Daily Targets</Text>
          {([
            ['🌾 Fiber', '28g', '35g', '#22c55e'],
            ['🧂 Sodium', '3800mg', '4000mg', '#f59e0b'],
            ['🍌 Potassium', '3100mg', '3500mg', '#3b82f6'],
            ['🥑 Magnesium', '390mg', '420mg', '#a855f7'],
          ] as [string, string, string, string][]).map(([lbl, cur, tgt, col]) => (
            <View key={lbl} style={{ marginBottom: 8 }}>
              <View style={s.row}>
                <Text style={[s.cb, { color: txt, flex: 1 }]}>{lbl}</Text>
                <Text style={[s.cb, { color: col, fontWeight: '800' }]}>{cur}/{tgt}</Text>
              </View>
              <View style={[s.bar, { backgroundColor: el }]}>
                <View style={[s.fill, { backgroundColor: col, width: '80%' }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <Link href="/planner" asChild>
          <TouchableOpacity style={[s.btn, { backgroundColor: primary }]}>
            <Text style={s.btnT}>🍽️ Generate AI Meal Plan</Text>
          </TouchableOpacity>
        </Link>

        {([
          ['/grocery', '🛒', 'Grocery List', 'OMAD ingredients checklist', accent],
          ['/progress', '📈', 'Weight Progress', 'Log & track your results', primary],
          ['/chat', '🤖', 'AI Coach', 'Fasting & electrolyte advice', primary],
        ] as [string, string, string, string, string][]).map(([href, em, title, desc, color]) => (
          <TouchableOpacity
            key={href}
            style={[s.banner, { backgroundColor: card, borderColor: color + '55' }]}
            onPress={() => router.push(href as any)}
          >
            <Text style={{ fontSize: 24 }}>{em}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.ct, { color: txt }]}>{title}</Text>
              <Text style={[s.cb, { color: sub }]}>{desc}</Text>
            </View>
            <Text style={{ color, fontWeight: '800', fontSize: 16 }}>›</Text>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 120 },
  greeting: { fontSize: 28, fontWeight: '900', marginBottom: 2 },
  date: { fontSize: 14, marginBottom: 14 },
  hero: { borderRadius: 20, padding: 24, marginBottom: 14, minHeight: 110, justifyContent: 'flex-end' },
  heroBadge: { color: '#F59E0B', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle: { color: '#FFF', fontSize: 26, fontWeight: '900', lineHeight: 30 },
  heroSub: { marginTop: 4, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', rowGap: 10, columnGap: 10, marginBottom: 0 },
  stat: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', marginBottom: 14 },
  statV: { fontSize: 17, fontWeight: '800' },
  statL: { fontSize: 10, marginTop: 2 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12, rowGap: 8, columnGap: 8 },
  ct: { fontSize: 15, fontWeight: '800' },
  cb: { fontSize: 13, lineHeight: 18 },
  badge: { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center' },
  badgeT: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  bar: { height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 2, marginBottom: 2 },
  fill: { height: '100%', borderRadius: 4 },
  wBtn: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  btnT: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  banner: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1.5, rowGap: 10, columnGap: 10, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  timerText: { fontSize: 22, fontWeight: '900', marginVertical: 8, textAlign: 'center' },
});
