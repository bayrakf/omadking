import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Space, Radius, Type, MaxContentWidth } from '@/constants/theme';
import { Txt, Eyebrow, Enter, Button, Divider } from '@/components/ui';
import { Icon } from '@/components/icons';
import DayDial from '@/components/DayDial';
import { FREE_PLANS_PER_WEEK } from '@/lib/store';

/**
 * The hero is the dial itself, showing a real 18:00–20:00 window against a
 * 22-hour fast. Leading with the product's own instrument says what the app is
 * faster than a headline about "AI-powered nutrition" ever could.
 */
/**
 * The three of these that shipped first sold timing, session-aware macros and
 * reheat instructions. All three are real, all three are free, and all three
 * are things a dozen other apps also do — so the page described a commodity
 * and never said the one thing no competitor can say.
 *
 * The measurement leads now. It is the reason the app exists and the only
 * reason to pay for it; the checks in `demo()` below refuse a list that is once
 * again nothing but free features.
 */
const VALUE = [
  {
    icon: 'flame' as const,
    title: 'It measures what you burn',
    body: 'Most apps hand you a formula on day one and never revisit it. This one reads your own eating and weigh-ins back and works out what your body actually costs — and says how many days it still needs before it will claim a figure.',
  },
  {
    icon: 'clock' as const,
    title: 'Timing, not guesswork',
    body: 'Tell it when you train. It decides whether you eat before, after, or split around the session, and gives you the clock times.',
  },
  {
    icon: 'dumbbell' as const,
    title: 'Macros that follow the work',
    body: 'Two hours all-out and a rest day are not the same target. Duration and intensity feed straight into the numbers.',
  },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // The marketing page commits to dark in both schemes.
  const c = Colors.dark;

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <View style={s.nav}>
            <Txt variant="subheading" color={c.text}>OMADCoach</Txt>
            <Eyebrow color={c.textFaint}>Fasting · Training</Eyebrow>
          </View>
        </Enter>

        <Enter index={1}>
          <View style={s.hero}>
            <Eyebrow color={c.accent}>22 hours off · 2 hours on</Eyebrow>
            <Txt variant="hero" color={c.text} style={s.heroTitle}>
              Eat once.{'\n'}Time it right.
            </Txt>
            <Txt variant="body" color={c.textDim} style={s.heroBody}>
              For people who train hard in the evening on one meal a day. It works out when to eat
              around your session — and, once it has watched you long enough, what your body actually
              costs instead of what a formula assumes.
            </Txt>
          </View>
        </Enter>

        <Enter index={2}>
          <View style={s.dialWrap}>
            <DayDial
              size={250}
              nowMin={17 * 60 + 20}
              windowStartMin={18 * 60}
              windowLengthMin={120}
              trainingStartMin={18 * 60 + 30}
              trainingDurationMin={60}
              isEating={false}
              headline="0h 40m"
              caption="until the window opens"
            />
            <Eyebrow color={c.textFaint} style={{ textAlign: 'center', marginTop: Space.base }}>
              18:00–20:00 · 22H FAST · SESSION 18:30
            </Eyebrow>
          </View>
        </Enter>

        <Enter index={3}>
          <View style={{ marginTop: Space.section }}>
            <Button label="Get started — free" onPress={() => router.replace('/onboarding')} />
            <Txt variant="small" color={c.textFaint} style={s.note}>
              {FREE_PLANS_PER_WEEK} meal plans a week on the free tier. No account needed — your data stays on
              your device.
            </Txt>
          </View>
        </Enter>

        <Enter index={4}>
          <View style={{ marginTop: Space.section }}>
            {VALUE.map((v, i) => (
              <View key={v.title}>
                {i > 0 && <Divider style={{ marginVertical: Space.xl }} />}
                <View style={s.valueRow}>
                  <View style={[s.valueIcon, { borderColor: c.line }]}>
                    <Icon name={v.icon} size={18} color={c.accent} />
                  </View>
                  <View style={s.flex}>
                    <Txt variant="subheading" color={c.text}>{v.title}</Txt>
                    <Txt variant="body" color={c.textDim} style={{ marginTop: Space.sm }}>{v.body}</Txt>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Enter>

        <Enter index={5}>
          <View style={s.footer}>
            <Button label="Start your first plan" onPress={() => router.replace('/onboarding')} />
            <Txt variant="small" color={c.textFaint} style={s.disclaimer}>
              General nutrition and training guidance, not medical advice. Talk to a clinician before starting
              extended fasting, particularly during pregnancy, with diabetes, or alongside medication.
            </Txt>
            <Eyebrow color={c.textFaint} style={{ textAlign: 'center', marginTop: Space.xl }}>
              © {new Date().getFullYear()} OMADCoach
            </Eyebrow>
          </View>
        </Enter>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Space.lg, paddingBottom: Space.hero,
    maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%',
  },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Space.lg,
  },
  hero: { paddingTop: Space.xxl },
  heroTitle: { marginTop: Space.base, fontSize: 46, lineHeight: 50, letterSpacing: -1.4 },
  heroBody: { marginTop: Space.lg },
  dialWrap: { marginTop: Space.section, alignItems: 'center' },
  note: { textAlign: 'center', marginTop: Space.base },
  valueRow: { flexDirection: 'row', alignItems: 'flex-start' },
  valueIcon: {
    width: 40, height: 40, borderRadius: Radius.sm, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginRight: Space.base,
  },
  footer: { marginTop: Space.section },
  disclaimer: { textAlign: 'center', marginTop: Space.xl, lineHeight: 18 },
});
