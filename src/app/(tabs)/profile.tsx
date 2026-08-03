import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, useColorScheme, Alert,
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_profile').then((raw) => {
      if (raw) setProfile(JSON.parse(raw));
    });
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert('Reset Onboarding', 'This will clear your profile and restart onboarding.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['onboarding_complete', 'onboarding_profile']);
          router.replace('/onboarding');
        },
      },
    ]);
  }, [router]);

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={[styles.row, { borderBottomColor: colors.backgroundElement }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>No profile data yet.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Body Stats</Text>
          <Row label="Weight" value={`${profile.weight_kg} kg`} />
          <Row label="Height" value={`${profile.height_cm} cm`} />
          <Row label="Age" value={`${profile.age} years`} />
          <Row label="Sex" value={profile.sex ?? '—'} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Fitness</Text>
          <Row label="Level" value={profile.fitness_level ?? '—'} />
          <Row label="Goal" value={(profile.goal ?? '—').replace('_', ' ')} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Schedule</Text>
          <Row label="Eating Window" value={`${profile.omad_window_start} (${profile.omad_window_hours}h)`} />
          <Row label="Training Time" value={profile.default_training_time} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Subscription</Text>
          <Row label="Plan" value="Free" />
          <Row label="Plans this week" value="0 / 3" />
        </View>

        <Pressable
          style={[styles.resetButton, { backgroundColor: colors.danger }]}
          onPress={handleReset}>
          <Text style={styles.resetText}>Reset Onboarding</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 16, marginTop: 4 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  resetButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  resetText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
