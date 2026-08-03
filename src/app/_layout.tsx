import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Surfaces real errors instead of white screen
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="landing" />
        <Stack.Screen name="chat" />
      </Stack>
    </SafeAreaProvider>
  );
}
