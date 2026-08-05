import React, { useCallback, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Divider, Notice, PageHeader, Bar, Empty, Tap, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { DEFAULT_PROFILE, weeklyTrend, dailyTargets, type UserProfile } from '@/lib/nutrition';
import { measuredMaintenance, type Measurement } from '@/lib/energy';
import {
  loadProfileOrDefault, saveProfile, loadWeightLog, saveWeightLog,
  loadFastLog, loadCookLog, loadPlanHistory, markFastComplete, unmarkFastComplete,
  loadIntakeLog, isPremium, todayISO, type WeightEntry,
} from '@/lib/store';
import {
  weeklyReview, adaptationStage, fastWeek,
  type WeeklyReview, type AdaptationStage, type FastDay,
} from '@/lib/review';

/**
 * A trend line, not bars. Bodyweight is a noisy continuous signal, and a line
 * with a soft band is the honest way to show that the day-to-day scatter is not
 * the thing you should react to.
 */
function TrendChart({ entries, height = 132 }: { entries: WeightEntry[]; height?: number }) {
  const c = useTheme();
  const [width, setWidth] = useState(0);

  const points = [...entries].reverse().slice(-40);
  if (points.length < 2 || width === 0) {
    return <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} />;
  }

  const values = points.map((p) => p.weight_kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 10;

  const xy = points.map((p, i) => ({
    x: (i / (points.length - 1)) * (width - pad * 2) + pad,
    y: height - pad - ((p.weight_kg - min) / span) * (height - pad * 2),
  }));

  // Smooth with a simple midpoint curve — avoids the jagged look of raw joins.
  const line = xy.reduce((d, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const mx = (prev.x + p.x) / 2;
    return `${d} Q ${prev.x} ${prev.y} ${mx} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`;
  }, '');

  const area = `${line} L ${xy[xy.length - 1].x} ${height} L ${xy[0].x} ${height} Z`;
  const last = xy[xy.length - 1];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Svg width={width} height={height}>
        <Path d={area} fill={c.accentWash} />
        <Path d={line} stroke={c.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Circle cx={last.x} cy={last.y} r={5} fill={c.bg} />
        <Circle cx={last.x} cy={last.y} r={3} fill={c.accent} />
      </Svg>
    </View>
  );
}

export default function ProgressScreen() {
  const c = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(todayISO());
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [adapt, setAdapt] = useState<AdaptationStage | null>(null);
  const [week, setWeek] = useState<FastDay[]>([]);
  const [measured, setMeasured] = useState<Measurement | null>(null);
  const [premium, setPremium] = useState(false);
  const [fasts, setFasts] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, log, fasts, cooks, plans, intake, prem] = await Promise.all([
          loadProfileOrDefault(), loadWeightLog(), loadFastLog(), loadCookLog(),
          loadPlanHistory<{ date: string }>(), loadIntakeLog(), isPremium(),
        ]);
        if (!active) return;
        setProfile(p);
        setEntries(log);
        setPremium(prem);
        // The formula's answer is only a bound and a comparison here.
        setMeasured(measuredMaintenance(intake, log, dailyTargets(p, null).maintenance_kcal));
        setReview(weeklyReview(fasts, cooks, log, plans));
        setAdapt(adaptationStage(fasts));
        setFasts(fasts);
        setWeek(fastWeek(fasts));
        setDateInput(todayISO());
        setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  if (!mounted) return null;

  /** Correcting a day rewrites the streak, so everything derived is rebuilt. */
  const toggleDay = async (dayDate: string, logged: boolean) => {
    const next = logged ? await unmarkFastComplete(dayDate) : await markFastComplete(dayDate);
    setFasts(next);
    setWeek(fastWeek(next));
    setAdapt(adaptationStage(next));
    const [cooks, plans] = await Promise.all([loadCookLog(), loadPlanHistory<{ date: string }>()]);
    setReview(weeklyReview(next, cooks, entries, plans));
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

  const current = entries.length ? entries[0].weight_kg : profile.weight_kg;
  const start = entries.length ? entries[entries.length - 1].weight_kg : profile.weight_kg;
  const change = current - start;
  const trend = weeklyTrend(entries);

  const hM = profile.height_cm / 100;
  const bmi = current / (hM * hM);
  const bmiLabel = bmi < 18.5 ? 'Under' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Over' : 'Obese';

  const target =
    profile.goal === 'weight_loss' ? Math.round(22 * hM * hM * 10) / 10
    : profile.goal === 'muscle_gain' ? Math.round((start + 5) * 10) / 10
    : Math.round(start * 10) / 10;

  const good = profile.goal === 'weight_loss' ? change < 0 : profile.goal === 'muscle_gain' ? change > 0 : true;

  // Signed, not absolute. Using |current - start| filled the bar when the user
  // moved *away* from the target — 82kg on a climb to 89kg showed 48% done.
  const span = target - start;
  const moved = current - start;
  const pct = span === 0 ? 100 : Math.min(100, Math.max(0, (moved / span) * 100));

  return (
    <Screen>
      <Enter index={0}>
        <PageHeader
          eyebrow={entries.length ? `${entries.length} entries logged` : 'No entries yet'}
          title="Progress"
        />
      </Enter>

      {/* The reason to pay, and it has to be visible before paying: the app
          says plainly that it measured something, and what it means is the
          part that costs. No artificial limit on anything that already worked. */}
      {measured && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }} tone={measured.kcal ? 'accent' : undefined}>
            <View style={s.split}>
              <Eyebrow color={measured.kcal ? c.accent : undefined}>What your body actually costs</Eyebrow>
              {measured.kcal !== null && (
                <Txt variant="data" color={c.textFaint}>
                  {measured.confidence === 'good' ? 'measured' : 'early'}
                </Txt>
              )}
            </View>

            {measured.kcal === null ? (
              <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                Not enough to measure yet — {measured.missing}. Until then the target comes from a
                formula, which is right for a population and often wrong for a person.
              </Txt>
            ) : premium ? (
              <>
                <Txt variant="heading" style={{ marginTop: Space.md }}>
                  {measured.kcal}
                  <Txt variant="small" color={c.textFaint}> kcal a day</Txt>
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                  {measured.deltaToEstimate === null || measured.deltaToEstimate === 0
                    ? 'Which is what the formula estimated.'
                    : `That is ${Math.abs(measured.deltaToEstimate)} kcal ${measured.deltaToEstimate < 0 ? 'below' : 'above'} the formula's estimate. Measured from ${measured.intakeDays} days of eating and ${measured.weighIns} weigh-ins, so your target follows it.`}
                </Txt>
                <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
                  Based on the standard approximation of 7,700 kcal per kilogram. It moves as you do.
                </Txt>
              </>
            ) : (
              <>
                <Txt variant="body" style={{ marginTop: Space.md }}>
                  Measured from {measured.intakeDays} days of eating and {measured.weighIns} weigh-ins.
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                  The formula's estimate is off — Premium shows by how much and moves your target to
                  the measured figure.
                </Txt>
                <Button
                  label="See what it measured"
                  onPress={() => router.push('/paywall')}
                  style={{ marginTop: Space.md }}
                />
              </>
            )}
          </Card>
        </Enter>
      )}

      {review && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }} tone={review.sparse ? 'default' : 'accent'}>
            <Eyebrow>Last 7 days</Eyebrow>
            {review.sparse ? (
              <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                {review.consequence}
              </Txt>
            ) : (
              <>
                <View style={s.reviewRow}>
                  <View style={s.reviewCell}>
                    <Txt variant="heading" style={s.reviewFigure}>{review.fastDays}<Txt variant="small" color={c.textFaint}>/7</Txt></Txt>
                    <Txt variant="small" color={c.textDim}>fasts</Txt>
                  </View>
                  <Divider style={s.reviewLine} />
                  <View style={s.reviewCell}>
                    <Txt variant="heading" style={s.reviewFigure}>{review.cookDays}</Txt>
                    <Txt variant="small" color={c.textDim}>cooked</Txt>
                  </View>
                  <Divider style={s.reviewLine} />
                  <View style={s.reviewCell}>
                    <Txt variant="heading" style={s.reviewFigure}>{review.weighIns}</Txt>
                    <Txt variant="small" color={c.textDim}>weigh-ins</Txt>
                  </View>
                </View>
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.base }}>
                  {review.headline}
                </Txt>
                <Txt variant="small" color={c.text} style={{ marginTop: Space.sm }}>
                  {review.consequence}
                </Txt>
              </>
            )}
          </Card>
        </Enter>
      )}

      {adapt && adapt.daysLogged > 0 && (
        <Enter index={2}>
          <Card style={{ marginBottom: Space.base }}>
            <View style={s.split}>
              <Eyebrow>{adapt.label}</Eyebrow>
              <Txt variant="data" color={c.textFaint}>
                {adapt.daysLogged} {adapt.daysLogged === 1 ? 'day' : 'days'} logged
              </Txt>
            </View>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
              {adapt.note}
            </Txt>
          </Card>
        </Enter>
      )}

      {/* Correctable, because a streak that cannot be fixed stops being true. */}
      <Enter index={2}>
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
                        backgroundColor: d.logged ? c.ember : 'transparent',
                        borderColor: d.future ? c.line : d.logged ? c.ember : c.lineStrong,
                        opacity: d.future ? 0.4 : 1,
                      },
                    ]}
                  >
                    {d.logged && <Icon name="check" size={13} color={c.onAccent} strokeWidth={2.4} />}
                  </View>
                </View>
              </Tap>
            ))}
          </View>
        </Card>
      </Enter>

      <Enter index={3}>
        <Card>
          <View style={s.split}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Now</Eyebrow>
              <View style={s.figRow}>
                <Txt variant="display" style={{ fontSize: 38 }}>{current.toFixed(1)}</Txt>
                <Txt variant="data" color={c.textFaint} style={{ marginLeft: 4 }}>kg</Txt>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Eyebrow>Since start</Eyebrow>
              <Txt
                variant="heading"
                color={change === 0 ? c.textDim : good ? c.positive : c.negative}
                style={{ marginTop: 6 }}
              >
                {change > 0 ? '+' : ''}{change.toFixed(1)} kg
              </Txt>
            </View>
          </View>

          {entries.length >= 2 ? (
            <>
              <TrendChart entries={entries} />
              <Divider style={{ marginVertical: Space.base }} />
              <View style={s.split}>
                <Txt variant="small" color={c.textDim}>Trend</Txt>
                <Txt variant="data" color={c.accent}>
                  {trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend.toFixed(2)} kg / week`}
                </Txt>
              </View>
              <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
                Bodyweight swings a kilo or two on water alone. The weekly slope is the signal.
              </Txt>
            </>
          ) : (
            <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md }}>
              Log twice to see a trend line.
            </Txt>
          )}
        </Card>
      </Enter>

      <Enter index={4}>
        <Card style={{ marginTop: Space.base }}>
          <View style={s.split}>
            <Eyebrow>Toward target</Eyebrow>
            <Txt variant="data" color={c.textDim}>{profile.goal.replace('_', ' ')}</Txt>
          </View>
          <View style={{ marginTop: Space.base }}>
            <Bar pct={pct} color={c.accent} />
          </View>
          <View style={[s.split, { marginTop: Space.md }]}>
            <Txt variant="data" color={c.textFaint}>start {start.toFixed(1)}</Txt>
            <Txt variant="data" color={c.textFaint}>target {target.toFixed(1)}</Txt>
          </View>
          <Divider style={{ marginVertical: Space.base }} />
          <View style={s.split}>
            <Txt variant="small" color={c.textDim}>BMI</Txt>
            <Txt variant="data" color={c.text}>{bmi.toFixed(1)} · {bmiLabel}</Txt>
          </View>
          <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
            BMI cannot see muscle. Treat it as a rough marker.
          </Txt>
        </Card>
      </Enter>

      <Enter index={5}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.base }}>Log a weigh-in</Eyebrow>
          <View style={s.inputs}>
            <View style={s.inputCol}>
              <Txt variant="small" color={c.textDim} style={{ marginBottom: 6 }}>Date</Txt>
              <TextInput
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="YYYY-MM-DD"
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

      {entries.length > 0 ? (
        <Enter index={6} style={{ marginTop: Space.xxl }}>
          <Eyebrow style={{ marginBottom: Space.md }}>History</Eyebrow>
          <Card style={{ paddingVertical: Space.sm }}>
            {entries.slice(0, 10).map((e, i, arr) => {
              const prev = entries[i + 1];
              const delta = prev ? e.weight_kg - prev.weight_kg : null;
              return (
                <View key={e.id}>
                  {i > 0 && <Divider />}
                  <View style={s.histRow}>
                    <Txt variant="data" color={c.textDim}>{e.date}</Txt>
                    <View style={s.rowEnd}>
                      {delta !== null && delta !== 0 && (
                        <Txt variant="data" color={delta > 0 ? c.textFaint : c.positive} style={{ marginRight: Space.md }}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                        </Txt>
                      )}
                      <Txt variant="subheading">{e.weight_kg.toFixed(1)} kg</Txt>
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        </Enter>
      ) : (
        <Enter index={6}>
          <Empty
            icon="chart"
            title="Nothing logged yet"
            body="Weigh in at the same time of day, ideally before your first drink. Consistency matters more than the number."
          />
        </Enter>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewRow: { flexDirection: 'row', alignItems: 'center', marginTop: Space.base },
  reviewCell: { flex: 1 },
  reviewFigure: { fontSize: 24, marginBottom: 2 },
  reviewLine: { width: 1, height: 32, marginHorizontal: Space.md },
  weekRow: { flexDirection: 'row', marginTop: Space.base, marginRight: -Space.xs },
  weekCell: { flex: 1, marginRight: Space.xs },
  weekCellInner: { alignItems: 'center' },
  weekDot: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  figRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  inputs: { flexDirection: 'row', marginRight: -Space.md },
  inputCol: { flex: 1, marginRight: Space.md },
  input: { height: 48, borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: Space.md, fontSize: 15 },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.md },
  rowEnd: { flexDirection: 'row', alignItems: 'center' },
});
