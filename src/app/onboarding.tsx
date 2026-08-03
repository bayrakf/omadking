import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme, TextInput, Animated, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [data, setData] = useState({
    weight_kg: '',
    height_cm: '',
    age: '',
    sex: null as string | null,
    fitness_level: null as string | null,
    goal: null as string | null,
    omad_window_start: '14:00',
    omad_window_hours: 1,
    default_training_time: '18:00',
  });
  
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const totalSteps = 5;

  const animateToNextStep = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -50, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      animateToNextStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      animateToNextStep(step - 1);
    }
  };

  const handleStartPlanning = async () => {
    try {
      await AsyncStorage.setItem('onboarding_profile', JSON.stringify(data));
      await AsyncStorage.setItem('onboarding_complete', 'true');
    } catch (e) {
      console.error(e);
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/planner';
    } else {
      router.replace('/planner');
    }
  };

  const updateData = (key: keyof typeof data, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const renderOption = (key: keyof typeof data, value: string | number, label: string) => {
    const isSelected = data[key] === value;
    return (
      <Pressable
        key={String(value)}
        style={[
          styles.optionButton,
          { backgroundColor: isSelected ? colors.primary : colors.backgroundElement },
        ]}
        onPress={() => updateData(key, value)}>
        <Text style={[styles.optionText, { color: isSelected ? '#FFF' : colors.text }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderTimingOption = (key: keyof typeof data, value: string, label: string, presets: string[]) => {
    const currentValue = data[key] as string;
    const isSelected = value === 'Custom' 
      ? !presets.includes(currentValue) 
      : currentValue === value;
    
    return (
      <Pressable
        key={value}
        style={[
          styles.optionButton,
          { backgroundColor: isSelected ? colors.primary : colors.backgroundElement },
        ]}
        onPress={() => {
          if (value === 'Custom') {
            updateData(key, '');
          } else {
            updateData(key, value);
          }
        }}>
        <Text style={[styles.optionText, { color: isSelected ? '#FFF' : colors.text }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.emoji}>🍽️</Text>
            <Text style={[styles.title, { color: colors.text }]}>OMADCoach</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Optimize your One Meal A Day around your evening training.
            </Text>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Body Stats</Text>
            
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
                  keyboardType="numeric"
                  value={data.weight_kg}
                  onChangeText={(val) => updateData('weight_kg', val)}
                  placeholder="e.g. 75"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Height (cm)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
                  keyboardType="numeric"
                  value={data.height_cm}
                  onChangeText={(val) => updateData('height_cm', val)}
                  placeholder="e.g. 180"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Age</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
                keyboardType="numeric"
                value={data.age}
                onChangeText={(val) => updateData('age', val)}
                placeholder="e.g. 30"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Sex</Text>
            <View style={styles.optionsRow}>
              {renderOption('sex', 'Male', 'Male')}
              {renderOption('sex', 'Female', 'Female')}
              {renderOption('sex', 'Other', 'Other')}
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Fitness Profile</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>Fitness Level</Text>
            <View style={styles.optionsCol}>
              {renderOption('fitness_level', 'Beginner', 'Beginner')}
              {renderOption('fitness_level', 'Intermediate', 'Intermediate')}
              {renderOption('fitness_level', 'Advanced', 'Advanced')}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 24 }]}>Goal</Text>
            <View style={styles.optionsCol}>
              {renderOption('goal', 'Performance', 'Performance')}
              {renderOption('goal', 'Weight Loss', 'Weight Loss')}
              {renderOption('goal', 'Muscle Gain', 'Muscle Gain')}
            </View>
          </View>
        );
      case 3: {
        const eatPresets = ['12:00', '14:00', '16:00', '18:00'];
        const trainPresets = ['17:00', '18:00', '19:00', '20:00'];
        
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Timing & Routine</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>When do you usually eat?</Text>
            <View style={styles.optionsRowWrap}>
              {eatPresets.map(p => renderTimingOption('omad_window_start', p, p, eatPresets))}
              {renderTimingOption('omad_window_start', 'Custom', 'Custom', eatPresets)}
            </View>
            {!eatPresets.includes(data.omad_window_start) && (
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement, marginTop: 12 }]}
                placeholder="HH:MM"
                placeholderTextColor={colors.textSecondary}
                value={data.omad_window_start}
                onChangeText={(val) => updateData('omad_window_start', val)}
              />
            )}

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 24 }]}>How long is your eating window?</Text>
            <View style={styles.optionsRow}>
              {renderOption('omad_window_hours', 1, '1h')}
              {renderOption('omad_window_hours', 2, '2h')}
              {renderOption('omad_window_hours', 4, '4h')}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 24 }]}>When do you usually train?</Text>
            <View style={styles.optionsRowWrap}>
              {trainPresets.map(p => renderTimingOption('default_training_time', p, p, trainPresets))}
              {renderTimingOption('default_training_time', 'Custom', 'Custom', trainPresets)}
            </View>
            {!trainPresets.includes(data.default_training_time) && (
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement, marginTop: 12 }]}
                placeholder="HH:MM"
                placeholderTextColor={colors.textSecondary}
                value={data.default_training_time}
                onChangeText={(val) => updateData('default_training_time', val)}
              />
            )}
          </View>
        );
      }
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.emoji}>✅</Text>
            <Text style={[styles.title, { color: colors.text }]}>You're all set!</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              OMADCoach will now optimize your meals around your training.
            </Text>
          </View>
        );
    }
  };

  const getNextButtonText = () => {
    if (step === 0) return "Let's Go";
    if (step === totalSteps - 1) return "Start Planning";
    return "Next";
  };

  const isNextDisabled = () => {
    if (step === 1) {
      return !data.weight_kg || !data.height_cm || !data.age || !data.sex;
    }
    if (step === 2) {
      return !data.fitness_level || !data.goal;
    }
    if (step === 3) {
      return !data.omad_window_start || !data.default_training_time;
    }
    return false;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          {step > 0 && (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
            </Pressable>
          )}
          <View style={styles.progressContainer}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  { backgroundColor: i <= step ? colors.primary : colors.backgroundElement },
                  i === step && styles.progressDotActive
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.animatedContent, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            {renderStep()}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.mainButton,
              { backgroundColor: isNextDisabled() ? colors.backgroundElement : colors.primary },
            ]}
            onPress={step === totalSteps - 1 ? handleStartPlanning : handleNext}
            disabled={isNextDisabled()}>
            <Text style={[styles.mainButtonText, { color: isNextDisabled() ? colors.textSecondary : '#FFFFFF' }]}>
              {getNextButtonText()}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    height: 44,
  },
  backButton: {
    position: 'absolute',
    left: 24,
    zIndex: 1,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    width: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },
  animatedContent: {
    flex: 1,
    padding: 24,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
  },
  emoji: { fontSize: 64, marginBottom: 24, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  stepTitle: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  subtitle: { fontSize: 16, marginTop: 12, textAlign: 'center', lineHeight: 24 },
  
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  inputGroup: { flex: 1, marginBottom: 16 },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  
  optionsRow: { flexDirection: 'row', gap: 12 },
  optionsRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionsCol: { flexDirection: 'column', gap: 12 },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: '28%',
  },
  optionText: { fontSize: 15, fontWeight: '600' },
  
  footer: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 0 : 24,
  },
  mainButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  mainButtonText: { fontSize: 16, fontWeight: '600' },
});
