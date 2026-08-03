import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, useColorScheme, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DashboardScreen from './(tabs)/index';

export default function Index() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function checkStatus() {
      try {
        const val = await AsyncStorage.getItem('onboarding_complete');
        setOnboardingComplete(val === 'true');
      } catch (e) {
        setOnboardingComplete(false);
      }
    }
    checkStatus();
  }, []);

  if (onboardingComplete === null) {
    const bgColor = colorScheme === 'dark' ? '#0F0F1A' : '#FAFAFA';
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (!onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return <DashboardScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
