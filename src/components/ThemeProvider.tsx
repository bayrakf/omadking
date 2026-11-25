/**
 * Theme context provider supporting Obsidian Carbon (dark), Alabaster Paper (light),
 * and automatic OS tracking (`system`), with instant web viewport polarity sync.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { Colors, type ThemePalette } from '@/constants/theme';
import { loadThemeMode, saveThemeMode, type ThemeMode } from '@/lib/store';

type ThemeCtx = {
  mode: ThemeMode;
  resolved: 'dark' | 'light';
  colors: ThemePalette;
  setMode: (next: ThemeMode) => Promise<void>;
};

const Ctx = createContext<ThemeCtx>({
  mode: 'dark',
  resolved: 'dark',
  colors: Colors.dark,
  setMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const osScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    let alive = true;
    loadThemeMode().then((m) => {
      if (alive) setModeState(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setMode = async (next: ThemeMode) => {
    setModeState(next);
    await saveThemeMode(next);
  };

  const resolved: 'dark' | 'light' =
    mode === 'system' ? (osScheme === 'light' ? 'light' : 'dark') : mode === 'light' ? 'light' : 'dark';

  const colors = resolved === 'light' ? Colors.light : Colors.dark;

  // Sync web root canvas, color-scheme, and dynamic meta theme-color tags
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.colorScheme = resolved;
    root.style.backgroundColor = colors.bg;
    root.style.color = colors.text;
    document.body.style.backgroundColor = colors.bg;
    document.body.style.color = colors.text;
    document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => {
      tag.setAttribute('content', colors.bg);
    });
  }, [resolved, colors.bg, colors.text]);

  const value = useMemo(() => ({ mode, resolved, colors, setMode }), [mode, resolved, colors]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useThemeMode() {
  return useContext(Ctx);
}

export function useOverrideTheme() {
  return useContext(Ctx);
}

export function useResolvedScheme(): 'dark' | 'light' {
  return useContext(Ctx).resolved;
}
