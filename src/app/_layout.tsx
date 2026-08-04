import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { isOnboarded } from '@/lib/store';

// Surfaces real errors instead of a white screen.
export { ErrorBoundary } from 'expo-router';

/** Routes reachable without a completed profile. */
const PUBLIC_ROUTES = new Set(['onboarding', 'landing']);

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  // Re-read on every navigation rather than caching the flag once. Caching it
  // meant that finishing onboarding left this holding `false`, so the redirect
  // fired again and bounced the user back to step 1 forever.
  useEffect(() => {
    let cancelled = false;
    isOnboarded().then((done) => {
      if (cancelled) return;
      setReady(true);
      const first = segments[0] ?? '';
      // Without this gate a first-time user landed on the dashboard and saw
      // targets computed from a placeholder 75kg/175cm profile.
      if (!done && !PUBLIC_ROUTES.has(first)) {
        router.replace('/onboarding');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [segments, router]);

  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="landing" />
        <Stack.Screen name="chat" />
      </Stack>
    </SafeAreaProvider>
  );
}
