import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';

type WeightLogEntry = {
  id: string;
  date: string;
  weight_kg: number;
};

export default function ProgressScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<WeightLogEntry[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  
  // Profile data
  const [heightCm, setHeightCm] = useState(175);
  const [startWeight, setStartWeight] = useState(80);

  useEffect(() => {
    setMounted(true);
    const today = new Date().toISOString().split('T')[0];
    setDateInput(today);
    
    const loadData = async () => {
      try {
        const profileRaw = await AsyncStorage.getItem('onboarding_profile');
        if (profileRaw) {
          const p = JSON.parse(profileRaw);
          if (p.height_cm) setHeightCm(parseFloat(p.height_cm));
          if (p.weight_kg) setStartWeight(parseFloat(p.weight_kg));
        }

        const logsRaw = await AsyncStorage.getItem('weight_log');
        if (logsRaw) {
          const parsed = JSON.parse(logsRaw);
          setEntries(parsed.sort((a: any, b: any) => b.date.localeCompare(a.date)));
        }
      } catch (e) {
        console.error('Failed to load logs', e);
      }
    };
    loadData();
  }, []);

  if (!mounted) return null;

  const handleAddLog = async () => {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight in kg.');
      return;
    }
    if (!dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid Date', 'Please use YYYY-MM-DD format.');
      return;
    }

    const newEntry: WeightLogEntry = {
      id: Date.now().toString(),
      date: dateInput,
      weight_kg: w,
    };

    const updated = [newEntry, ...entries.filter(e => e.date !== dateInput)].sort(
      (a, b) => b.date.localeCompare(a.date)
    );
    setEntries(updated);
    await AsyncStorage.setItem('weight_log', JSON.stringify(updated));

    // Update current weight in profile as well to keep in sync
    const profileRaw = await AsyncStorage.getItem('onboarding_profile');
    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      p.weight_kg = w.toString();
      await AsyncStorage.setItem('onboarding_profile', JSON.stringify(p));
    }

    setWeightInput('');
    Alert.alert('Success', 'Weight logged! 📈');
  };

  const currentWeight = entries.length > 0 ? entries[0].weight_kg : startWeight;
  const initialWeight = entries.length > 0 ? entries[entries.length - 1].weight_kg : startWeight;
  const totalChange = currentWeight - initialWeight;

  // Calculate weekly average
  const last7Days = entries.filter((e) => {
    const d = new Date(e.date).getTime();
    const now = new Date().getTime();
    return now - d <= 7 * 24 * 60 * 60 * 1000;
  });
  const weeklyAvg = last7Days.length > 0
    ? (last7Days.reduce((sum, e) => sum + e.weight_kg, 0) / last7Days.length).toFixed(1)
    : '--';

  // Trend
  let trend = '→';
  if (entries.length >= 2) {
    const diff = entries[0].weight_kg - entries[1].weight_kg;
    if (diff > 0) trend = '↑';
    else if (diff < 0) trend = '↓';
  }

  // BMI
  const heightM = heightCm / 100;
  const bmi = (currentWeight / (heightM * heightM)).toFixed(1);

  // Goal logic (assuming ideal BMI 22 if no goal is set, or 10% less)
  const targetWeight = parseFloat((22 * heightM * heightM).toFixed(1));
  
  // Progress bar
  const totalToLose = Math.max(0, initialWeight - targetWeight);
  const lost = Math.max(0, initialWeight - currentWeight);
  const progressPercent = totalToLose > 0 ? Math.min(100, Math.max(0, (lost / totalToLose) * 100)) : 100;

  // Streak
  let streak = 0;
  let d = new Date();
  for (let i = 0; i < entries.length; i++) {
    const entryDate = entries[i].date;
    const checkDate = d.toISOString().split('T')[0];
    if (entryDate === checkDate) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (entryDate < checkDate) {
      break;
    }
  }

  const streakMessage = streak > 3 ? `🔥 ${streak} day streak! You're on fire!` : streak > 0 ? `👍 ${streak} day streak. Keep it up!` : 'Log your weight to start a streak!';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Progress</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Change</Text>
            <Text style={[styles.statValue, { color: totalChange > 0 ? colors.danger : colors.success }]}>
              {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)} kg
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Weekly Avg</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {weeklyAvg} kg {trend}
            </Text>
          </View>
        </View>

        {/* Progress Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Goal Progress</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: colors.primary }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Start: {initialWeight} kg</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Goal: {targetWeight} kg</Text>
          </View>
        </View>

        {/* BMI & Streak */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Current BMI</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{bmi}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, flex: 1.5 }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Streak</Text>
            <Text style={[styles.streakText, { color: colors.text }]} numberOfLines={2}>
              {streakMessage}
            </Text>
          </View>
        </View>

        {/* Input Form */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Log Weight</Text>
          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
              <TextInput
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Weight (kg)</Text>
              <TextInput
                placeholder="75.5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={weightInput}
                onChangeText={setWeightInput}
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
              />
            </View>
          </View>
          <Pressable
            onPress={handleAddLog}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.saveBtnTxt}>Save Entry</Text>
          </Pressable>
        </View>

        {/* History List */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Log (Last 10)</Text>
        {entries.length === 0 ? (
          <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>No progress entries recorded yet.</Text>
        ) : (
          entries.slice(0, 10).map((item) => (
            <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.historyDate, { color: colors.textSecondary }]}>{item.date}</Text>
              <Text style={[styles.historyWeight, { color: colors.primary }]}>{item.weight_kg.toFixed(1)} kg</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingRight: 12 },
  backTxt: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 40 },
  scrollContent: { padding: 16, rowGap: 16, columnGap: 16 },
  card: { borderRadius: 16, padding: 16, rowGap: 14, columnGap: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  statsRow: { flexDirection: 'row', rowGap: 12, columnGap: 12 },
  statBox: { flex: 1, borderRadius: 16, padding: 16, rowGap: 8, columnGap: 8, justifyContent: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 24, fontWeight: '800' },
  streakText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  progressBarBg: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 6 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  inputRow: { flexDirection: 'row', rowGap: 12, columnGap: 12 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptyTxt: { fontSize: 14 },
  historyCard: { borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontSize: 15, fontWeight: '600' },
  historyWeight: { fontSize: 16, fontWeight: '800' },
});
