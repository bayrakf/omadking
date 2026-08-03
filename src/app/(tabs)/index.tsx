import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Current time logic
  const now = new Date();
  const currentHour = now.getHours();
  let greeting = 'Good morning';
  if (currentHour >= 12 && currentHour < 17) greeting = 'Good afternoon';
  else if (currentHour >= 17) greeting = 'Good evening';
  
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const todayStr = now.toLocaleDateString(undefined, dateOptions);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem('onboarding_profile');
        if (stored) {
          setProfile(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load profile', e);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text, fontSize: 18, marginBottom: 16 }}>Complete onboarding first</Text>
      </SafeAreaView>
    );
  }

  // Safe numeric conversion with defaults
  const weightNum = Number(profile.weight_kg) || 75;
  const heightNum = Number(profile.height_cm) || 175;
  const ageNum = Number(profile.age) || 30;
  const sexVal = profile.sex || 'male';
  const goalVal = profile.goal || 'performance';
  const omadWindowHoursVal = Number(profile.omad_window_hours) || 1;
  const omadWindowStartVal = profile.omad_window_start || '14:00';
  const defaultTrainingTimeVal = profile.default_training_time || '18:00';

  let bmr = 0;
  if (sexVal === 'female') {
    bmr = 447.593 + (9.247 * weightNum) + (3.098 * heightNum) - (4.330 * ageNum);
  } else {
    bmr = 88.362 + (13.397 * weightNum) + (4.799 * heightNum) - (5.677 * ageNum);
  }
  
  // Activity multiplier
  let activityMultiplier = 1.55;
  if (profile.fitness_level === 'intermediate') activityMultiplier = 1.725;
  else if (profile.fitness_level === 'advanced') activityMultiplier = 1.9;
  
  let targetCalories = Math.round(bmr * activityMultiplier);
  
  // Adjust based on goal
  if (goalVal === 'weight_loss') targetCalories -= 500;
  if (goalVal === 'muscle_gain') targetCalories += 300;

  let proteinTarget = 0;
  if (goalVal === 'weight_loss') proteinTarget = Math.round(weightNum * 1.6);
  else if (goalVal === 'muscle_gain') proteinTarget = Math.round(weightNum * 2.2);
  else proteinTarget = Math.round(weightNum * 2.0);

  const fastingHours = 24 - omadWindowHoursVal;
  
  // Fasting Window Parsing
  const startHour = parseInt((omadWindowStartVal || '14:00').split(':')[0], 10) || 14;
  const endHour = (startHour + omadWindowHoursVal) % 24;
  const eatingWindowStr = `${omadWindowStartVal} - ${endHour.toString().padStart(2, '0')}:00`;
  
  const trainingHour = parseInt((defaultTrainingTimeVal || '18:00').split(':')[0], 10) || 18;
  const trainingStr = `${defaultTrainingTimeVal}`;
  
  // Status logic
  let status = 'Fasting';
  if (currentHour >= startHour && currentHour < startHour + omadWindowHoursVal) {
    status = 'Eating Window';
  } else if (currentHour >= trainingHour && currentHour < trainingHour + 2) {
    status = 'Post-Training';
  }

  const cardStyle = [styles.card, { backgroundColor: colors.card }];
  const textStyle = { color: colors.text };
  const textSecondaryStyle = { color: colors.textSecondary };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, textStyle]}>{greeting}</Text>
          <Text style={[styles.date, textSecondaryStyle]}>{todayStr}</Text>
        </View>

        {/* Fasting Window Card */}
        <View style={cardStyle}>
          <Text style={[styles.cardTitle, textStyle]}>Window Status</Text>
          
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarBg, { backgroundColor: colors.backgroundElement }]} />
            
            {/* Eating Window Highlight */}
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  backgroundColor: colors.accent,
                  left: `${(startHour / 24) * 100}%`,
                  width: `${(omadWindowHoursVal / 24) * 100}%` 
                }
              ]} 
            />
            
            {/* Training Dot */}
            <View 
              style={[
                styles.trainingDot,
                {
                  backgroundColor: colors.primary,
                  left: `${(trainingHour / 24) * 100}%`
                }
              ]}
            />
            
            {/* Current Time Indicator */}
            <View 
              style={[
                styles.currentTimeIndicator,
                {
                  backgroundColor: colors.text,
                  left: `${(currentHour / 24) * 100}%`
                }
              ]}
            />
          </View>
          
          <View style={styles.windowInfoRow}>
            <View>
              <Text style={[styles.infoLabel, textSecondaryStyle]}>Eating window</Text>
              <Text style={[styles.infoValue, textStyle]}>{eatingWindowStr}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.infoLabel, textSecondaryStyle]}>Training</Text>
              <Text style={[styles.infoValue, textStyle]}>{trainingStr}</Text>
            </View>
          </View>
          
          <Text style={[styles.statusText, { color: colors.primary }]}>{status}</Text>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <View style={[cardStyle, styles.statCard, { marginRight: 8 }]}>
            <Text style={[styles.statValue, textStyle]}>{targetCalories}</Text>
            <Text style={[styles.statLabel, textSecondaryStyle]}>kcal</Text>
          </View>
          <View style={[cardStyle, styles.statCard, { marginHorizontal: 4 }]}>
            <Text style={[styles.statValue, textStyle]}>{proteinTarget}g</Text>
            <Text style={[styles.statLabel, textSecondaryStyle]}>Protein</Text>
          </View>
          <View style={[cardStyle, styles.statCard, { marginLeft: 8 }]}>
            <Text style={[styles.statValue, textStyle]}>{fastingHours}h</Text>
            <Text style={[styles.statLabel, textSecondaryStyle]}>Fasting</Text>
          </View>
        </View>

        {/* Today's Plan Card */}
        <View style={cardStyle}>
          <Text style={[styles.cardTitle, textStyle]}>Today's Plan</Text>
          <Text style={[styles.emptyText, textSecondaryStyle]}>No meal plan for today</Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => console.log('Generate Plan')}
          >
            <Text style={styles.buttonText}>Generate Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Training Card */}
        <View style={cardStyle}>
          <Text style={[styles.cardTitle, textStyle]}>Today's Training</Text>
          <Text style={[styles.emptyText, textSecondaryStyle]}>No training planned</Text>
          <TouchableOpacity 
            style={[styles.buttonOutline, { borderColor: colors.primary }]}
            onPress={() => console.log('Add Training')}
          >
            <Text style={[styles.buttonOutlineText, { color: colors.primary }]}>Add Training</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
    marginTop: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    position: 'absolute',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    position: 'absolute',
  },
  trainingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    transform: [{ translateX: -6 }],
  },
  currentTimeIndicator: {
    width: 2,
    height: 16,
    position: 'absolute',
    transform: [{ translateX: -1 }],
  },
  windowInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonOutline: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonOutlineText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
