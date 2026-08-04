import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors, MaxContentWidth } from '@/constants/theme';
import { DEFAULT_PROFILE, weeklyTrend, type UserProfile } from '@/lib/nutrition';
import {
  loadProfileOrDefault,
  saveProfile,
  loadWeightLog,
  saveWeightLog,
  todayISO,
  type WeightEntry,
} from '@/lib/store';

/** Minimal sparkline built from Views — avoids pulling in a chart library. */
function Sparkline({ entries, color, bg }: { entries: WeightEntry[]; color: string; bg: string }) {
  const points = [...entries].reverse().slice(-30);
  if (points.length < 2) return null;

  const values = points.map((p) => p.weight_kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <View style={styles.sparkRow}>
      {points.map((p, i) => {
        const height = 8 + ((p.weight_kg - min) / range) * 52;
        return (
          <View key={`${p.date}-${i}`} style={styles.sparkCol}>
            <View style={[styles.sparkBar, { height, backgroundColor: i === points.length - 1 ? color : bg }]} />
          </View>
        );
      })}
    </View>
  );
}

export default function ProgressScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(todayISO());
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, log] = await Promise.all([loadProfileOrDefault(), loadWeightLog()]);
        if (!active) return;
        setProfile(p);
        setEntries(log);
        setDateInput(todayISO());
        setMounted(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!mounted) return null;

  const handleAddLog = async () => {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (!isFinite(w) || w < 30 || w > 300) {
      setMessage({ text: 'Enter a weight between 30 and 300 kg.', ok: false });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput) || isNaN(new Date(dateInput).getTime())) {
      setMessage({ text: 'Use the YYYY-MM-DD date format.', ok: false });
      return;
    }
    if (dateInput > todayISO()) {
      setMessage({ text: 'You cannot log a weight for a future date.', ok: false });
      return;
    }

    const updated = [
      { id: `${dateInput}-${Date.now()}`, date: dateInput, weight_kg: w },
      ...entries.filter((e) => e.date !== dateInput),
    ].sort((a, b) => b.date.localeCompare(a.date));

    setEntries(updated);
    await saveWeightLog(updated);

    // Keep the profile in step so macro targets follow real bodyweight, but
    // only when logging today — back-filling an old entry must not rewrite it.
    if (dateInput === todayISO()) {
      await saveProfile({ ...profile, weight_kg: w });
      setProfile({ ...profile, weight_kg: w });
    }

    setWeightInput('');
    setMessage({ text: 'Weight logged 📈', ok: true });
  };

  const current = entries.length > 0 ? entries[0].weight_kg : profile.weight_kg;
  const start = entries.length > 0 ? entries[entries.length - 1].weight_kg : profile.weight_kg;
  const change = current - start;
  const trend = weeklyTrend(entries);

  const heightM = profile.height_cm / 100;
  const bmi = current / (heightM * heightM);
  const bmiLabel = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese';

  // Target follows the stated goal instead of always assuming weight loss.
  const target =
    profile.goal === 'weight_loss'
      ? Math.round(22 * heightM * heightM * 10) / 10
      : profile.goal === 'muscle_gain'
      ? Math.round((start + 5) * 10) / 10
      : Math.round(start * 10) / 10;

  const span = Math.abs(target - start);
  const moved = Math.abs(current - start);
  const progressPercent = span > 0 ? Math.min(100, (moved / span) * 100) : 100;

  const goodDirection =
    profile.goal === 'weight_loss' ? change < 0 : profile.goal === 'muscle_gain' ? change > 0 : true;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Progress</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {entries.length > 0 ? `${entries.length} entries logged` : 'Log your weight to see the trend'}
        </Text>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Current</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{current.toFixed(1)} kg</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total change</Text>
            <Text
              style={[
                styles.statValue,
                { color: change === 0 ? colors.text : goodDirection ? colors.success : colors.danger },
              ]}
            >
              {change > 0 ? '+' : ''}
              {change.toFixed(1)} kg
            </Text>
          </View>
        </View>

        {entries.length >= 2 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Trend</Text>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14 }}>
                {trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend.toFixed(2)} kg/week`}
              </Text>
            </View>
            <Sparkline entries={entries} color={colors.primary} bg={colors.backgroundElement} />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Daily weight swings 1–2 kg on water alone. The slope over weeks is the real signal.
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Goal progress</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textTransform: 'capitalize' }}>
              {profile.goal.replace('_', ' ')}
            </Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: colors.backgroundElement }]}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: colors.primary }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Start {start.toFixed(1)} kg</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Target {target.toFixed(1)} kg</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>BMI</Text>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
              {bmi.toFixed(1)} <Text style={{ fontSize: 13, color: colors.textSecondary }}>{bmiLabel}</Text>
            </Text>
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            BMI ignores muscle mass — treat it as a rough marker, not a verdict.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Log weight</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputCol}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
              <TextInput
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
                accessibilityLabel="Date"
              />
            </View>
            <View style={styles.inputCol}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Weight (kg)</Text>
              <TextInput
                placeholder="75.5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                inputMode="decimal"
                value={weightInput}
                onChangeText={setWeightInput}
                onSubmitEditing={handleAddLog}
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
                accessibilityLabel="Weight in kilograms"
              />
            </View>
          </View>
          <Pressable
            onPress={handleAddLog}
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={styles.saveBtnTxt}>Save entry</Text>
          </Pressable>
          {message && (
            <Text style={[styles.message, { color: message.ok ? colors.success : colors.danger }]}>
              {message.text}
            </Text>
          )}
        </View>

        {entries.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent entries</Text>
            {entries.slice(0, 10).map((item, idx) => {
              const prev = entries[idx + 1];
              const delta = prev ? item.weight_kg - prev.weight_kg : null;
              return (
                <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.historyDate, { color: colors.textSecondary }]}>{item.date}</Text>
                  <View style={styles.historyRight}>
                    {delta !== null && delta !== 0 && (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: 10 }}>
                        {delta > 0 ? '+' : ''}
                        {delta.toFixed(1)}
                      </Text>
                    )}
                    <Text style={[styles.historyWeight, { color: colors.primary }]}>
                      {item.weight_kg.toFixed(1)} kg
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 130, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 18 },

  statsRow: { flexDirection: 'row', marginRight: -12, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 16, padding: 16, marginRight: 12 },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 6 },

  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 12 },

  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', height: 64, marginTop: 16 },
  sparkCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  sparkBar: { width: '70%', borderRadius: 2, minWidth: 3 },

  progressBarBg: { height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 14 },
  progressBarFill: { height: '100%', borderRadius: 6 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },

  inputRow: { flexDirection: 'row', marginRight: -12, marginTop: 14 },
  inputCol: { flex: 1, marginRight: 12 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  saveBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  message: { fontSize: 13, marginTop: 10, textAlign: 'center' },

  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 10 },
  historyCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: { fontSize: 14, fontWeight: '600' },
  historyRight: { flexDirection: 'row', alignItems: 'center' },
  historyWeight: { fontSize: 16, fontWeight: '800' },
});
