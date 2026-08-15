/**
 * Thin wrapper around expo-haptics so every caller uses the same vocabulary
 * and the web/simulator no-ops are in one place.
 *
 * Usage:
 *   import { haptic } from '@/lib/haptic';
 *   haptic('success');   // e.g. after logging a fast
 *   haptic('light');     // e.g. chip tap
 *   haptic('heavy');     // e.g. long-press delete
 */

import { Platform } from 'react-native';

// Lazy import so the module is never required on web or old Expo bare builds
// that never installed expo-haptics.
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Haptics = require('expo-haptics');
  } catch {
    // expo-haptics not installed — haptics silently disabled.
  }
}

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function haptic(style: HapticStyle = 'light'): void {
  if (!Haptics) return;
  try {
    switch (style) {
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'light':
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
    }
  } catch {
    // Haptics are best-effort — never crash the UI for a missing vibration.
  }
}
