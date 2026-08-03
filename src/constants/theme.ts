/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1A2E',
    background: '#FAFAFA',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E8E0F0',
    textSecondary: '#6B7280',
    primary: '#7C3AED',
    primaryLight: '#A78BFA',
    accent: '#F59E0B',
    accentLight: '#FCD34D',
    success: '#10B981',
    danger: '#EF4444',
    card: '#FFFFFF',
  },
  dark: {
    text: '#F9FAFB',
    background: '#0F0F1A',
    backgroundElement: '#1E1E32',
    backgroundSelected: '#2D2B55',
    textSecondary: '#9CA3AF',
    primary: '#A78BFA',
    primaryLight: '#7C3AED',
    accent: '#FBBF24',
    accentLight: '#F59E0B',
    success: '#34D399',
    danger: '#F87171',
    card: '#1A1A2E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
