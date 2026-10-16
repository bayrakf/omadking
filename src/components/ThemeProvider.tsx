/**
 * Provides a user-overridable theme mode that sits on top of the OS color scheme.
 * Wrap the entire app in <ThemeProvider> and call useOverrideTheme() to read/set.
 *
 * useTheme() in ui.tsx reads this context instead of useColorScheme() directly.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loadThemeMode, saveThemeMode, type ThemeMode } from '@/lib/store';

type ThemeContextValue = {
  /** The resolved scheme ('dark' | 'light') after applying the override. */
  resolved: 'dark' | 'light';
  /** The stored preference ('system' | 'dark' | 'light'). */
  mode: ThemeMode;
  setMode: (m: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  resolved: 'dark',
  mode: 'system',
  setMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    loadThemeMode().then((m) => {
      if (m === 'light') setModeState('light');
      else setModeState('dark');
    });
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    await saveThemeMode(m);
    setModeState(m);
  }, []);

  const resolved: 'dark' | 'light' = mode === 'light' ? 'light' : 'dark';

  return (
    <ThemeContext.Provider value={{ resolved, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useOverrideTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Resolved scheme — use this instead of useColorScheme() in useTheme(). */
export function useResolvedScheme(): 'dark' | 'light' {
  return useContext(ThemeContext).resolved;
}
