import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, useColorScheme, Alert, TextInput, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';

type ProfileData = {
  weight_kg: string;
  height_cm: string;
  age: string;
  sex: string | null;
  fitness_level: string | null;
  goal: string | null;
  omad_window_start: string;
  omad_window_hours: number;
  default_training_time: string;
};

export default function ProfileScreen() {
  const [mounted, setMounted] = useState(false);
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  
  const [editingField, setEditingField] = useState<keyof ProfileData | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    setMounted(true);
    AsyncStorage.getItem('onboarding_profile').then((raw) => {
      if (raw) setProfile(JSON.parse(raw));
    });
  }, []);

  const handleReset = useCallback(() => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('This will clear your profile and restart onboarding.');
      if (ok) {
        AsyncStorage.multiRemove(['onboarding_complete', 'onboarding_profile']).then(() => {
          router.replace('/onboarding');
        });
      }
      return;
    }
    Alert.alert('Reset Onboarding', 'This will clear your profile and restart onboarding.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['onboarding_complete', 'onboarding_profile']);
          router.replace('/onboarding');
        } },
    ]);
  }, [router]);

  const saveEdit = async (field: keyof ProfileData, value: string) => {
    if (!profile) return;
    const newProfile = { ...profile, [field]: field === 'omad_window_hours' ? Number(value) : value };
    setProfile(newProfile);
    await AsyncStorage.setItem('onboarding_profile', JSON.stringify(newProfile));
    setEditingField(null);
  };

  if (!mounted) return null;

  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>No profile data yet.</Text>
      </SafeAreaView>
    );
  }

  const w = parseFloat(profile.weight_kg) || 0;
  const h = parseFloat(profile.height_cm) || 0;
  const a = parseInt(profile.age) || 0;
  let bmr = 0;
  if (w && h && a) {
    const s = profile.sex === 'female' ? -161 : 5;
    bmr = (10 * w) + (6.25 * h) - (5 * a) + s;
  }
  let tdee = bmr * 1.2;
  if (profile.fitness_level === 'intermediate') tdee = bmr * 1.375;
  if (profile.fitness_level === 'advanced') tdee = bmr * 1.55;
  if (profile.fitness_level === 'athlete') tdee = bmr * 1.725;

  const renderRow = (label: string, field: keyof ProfileData, format: (val: any) => string = String) => {
    const isEditing = editingField === field;
    const value = profile[field] ?? '';
    
    return (
      <View style={[styles.row, { borderBottomColor: colors.backgroundElement }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.primary }]}
            value={editValue}
            onChangeText={setEditValue}
            onBlur={() => saveEdit(field, editValue)}
            onSubmitEditing={() => saveEdit(field, editValue)}
            autoFocus
          />
        ) : (
          <Pressable onPress={() => { setEditingField(field); setEditValue(String(value)); }}>
            <Text style={[styles.value, { color: colors.text }]}>{format(value) || '—'}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Body Stats</Text>
          {renderRow('Weight (kg)', 'weight_kg')}
          {renderRow('Height (cm)', 'height_cm')}
          {renderRow('Age', 'age')}
          {renderRow('Sex', 'sex')}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Metabolism</Text>
          <View style={[styles.row, { borderBottomColor: colors.backgroundElement }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>BMR</Text>
            <Text style={[styles.value, { color: colors.text }]}>{Math.round(bmr)} kcal</Text>
          </View>
          <View style={[styles.row, { borderBottomColor: colors.backgroundElement, borderBottomWidth: 0 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Estimated TDEE</Text>
            <Text style={[styles.value, { color: colors.text }]}>{Math.round(tdee)} kcal</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Fitness Level</Text>
          {renderRow('Level', 'fitness_level')}
        </View>
        
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Goals</Text>
          {renderRow('Goal', 'goal', (v) => v.replace(/_/g, ' '))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Fasting Window</Text>
          {renderRow('Start Time', 'omad_window_start')}
          {renderRow('Duration (hours)', 'omad_window_hours')}
          {renderRow('Training Time', 'default_training_time')}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>App Info</Text>
          <View style={[styles.row, { borderBottomColor: colors.backgroundElement }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.value, { color: colors.text }]}>1.0.0</Text>
          </View>
          <View style={[styles.row, { borderBottomColor: colors.backgroundElement, borderBottomWidth: 0 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>About</Text>
            <Text style={[styles.value, { color: colors.text }]}>OMADCoach Premium</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Account</Text>
          <Pressable style={[styles.resetButton, { backgroundColor: colors.danger }]} onPress={handleReset}>
            <Text style={styles.resetText}>Reset Onboarding</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, marginTop: 4 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 15 },
  value: { fontSize: 15, fontWeight: '500', textTransform: 'capitalize' },
  input: {
    fontSize: 15,
    fontWeight: '500',
    borderBottomWidth: 1,
    minWidth: 80,
    textAlign: 'right',
    padding: 0,
    margin: 0 },
  resetButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' },
  resetText: { color: '#fff', fontSize: 15, fontWeight: '600' } });
