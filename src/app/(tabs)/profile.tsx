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
  Screen, Card, Txt, Eyebrow, Enter, Tap, NavRow, PageHeader, useTheme,
} from '@/components/ui';
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
    <Screen>
      <Enter index={0}><PageHeader title="You" /></Enter>

      <Enter index={1}>
        <Tap onPress={() => !premium && router.push('/paywall')} disabled={premium} accessibilityLabel="Subscription">
          <View style={[s.plan, { backgroundColor: premium ? c.accent : c.surface, borderColor: premium ? c.accent : c.line }]}>
            <Icon name="crown" size={20} color={premium ? c.onAccent : c.textFaint} />
            <View style={{ flex: 1, marginLeft: Space.md }}>
              <Txt variant="subheading" color={premium ? c.onAccent : c.text}>
                {premium ? 'Premium' : 'Free plan'}
              </Txt>
              <Txt variant="small" color={premium ? c.onAccent : c.textDim} style={{ marginTop: 2, opacity: premium ? 0.8 : 1 }}>
                {premium ? 'Unlimited plans' : quota ? `${quota.remaining} of ${quota.limit} plans left this week` : ''}
              </Txt>
            </View>
            {!premium && <Icon name="chevronRight" size={18} color={c.textFaint} />}
          </View>
        </Tap>
      </Enter>

      {/* What the app knows about you and what it does with it. */}
      <Enter index={2} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>Your setup</Eyebrow>
        <NavRow
          icon="user"
          title="Body"
          sub={`${profile.weight_kg} kg · ${profile.height_cm} cm · ${profile.age}`}
          onPress={() => router.push('/you/body')}
        />
        <NavRow
          icon="clock"
          title="Your day"
          sub={`${profile.omad_window_start}–${windowEnd} · ${24 - profile.omad_window_hours}h fast`}
          onPress={() => router.push('/you/day')}
        />
        <NavRow
          icon="chart"
          title="Targets"
          sub={`${targets.kcal} kcal · ${targets.protein_g} g protein`}
          onPress={() => router.push('/you/targets')}
        />
        <NavRow
          icon="bell"
          title="Reminders"
          sub={
            !remindersSupported()
              ? 'App only'
              : remindOn
              ? `On · ${queued} scheduled`
              : 'Off'
          }
          onPress={() => router.push('/you/reminders')}
        />
      </Enter>

      {/* Everything above is about the person; everything below is about where
          the data lives. Ten cards in a row read as a junk drawer without this
          break. */}
      <Enter index={3} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>Your data</Eyebrow>
        <NavRow
          icon="sync"
          title="Sync"
          sub={syncedAt ? `Last synced ${ago(syncedAt)}` : 'Not set up'}
          onPress={() => router.push('/you/sync')}
        />
        <NavRow
          icon="share"
          title="Export, restore, delete"
          sub="Everything lives on this device"
          onPress={() => router.push('/you/data')}
        />
      </Enter>

      <Enter index={4} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>About</Eyebrow>
        <Card>
          <Tap onPress={() => router.push('/about')} accessibilityLabel="About OMAD">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>About OMAD</Txt>
              <View style={s.value}>
                <Txt variant="data" color={c.accent}>Read</Txt>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </View>
          </Tap>
          <Tap onPress={() => router.push('/legal?tab=privacy')} accessibilityLabel="Privacy">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>Privacy</Txt>
              <Icon name="chevronRight" size={16} color={c.textFaint} />
            </View>
          </Tap>
          <Tap onPress={() => router.push('/legal?tab=imprint')} accessibilityLabel="Imprint">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>Imprint</Txt>
              <Icon name="chevronRight" size={16} color={c.textFaint} />
            </View>
          </Tap>
          {/* The landing page was fully designed and reachable only by URL. */}
          <Tap onPress={() => router.push('/landing')} accessibilityLabel="What this app is for">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>What this app is for</Txt>
              <Icon name="chevronRight" size={16} color={c.textFaint} />
            </View>
          </Tap>
          <View style={s.row}>
            <Txt variant="body" color={c.textDim}>Version</Txt>
            <Txt variant="data" color={c.textFaint}>1.0.0</Txt>
          </View>
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base },
  value: { flexDirection: 'row', alignItems: 'center' },
  plan: {
    flexDirection: 'row', alignItems: 'center', padding: Space.base,
    borderRadius: Radius.md, borderWidth: 1,
  },
});
