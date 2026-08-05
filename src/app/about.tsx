import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import { Screen, Card, Txt, Eyebrow, Enter, Tap, Divider, useTheme } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PROTOCOLS } from '@/lib/nutrition';

/**
 * What this approach is, and what it is not.
 *
 * Rules this page is written to, and they are not stylistic:
 *
 * - No invented numbers. No study percentages, success rates, user counts or
 *   testimonials. If a figure is not computed from the user's own data, it does
 *   not appear.
 * - Mechanism, never promise. "One meal is one set of decisions" is
 *   describable. "OMAD burns more fat" is not, and is not true as stated.
 * - Who should not do this comes near the top, in full weight. Burying it under
 *   the benefits is how a nutrition app does harm.
 */

const NOT_FOR = [
  'Pregnancy or breastfeeding',
  'Diabetes, particularly on insulin or sulfonylureas',
  'A history of disordered eating',
  'Medication for blood pressure or blood glucose',
  'Under 18',
];

const PLAUSIBLE = [
  {
    title: 'Fewer decisions',
    body: 'One meal is one set of choices a day. People who struggle with grazing rather than with portions often find that easier to hold to.',
  },
  {
    title: 'Structure instead of willpower',
    body: 'A short window makes overeating take deliberate effort. The limit comes from the clock rather than from resisting food all day.',
  },
  {
    title: 'A predictable schedule around training',
    body: 'If the session is always at the same time, the meal can be placed against it deliberately. That is the part this app exists to work out.',
  },
];

const DOES_NOT = [
  {
    title: 'It is not a shortcut past total intake',
    body: 'A large enough single meal is still a large enough day. The window changes when you eat, not the arithmetic.',
  },
  {
    title: 'It does not build muscle on its own',
    body: 'Protein and training do that, and one window makes both harder to fit in — which is why the protein target here is set high.',
  },
  {
    title: 'It is not metabolically superior to the same food spread out',
    body: 'Where OMAD works, the honest explanation is usually adherence: it suits how some people eat. That is a good enough reason on its own.',
  },
];

export default function AboutScreen() {
  const c = useTheme();
  const router = useRouter();

  return (
    <Screen tabBar={false} edges={['top', 'bottom']}>
      <Enter index={0}>
        <View style={s.header}>
          <Tap onPress={() => router.back()} accessibilityLabel="Back">
            <View style={s.back}><Icon name="chevronLeft" size={20} color={c.text} /></View>
          </Tap>
          <Txt variant="subheading">About OMAD</Txt>
        </View>
      </Enter>

      <Enter index={1}>
        <Txt variant="title" style={{ marginTop: Space.base }}>One window, one long fast</Txt>
        <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
          One meal a day means a single eating window with a long fast around it. The window length is
          the only thing that changes between the named protocols. The food still has to add up, and
          this app spends most of its effort on making sure it does.
        </Txt>
      </Enter>

      {/* Deliberately the second thing on the page, not the last. */}
      <Enter index={2}>
        <Card style={{ marginTop: Space.xl }} tone="ember">
          <View style={s.rowCentre}>
            <Icon name="alert" size={18} color={c.ember} />
            <Txt variant="subheading" style={{ marginLeft: Space.sm }}>Not for everyone</Txt>
          </View>
          <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
            Talk to a clinician before starting, or skip this approach, if any of these apply to you:
          </Txt>
          {NOT_FOR.map((item) => (
            <View key={item} style={s.bulletRow}>
              <View style={[s.dot, { backgroundColor: c.ember }]} />
              <Txt variant="body" style={s.bulletText}>{item}</Txt>
            </View>
          ))}
          <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
            Long fasts change how some medicines behave. That is a conversation with whoever
            prescribed them, not with an app.
          </Txt>
        </Card>
      </Enter>

      <Enter index={3}>
        <Eyebrow style={s.sectionLabel}>The protocols</Eyebrow>
        <Card style={{ paddingVertical: Space.sm }}>
          {PROTOCOLS.map((proto, i) => (
            <View key={proto.id}>
              {i > 0 && <Divider />}
              <View style={s.protoRow}>
                <View style={s.flex}>
                  <Txt variant="bodyMedium">{proto.label}</Txt>
                  <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>{proto.note}</Txt>
                </View>
                <Txt variant="data" color={c.accent} style={{ marginLeft: Space.md }}>
                  {24 - proto.windowHours}:{proto.windowHours}
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      </Enter>

      <Enter index={4}>
        <Eyebrow style={s.sectionLabel}>What it can plausibly help with</Eyebrow>
        <Card>
          {PLAUSIBLE.map((item, i) => (
            <View key={item.title} style={{ marginTop: i === 0 ? 0 : Space.base }}>
              <Txt variant="bodyMedium">{item.title}</Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 3 }}>{item.body}</Txt>
            </View>
          ))}
        </Card>
      </Enter>

      <Enter index={5}>
        <Eyebrow style={s.sectionLabel}>What it does not do</Eyebrow>
        <Card>
          {DOES_NOT.map((item, i) => (
            <View key={item.title} style={{ marginTop: i === 0 ? 0 : Space.base }}>
              <Txt variant="bodyMedium">{item.title}</Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 3 }}>{item.body}</Txt>
            </View>
          ))}
        </Card>
      </Enter>

      <Enter index={6}>
        <Txt variant="small" color={c.textFaint} style={s.footer}>
          General information about a way of eating, not medical advice, and not a diagnosis or
          treatment for anything.
        </Txt>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: Space.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: Space.xs },
  rowCentre: { flexDirection: 'row', alignItems: 'center' },
  sectionLabel: { marginTop: Space.xl, marginBottom: Space.md },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: Space.sm },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 9, marginRight: Space.md },
  bulletText: { flex: 1 },
  protoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Space.md },
  footer: { marginTop: Space.xl, textAlign: 'center', lineHeight: 18 },
});
