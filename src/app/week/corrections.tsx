/**
 * Putting the week right.
 *
 * The week tab was nine cards, and four of them were not readings at all —
 * they were the places you go to fix something. Mixing "here is what happened"
 * with "here is where you correct what happened" made the screen twice as long
 * and neither half easy to find.
 *
 * Every one of these has a primary path elsewhere: the evening question and the
 * weigh-in prompt are both on Today. This is the second way in, for the day you
 * mistapped or the morning you forgot — which is exactly why it can live one
 * tap away without costing anyone anything.
 *
 * A correction here only refreshes the strips on this screen. Everything
 * derived from them — the review, the adaptation phase, the streak, the
 * measurement — recomputes when Progress is focused again, which is the same
 * path a cold open takes.
 */

import { useCallback, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Tap, Notice, PageHeader, useTheme,
} from '@/components/ui';
import { DEFAULT_PROFILE, dailyTargets, type UserProfile } from '@/lib/nutrition';
import {
  loadProfileOrDefault, saveProfile, loadWeightLog, saveWeightLog,
  loadFastLog, markFastComplete, unmarkFastComplete,
  loadIntakeLog, recordIntake, clearIntake,
  loadOutliers, markOutlier, unmarkOutlier, todayISO, type WeightEntry,
} from '@/lib/store';
import {
  intakeWeek, fastWeek, nextIntakeFactor, intakeLabel, intakeGlyph,
  type IntakeDay, type FastDay,
} from '@/lib/review';

