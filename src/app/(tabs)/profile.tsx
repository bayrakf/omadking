/**
 * An index, not a settings dump.
 *
 * This was eight titled cards and ten blocks, every one of them always
 * rendered. Someone opens it to change exactly one thing and scrolls past nine
 * to reach it.
 *
 * The rule that makes this a gain rather than just hiding: **every row carries
 * its own current value**. The most common visit is not "change my window", it
 * is "what is my window set to" — and that is answered here without a tap.
 * A row reading only "Reminders", with no state beside it, would have taken
 * something away and given nothing back.
 */

import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import {
  Screen, Columns, Card, Txt, Eyebrow, Enter, Tap, NavRow, PageHeader, useTheme, SegmentedControl,
} from '@/components/ui';
import { useLang } from '@/components/lang';
import { useOverrideTheme } from '@/components/ThemeProvider';
import { LANGS } from '@/lib/i18n';
import { Icon } from '@/components/icons';
import { toMinutes, fromMinutes, dailyTargets, DEFAULT_PROFILE, type UserProfile } from '@/lib/nutrition';
import { loadProfileOrDefault, getQuota, isPremium, type Quota } from '@/lib/store';
import { isEnabled as remindersOn, isSupported as remindersSupported, scheduledCount } from '@/lib/notify';
import { lastSyncedAt } from '@/lib/sync';

