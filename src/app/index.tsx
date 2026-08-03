import { useEffect, useState } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const value = await AsyncStorage.getItem('onboarding_complete');
        if (value === 'true') {
          setTarget('/(tabs)');
        } else {
          setTarget('/onboarding');
        }
      } catch (e) {
        setTarget('/onboarding');
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    checkOnboarding();
  }, []);

  if (!target) {
    const bgColor = colorScheme === 'dark' ? '#000000' : '#ffffff';
    return <View style={[styles.container, { backgroundColor: bgColor }]} />;
  }

  return <Redirect href={target as any} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