export default function CorrectionsScreen() {
  const c = useTheme();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [eaten, setEaten] = useState<IntakeDay[]>([]);
  const [week, setWeek] = useState<FastDay[]>([]);
  const [outliers, setOutliers] = useState<string[]>([]);
  const [dayKcal, setDayKcal] = useState(0);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(todayISO());
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const p = await loadProfileOrDefault();
        const [log, fasts, intake, skip] = await Promise.all([
          loadWeightLog(), loadFastLog(), loadIntakeLog(), loadOutliers(),
        ]);
        if (!active) return;
        setProfile(p);
        setEntries(log);
        setEaten(intakeWeek(intake));
        setWeek(fastWeek(fasts));
        setOutliers(skip);
        setDayKcal(dailyTargets(p, null).kcal);
        setDateInput(todayISO());
        setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  if (!mounted) return null;

  const toggleDay = async (dayDate: string, logged: boolean) => {
    const next = logged ? await unmarkFastComplete(dayDate) : await markFastComplete(dayDate);
    setWeek(fastWeek(next));
  };

  const cycleIntake = async (dayDate: string, current: number | null) => {
    const next = nextIntakeFactor(current);
    const log = next === null ? await clearIntake(dayDate) : await recordIntake(next, dayKcal, dayDate);
    setEaten(intakeWeek(log));
  };

  const toggleOutlier = async (dayDate: string) => {
    const next = outliers.includes(dayDate)
      ? await unmarkOutlier(dayDate)
      : await markOutlier(dayDate);
    setOutliers(next);
  };

  const save = async () => {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (!isFinite(w) || w < 30 || w > 300) return setMsg({ text: 'Enter a weight between 30 and 300 kg.', ok: false });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput) || isNaN(new Date(dateInput).getTime()))
      return setMsg({ text: 'Dates use the format YYYY-MM-DD.', ok: false });
    if (dateInput > todayISO()) return setMsg({ text: 'That date is in the future.', ok: false });

    const updated = [
      { id: `${dateInput}-${Date.now()}`, date: dateInput, weight_kg: w },
      ...entries.filter((e) => e.date !== dateInput),
    ].sort((a, b) => b.date.localeCompare(a.date));

    setEntries(updated);
    await saveWeightLog(updated);

    // Keep targets following real bodyweight — but only when logging today, so
    // back-filling an old entry never rewrites the current profile.
    if (dateInput === todayISO()) {
      const next = { ...profile, weight_kg: w };
      await saveProfile(next);
      setProfile(next);
    }
    setWeightInput('');
    setMsg({ text: 'Logged.', ok: true });
  };

  return (
    <Screen tabBar={false}>
      <Enter index={0}>
        <PageHeader
          tone="body"
          back={true}
          eyebrow="This week"
          title="Corrections"
          sub="A mistap, a forgotten morning, or a week that was nothing like the rest."
        />
      </Enter>

      <Enter index={1}>
        <Card style={{ marginBottom: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.md }}>Log a weigh-in</Eyebrow>
          <View style={s.inputs}>
            <View style={s.inputCol}>
              <Txt variant="small" color={c.textDim} style={{ marginBottom: 6 }}>Date</Txt>
              <TextInput
                value={dateInput}
                onChangeText={setDateInput}
                placeholder={todayISO()}
                placeholderTextColor={c.textFaint}
                accessibilityLabel="Date"
                style={[s.input, Type.data, { color: c.text, backgroundColor: c.well, borderColor: c.line }]}
              />
            </View>
            <View style={s.inputCol}>
              <Txt variant="small" color={c.textDim} style={{ marginBottom: 6 }}>Weight (kg)</Txt>
              <TextInput
                value={weightInput}
                onChangeText={setWeightInput}
                onSubmitEditing={save}
                placeholder="82.4"
                placeholderTextColor={c.textFaint}
                keyboardType="numeric"
                inputMode="decimal"
                accessibilityLabel="Weight in kilograms"
                style={[s.input, Type.data, { color: c.text, backgroundColor: c.well, borderColor: c.line }]}
              />
            </View>
          </View>
          <Button label="Save entry" onPress={save} style={{ marginTop: Space.base }} />
          {msg && <Notice tone={msg.ok ? 'ok' : 'error'}>{msg.text}</Notice>}
        </Card>
      </Enter>

      {/* The measured maintenance is built on these answers, so a mistap does
          not merely look wrong, it moves the number the app tells you to eat.
          Tapping cycles through the answers and back to nothing, so an answer
          can be taken back rather than only replaced. */}
      <Enter index={2}>
        <Card style={{ marginBottom: Space.base }}>
          <View style={s.split}>
            <Eyebrow>Evenings this week</Eyebrow>
            <Txt variant="data" color={c.textFaint}>tap to correct</Txt>
          </View>
          <View style={s.weekRow}>
            {eaten.map((d) => (
              <Tap
                key={d.date}
                onPress={d.future ? undefined : () => cycleIntake(d.date, d.factor)}
                disabled={d.future}
                accessibilityLabel={`${d.date}: ${intakeLabel(d.factor)}`}
                style={s.weekCell}
              >
                <View style={s.weekCellInner}>
                  <Txt variant="small" color={c.textFaint}>{d.label}</Txt>
                  <View
                    style={[
                      s.weekDot,
                      {
                        backgroundColor: d.factor === null ? 'transparent' : c.accent,
                        borderColor: d.future ? c.line : d.factor === null ? c.lineStrong : c.accent,
                        opacity: d.future ? 0.4 : 1,
                      },
                    ]}
                  >
                    {d.factor !== null && (
                      <Txt variant="small" color={c.onAccent}>{intakeGlyph(d.factor)}</Txt>
                    )}
                  </View>
                </View>
              </Tap>
            ))}
          </View>
        </Card>
      </Enter>

      {/* Correctable, because a streak that cannot be fixed stops being true. */}
      <Enter index={3}>
        <Card style={{ marginBottom: Space.base }}>
          <View style={s.split}>
            <Eyebrow>Fasts this week</Eyebrow>
            <Txt variant="data" color={c.textFaint}>tap to correct</Txt>
          </View>
          <View style={s.weekRow}>
            {week.map((d) => (
              <Tap
                key={d.date}
                onPress={d.future ? undefined : () => toggleDay(d.date, d.logged)}
                disabled={d.future}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: d.logged, disabled: d.future }}
                accessibilityLabel={`Fast on ${d.date}`}
                style={s.weekCell}
              >
                <View style={s.weekCellInner}>
                  <Txt variant="small" color={c.textFaint}>{d.label}</Txt>
                  <View
                    style={[
                      s.weekDot,
                      {
                        backgroundColor: d.logged ? c.accent : 'transparent',
                        borderColor: d.future ? c.line : d.logged ? c.accent : c.lineStrong,
                        opacity: d.future ? 0.4 : 1,
                      },
                    ]}
                  />
                </View>
              </Tap>
            ))}
          </View>
        </Card>
      </Enter>

      {/* Ill, travelling, a wedding. Comparing a flu week against a normal one
          answers a question nobody asked. The heading states the limit rather
          than hiding it: this changes what the app compares, never what it
          measured — anyone who could exclude days from the measurement could
          mark their way to a number that flatters them. */}
      <Enter index={4}>
        <Card style={{ marginBottom: Space.base }}>
          <View style={s.split}>
            <Eyebrow>Days to leave out</Eyebrow>
            <Txt variant="data" color={c.textFaint}>comparisons only</Txt>
          </View>
          <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
            Ill, away, or a day that was nothing like the rest. It comes out of the comparisons.
            What your body measured stays exactly as it was.
          </Txt>
          <View style={s.weekRow}>
            {eaten.map((d) => {
              const skipped = outliers.includes(d.date);
              return (
                <Tap
                  key={d.date}
                  onPress={d.future ? undefined : () => toggleOutlier(d.date)}
                  disabled={d.future}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: skipped, disabled: d.future }}
                  accessibilityLabel={`Leave out ${d.date}`}
                  style={s.weekCell}
                >
                  <View style={s.weekCellInner}>
                    <Txt variant="small" color={c.textFaint}>{d.label}</Txt>
                    <View
                      style={[
                        s.weekDot,
                        {
                          backgroundColor: skipped ? c.textFaint : 'transparent',
                          borderColor: d.future ? c.line : skipped ? c.textFaint : c.lineStrong,
                          opacity: d.future ? 0.4 : 1,
                        },
                      ]}
                    />
                  </View>
                </Tap>
              );
            })}
          </View>
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekRow: { flexDirection: 'row', marginTop: Space.base, marginRight: -Space.xs },
  weekCell: { flex: 1, marginRight: Space.xs },
  weekCellInner: { alignItems: 'center' },
  weekDot: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  inputs: { flexDirection: 'row', marginRight: -Space.md },
  inputCol: { flex: 1, marginRight: Space.md },
  input: { height: 48, borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: Space.md, fontSize: 15 },
});
