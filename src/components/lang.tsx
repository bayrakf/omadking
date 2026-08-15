/**
 * The chosen language, available synchronously to every screen.
 *
 * The setting lives in the profile, which is read from AsyncStorage, so it
 * arrives one tick after the first render. Every screen reading it for itself
 * would mean every screen rendering English once and then correcting itself —
 * a visible flicker on each navigation, and five copies of the same read.
 *
 * So it is loaded once here and pushed down. `setLang` writes the profile and
 * updates the context in the same breath, which is what makes the switch feel
 * like a switch: the screen behind it is already translated when the tap
 * finishes, rather than after the next navigation.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { t as translate, pickLang, type Key, type Lang, type Vars } from '@/lib/i18n';
import { loadProfileOrDefault, saveProfile } from '@/lib/store';

/**
 * What the device is set to, or null if the platform will not say.
 *
 * `Intl` rather than `expo-localization`: it is already present on both
 * targets — Hermes ships it, and the browser has always had it — so asking it
 * costs no dependency and no `.web.ts` twin. The only thing needed here is the
 * language tag, which is the one thing `resolvedOptions()` is guaranteed to
 * carry.
 */
function deviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    return null;
  }
}

type LangValue = {
  /** The language actually in use, device fallback already applied. */
  lang: Lang;
  /** What was chosen, or null while following the device. */
  chosen: Lang | null;
  setLang: (next: Lang | null) => Promise<void>;
  t: (key: Key, vars?: Vars) => string;
};

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [chosen, setChosen] = useState<Lang | null>(null);
  /**
   * Nothing renders until the stored choice is known.
   *
   * "Not loaded yet" and "following the device" are both `null`, and rendering
   * the first is indistinguishable from rendering the second — so on a German
   * phone, somebody who had deliberately chosen English got a frame of German
   * on every cold start. One storage read is cheaper than that, and the root
   * layout is already waiting on fonts and the onboarding flag anyway.
   */
  const [loaded, setLoaded] = useState(false);
  const locale = deviceLocale();

  useEffect(() => {
    let active = true;
    loadProfileOrDefault()
      .then((p) => {
        if (active) setChosen(p.language);
      })
      // A failed read must not leave the app with nothing on screen. Falling
      // through to the device language is exactly what a fresh install does.
      .catch(() => {})
      .then(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback(async (next: Lang | null) => {
    // The context first: the tap should land before the disk does.
    setChosen(next);
    const p = await loadProfileOrDefault();
    await saveProfile({ ...p, language: next });
  }, []);

  const value = useMemo<LangValue>(() => {
    const lang = pickLang(chosen, locale);
    return { lang, chosen, setLang, t: (key, vars) => translate(lang, key, vars) };
  }, [chosen, locale, setLang]);

  return <LangContext.Provider value={value}>{loaded ? children : null}</LangContext.Provider>;
}

/**
 * Outside the provider the app still has to render something readable, so this
 * falls back to the device rather than throwing. A missing provider shows up
 * as a screen that ignores the setting, which is a bug worth seeing, not worth
 * crashing over.
 */
export function useLang(): LangValue {
  const ctx = useContext(LangContext);
  const locale = deviceLocale();
  if (ctx) return ctx;
  const lang = pickLang(null, locale);
  return {
    lang,
    chosen: null,
    setLang: async () => {},
    t: (key, vars) => translate(lang, key, vars),
  };
}

/** The common case: just the phrase. */
export function useT(): (key: Key, vars?: Vars) => string {
  return useLang().t;
}
