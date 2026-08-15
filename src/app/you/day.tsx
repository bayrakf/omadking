/**
 * When the window opens, how long it stays open, and when training usually is.
 *
 * These three decide every time the app ever shows: the countdown, the agenda,
 * the reminders, and which side of the session the meal lands on. They belong
 * together because changing one without seeing the others is how someone ends
 * up with a meal scheduled mid-workout.
 */

import { View, StyleSheet } from 'react-native';
import { Screen, Card, Txt, Eyebrow, Enter, Chip, Divider, PageHeader, useTheme } from '@/components/ui';
import { useProfileEditor } from '@/components/profile-fields';
import { Space, Radius } from '@/constants/theme';
import { PROTOCOLS, protocolForHours, toMinutes, fromMinutes } from '@/lib/nutrition';

export default function DayScreen() {
  const c = useTheme();
  const { profile, mounted, persist, row } = useProfileEditor();

  if (!mounted) return null;

  const windowEnd = fromMinutes(toMinutes(profile.omad_window_start) + profile.omad_window_hours * 60);
  const named = protocolForHours(profile.omad_window_hours);

  return (
    <Screen tabBar={false}>
      <Enter index={0}>
        <PageHeader tone="accent" eyebrow="You" title="Your day" sub="When the window opens, and for how long." />
      </Enter>

      <Enter index={1}>
        <Card>
          <Eyebrow style={{ marginBottom: Space.sm }}>Window</Eyebrow>
          {row('Opens', 'omad_window_start')}
          <Divider />
          {row('Length', 'omad_window_hours', ' h')}
          <View style={s.wrap}>
            {PROTOCOLS.map((proto) => (
              <Chip
                key={proto.id}
                label={proto.label}
                selected={profile.omad_window_hours === proto.windowHours}
                onPress={() => persist({ ...profile, omad_window_hours: proto.windowHours })}
                style={s.chip}
              />
            ))}
          </View>
          {/* A hand-typed length that matches nothing keeps working; it simply
              has no name to show. */}
          {named && (
            <Txt variant="small" color={c.textDim} style={{ marginBottom: Space.sm }}>
              {named.note}
            </Txt>
          )}
          <Divider />
          {row('Usual training', 'default_training_time')}
          <View style={[s.summary, { backgroundColor: c.well }]}>
            <Txt variant="data" color={c.accent}>
              {profile.omad_window_start}–{windowEnd}
            </Txt>
            <Txt variant="data" color={c.textFaint}>{24 - profile.omad_window_hours}h fast</Txt>
          </View>
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -Space.sm },
  chip: { marginRight: Space.sm, marginBottom: Space.sm },
  summary: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: Space.md, borderRadius: Radius.sm, marginTop: Space.base,
  },
});