/** "2h ago" beats a timestamp on a row: the question is freshness, not when. */
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function ProfileScreen() {
  const c = useTheme();
  const { lang, t, chosen } = useLang();
  const { mode: themeMode, setMode: setThemeMode } = useOverrideTheme();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [premium, setPremium] = useState(false);
  const [remindOn, setRemindOn] = useState(false);
  const [queued, setQueued] = useState(0);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, q, prem, rOn, n, sy] = await Promise.all([
          loadProfileOrDefault(), getQuota(), isPremium(), remindersOn(), scheduledCount(),
          lastSyncedAt(),
        ]);
        if (!active) return;
        setProfile(p); setQuota(q); setPremium(prem);
        setRemindOn(rOn); setQueued(n); setSyncedAt(sy); setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  if (!mounted) return null;

  const windowEnd = fromMinutes(toMinutes(profile.omad_window_start) + profile.omad_window_hours * 60);
  const targets = dailyTargets(profile, null);

  return (
    <Screen wide>
      <Enter index={0}><PageHeader title={t('you.title')} /></Enter>

      <Enter index={1}>
        <Tap onPress={() => !premium && router.push('/paywall')} disabled={premium} accessibilityLabel="Subscription">
          <View style={[s.plan, {
            backgroundColor: c.surface,
            borderColor: premium ? c.gold : c.line,
          }]}>
            <Icon name="crown" size={22} color={premium ? c.gold : c.textFaint} />
            <View style={{ flex: 1, marginLeft: Space.md }}>
              <Txt variant="subheading" color={premium ? c.gold : c.text}>
                {premium ? t('you.premiumActive') : lang === 'de' ? 'Basis-Plan' : 'Free Plan'}
              </Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                {premium
                  ? lang === 'de'
                    ? 'Unbegrenzte Pläne & gemessener Verbrauch'
                    : 'Unlimited plans & measured maintenance'
                  : quota
                  ? lang === 'de'
                    ? `${quota.remaining} von ${quota.limit} Plänen diese Woche frei`
                    : `${quota.remaining} of ${quota.limit} free plans remaining this week`
                  : ''}
              </Txt>
            </View>
            {!premium && (
              <View style={[s.upgradeBtn, { backgroundColor: c.accent }]}>
                <Txt variant="small" color={c.onAccent} style={{ fontWeight: '600' }}>{t('you.getPremium')}</Txt>
              </View>
            )}
          </View>
        </Tap>
      </Enter>

      {/* Körper & Fasten-Ziele + Einstellungen im Desktop 2-Spalten-Raster */}
      <Columns>
      <Enter index={2} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>{t('you.groupBody')}</Eyebrow>
        <NavRow
          icon="user"
          tone="body"
          title={t('you.body')}
          sub={`${profile.weight_kg} kg · ${profile.height_cm} cm · ${profile.age} ${lang === 'de' ? 'J.' : 'yr'}`}
          onPress={() => router.push('/you/body')}
        />
        <NavRow
          icon="clock"
          title={t('you.day')}
          sub={`${profile.omad_window_start}–${windowEnd} · ${24 - profile.omad_window_hours}h ${lang === 'de' ? 'Fasten' : 'fast'}`}
          onPress={() => router.push('/you/day')}
        />
        <NavRow
          icon="chart"
          tone="plan"
          title={t('you.targets')}
          sub={
            lang === 'de'
              ? `${targets.kcal} kcal · ${targets.protein_g} g Protein`
              : `${targets.kcal} kcal · ${targets.protein_g} g protein`
          }
          onPress={() => router.push('/you/targets')}
        />
        <NavRow
          icon="crown"
          tone="gold"
          title={t('achievements.title')}
          sub={lang === 'de' ? 'Meilensteine, Trophäen & Fasten-Serien' : 'Milestones, trophies & fasting streaks'}
          onPress={() => router.push('/achievements')}
        />
      </Enter>

      <View>
      {/* Erinnerungen */}
      <Enter index={3} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>{t('you.groupNotifications')}</Eyebrow>
        <NavRow
          icon="bell"
          title={t('you.reminders')}
          sub={
            !remindersSupported()
              ? lang === 'de'
                ? 'Nur native App'
                : 'App only'
              : remindOn
              ? lang === 'de'
                ? `Aktiv · ${queued} geplant`
                : `On · ${queued} scheduled`
              : lang === 'de'
              ? 'Aus'
              : 'Off'
          }
          onPress={() => router.push('/you/reminders')}
        />
      </Enter>

      {/* Daten & Cloud */}
      <Enter index={4} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>{t('you.groupData')}</Eyebrow>
        <NavRow
          icon="flame"
          title={t('health.title')}
          sub={lang === 'de' ? 'Schritte, Aktivität & Waage' : 'Steps, activity & smart scale'}
          onPress={() => router.push('/health')}
        />
        <NavRow
          icon="sync"
          title={t('you.sync')}
          sub={
            syncedAt
              ? lang === 'de'
                ? `Zuletzt synchronisiert ${ago(syncedAt)}`
                : `Last synced ${ago(syncedAt)}`
              : lang === 'de'
              ? 'Nicht eingerichtet'
              : 'Not set up'
          }
          onPress={() => router.push('/you/sync')}
        />
        <NavRow
          icon="share"
          title={t('you.export')}
          sub={t('you.exportSub')}
          onPress={() => router.push('/you/data')}
        />
        <NavRow
          icon="coach"
          title={t('you.language')}
          sub={chosen === null ? t('you.languageFollows') : (LANGS.find((l) => l.id === chosen)?.endonym ?? '')}
          onPress={() => router.push('/you/language')}
        />

        {/* Theme mode selection */}
        <View style={{ marginTop: Space.md }}>
          <Eyebrow color={c.textDim} style={{ marginBottom: Space.xs, marginLeft: 2 }}>
            {lang === 'de' ? 'Erscheinungsbild' : 'Theme'}
          </Eyebrow>
          <SegmentedControl
            values={[
              { id: 'system', label: lang === 'de' ? 'System' : 'System' },
              { id: 'dark', label: lang === 'de' ? 'Dunkel' : 'Dark', icon: 'moon' },
              { id: 'light', label: lang === 'de' ? 'Hell' : 'Light' },
            ]}
            selected={themeMode}
            onSelect={(m) => setThemeMode(m as any)}
            tone="accent"
          />
        </View>
      </Enter>

      {/* Über die App & Rechtliches */}
      <Enter index={5} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>{t('you.groupAbout')}</Eyebrow>
        <Card>
          <Tap onPress={() => router.push('/about')} accessibilityLabel="About OMAD">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>{lang === 'de' ? 'Über OMAD' : 'About OMAD'}</Txt>
              <View style={s.value}>
                <Txt variant="data" color={c.accent}>{lang === 'de' ? 'Lesen' : 'Read'}</Txt>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </View>
          </Tap>
          <Tap onPress={() => router.push('/legal?tab=privacy')} accessibilityLabel="Privacy">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>{lang === 'de' ? 'Datenschutz' : 'Privacy'}</Txt>
              <Icon name="chevronRight" size={16} color={c.textFaint} />
            </View>
          </Tap>
          <Tap onPress={() => router.push('/legal?tab=imprint')} accessibilityLabel="Imprint">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>{lang === 'de' ? 'Impressum' : 'Imprint'}</Txt>
              <Icon name="chevronRight" size={16} color={c.textFaint} />
            </View>
          </Tap>
          <Tap onPress={() => router.push('/landing')} accessibilityLabel="What this app is for">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>{lang === 'de' ? 'Wofür diese App da ist' : 'What this app is for'}</Txt>
              <Icon name="chevronRight" size={16} color={c.textFaint} />
            </View>
          </Tap>
          <View style={s.row}>
            <Txt variant="body" color={c.textDim}>Version</Txt>
            <Txt variant="data" color={c.textFaint}>1.0.0</Txt>
          </View>
        </Card>
      </Enter>
      </View>
      </Columns>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base },
  value: { flexDirection: 'row', alignItems: 'center' },
  plan: {
    flexDirection: 'row', alignItems: 'center', padding: Space.base,
    borderRadius: Radius.lg, borderWidth: 1,
  },
  upgradeBtn: {
    paddingHorizontal: Space.md,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
});
