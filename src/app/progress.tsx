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

type ProgressEntry = {
  id: string;
  date: string;
  weight_kg: number;
  energy_rating: number; // 1-5
  notes: string;
};

export default function ProgressScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [weight, setWeight] = useState('');
  const [energy, setEnergy] = useState<number>(4);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('progress_entries').then((raw) => {
      if (raw) setEntries(JSON.parse(raw));
    });
  }, []);

  const handleAddLog = async () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight in kg.');
      return;
    }

    const newEntry: ProgressEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      weight_kg: w,
      energy_rating: energy,
      notes: notes.trim(),
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);
    await AsyncStorage.setItem('progress_entries', JSON.stringify(updated));

    // Update weight in profile
    const profileRaw = await AsyncStorage.getItem('onboarding_profile');
    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      p.weight_kg = w.toString();
      await AsyncStorage.setItem('onboarding_profile', JSON.stringify(p));
    }

    setWeight('');
    setNotes('');
    Alert.alert('Log Saved! 📈', 'Progress entry logged successfully.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Progress Log 📈</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Log Input Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Today's Log</Text>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Weight (kg)</Text>
              <TextInput
                placeholder="75.5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
              />
            </View>
          </View>

          {/* Energy Rating 1-5 */}
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Workout Energy Level (1-5)</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => setEnergy(lvl)}
                  style={[
                    styles.ratingChip,
                    {
                      backgroundColor: energy === lvl ? colors.primary : colors.backgroundElement,
                    },
                  ]}
                >
                  <Text style={[styles.ratingTxt, { color: energy === lvl ? '#FFFFFF' : colors.text }]}>
                    {lvl === 1 ? '⚡ 1' : lvl === 5 ? '🔥 5' : lvl}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
            <TextInput
              placeholder="Felt great during 19:00 run..."
              placeholderTextColor={colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
            />
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Log History</Text>
        {entries.length === 0 ? (
          <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>No progress entries recorded yet.</Text>
        ) : (
          entries.map((item) => (
            <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.card }]}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyDate, { color: colors.textSecondary }]}>{item.date}</Text>
                <Text style={[styles.historyWeight, { color: colors.primary }]}>{item.weight_kg} kg</Text>
              </View>
              <Text style={[styles.historyEnergy, { color: colors.text }]}>
                Energy Rating: {item.energy_rating} / 5 ⭐
              </Text>
              {item.notes ? (
                <Text style={[styles.historyNotes, { color: colors.textSecondary }]}>"{item.notes}"</Text>
              ) : null}
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
  scrollContent: { padding: 20, gap: 16 },
  card: { borderRadius: 16, padding: 16, gap: 14 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  ratingTxt: { fontSize: 14, fontWeight: '700' },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptyTxt: { fontSize: 14 },
  historyCard: { borderRadius: 12, padding: 14, gap: 6 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontSize: 12, fontWeight: '600' },
  historyWeight: { fontSize: 16, fontWeight: '800' },
  historyEnergy: { fontSize: 14, fontWeight: '600' },
  historyNotes: { fontSize: 13, fontStyle: 'italic' },
});
