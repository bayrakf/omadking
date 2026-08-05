import { useCallback, useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppState, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '@/constants/theme';
import { isOnboarded } from '@/lib/store';
import { resync } from '@/lib/notify';
import ErrorScreen from '@/components/ErrorScreen';

// Surfaces real errors instead of a white screen.
// expo-router's own boundary keeps the screen from going white, but it reads
// like a stack trace with a retry button. Same contract, our design.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <ErrorScreen error={error} retry={() => { void retry(); }} />;
}

/** Routes reachable without a completed profile. */
const PUBLIC_ROUTES = new Set(['onboarding', 'landing']);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const [checked, setChecked] = useState(false);

  // Keys here are the family names referenced by Font in constants/theme.
  const [fontsLoaded, fontError] = useFonts({
    'Archivo-Bold': require('../../assets/fonts/Archivo-Bold.ttf'),
    'Archivo-SemiBold': require('../../assets/fonts/Archivo-SemiBold.ttf'),
    'HankenGrotesk-Regular': require('../../assets/fonts/HankenGrotesk-Regular.ttf'),
    'HankenGrotesk-Medium': require('../../assets/fonts/HankenGrotesk-Medium.ttf'),
    'HankenGrotesk-SemiBold': require('../../assets/fonts/HankenGrotesk-SemiBold.ttf'),
    'JetBrainsMono-Medium': require('../../assets/fonts/JetBrainsMono-Medium.ttf'),
  });

  // Re-read on every navigation rather than caching the flag once. Caching it
  // meant that finishing onboarding left this holding `false`, so the redirect
  // fired again and bounced the user back to step 1 forever.
  useEffect(() => {
    let cancelled = false;
    isOnboarded().then((done) => {
      if (cancelled) return;
      setChecked(true);
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

  // A missing font must not block the app forever — fall back to system faces.
  const ready = checked && (fontsLoaded || !!fontError);

  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Plan-specific reminders are one-offs for today, so they are rebuilt each
  // time the app comes forward rather than needing a background task.
  useEffect(() => {
    resync().catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') resync().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider onLayout={onLayout}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
          animationDuration: 180,
        }}
      >
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="landing" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="about" />
      </Stack>
    </SafeAreaProvider>
  );
}
