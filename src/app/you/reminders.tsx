/**
 * The one switch, and what it schedules.
 *
 * Reminders are local notifications built from the agenda, so the count under
 * the switch is the honest measure of whether it is working: "on" with nothing
 * queued means something is wrong, and that is worth being able to see.
 */

import { useState } from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { Screen, Card, Txt, Eyebrow, Enter, Notice, PageHeader, useTheme } from '@/components/ui';
import { useProfileEditor } from '@/components/profile-fields';
import { Space } from '@/constants/theme';
import {
  isSupported as remindersSupported, isEnabled as remindersOn,
  setEnabled as setReminders, scheduledCount,
} from '@/lib/notify';
import { loadLastPlan, loadFastLog, loadCookLog, todayISO } from '@/lib/store';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import type { MealPlan } from '@/lib/ai';

export default function RemindersScreen() {
  const c = useTheme();
  const { profile, mounted, queued, setQueued } = useProfileEditor();
  const [remindOn, setRemindOn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      remindersOn().then((v) => active && setRemindOn(v));
      return () => { active = false; };
    }, [])
  );

  const toggle = async (on: boolean) => {
    setNotice(null);
    const today = todayISO();
    const [plan, fastLog, cookLog] = await Promise.all([
      loadLastPlan<MealPlan>(), loadFastLog(), loadCookLog(),
    ]);
    const result = await setReminders(
      on,
      profile,
      plan?.date === today ? plan : null,
      { cooked: cookLog.includes(today), fastLogged: fastLog.includes(today) }
    );
    setRemindOn(result);
    setQueued(await scheduledCount());
    if (on && !result) {
      setNotice('Notifications are blocked. Turn them on for OMADCoach in your device settings.');
    }
  };

  if (!mounted) return null;

  return (
    <Screen tabBar={false}>
      <Enter index={0}>
        <PageHeader tone="accent" eyebrow="You" title="Reminders" sub="Local to this device. No account, no push token." />
      </Enter>

      <Enter index={1}>
        <Card>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: Space.base }}>
              <Txt variant="body">Tell me when to eat</Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                {!remindersSupported()
                  ? 'Only available in the iOS and Android apps.'
                  : remindOn
                  ? `${queued} reminder${queued === 1 ? '' : 's'} scheduled`
                  : 'Cooking, window opening, meal and last bite.'}
              </Txt>
            </View>
            <Switch
              value={remindOn}
              onValueChange={toggle}
              disabled={!remindersSupported()}
              trackColor={{ false: c.well, true: c.accentDim }}
              thumbColor={remindOn ? c.accent : '#FFFFFF'}
            />
          </View>
          {notice && <Notice tone="error">{notice}</Notice>}
        </Card>
      </Enter>

      <Enter index={2}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>What arrives</Eyebrow>
          <Txt variant="small" color={c.textDim}>
            The moments from today’s plan: when to start cooking, when the window opens, the meal
            itself, and the last bite before it closes. They are rebuilt every time the app comes
            forward, so a changed window changes them too.
          </Txt>
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base },
});
