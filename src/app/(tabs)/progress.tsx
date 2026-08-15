import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { Space, Radius } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Divider, PageHeader, Bar, Empty, Tap,
  PairedBars, NavRow, useTheme,
} from '@/components/ui';
import { DEFAULT_PROFILE, weeklyTrend, dailyTargets, suggestWindow, targetWeight, bmr, type UserProfile } from '@/lib/nutrition';
import {
  measuredMaintenance, readPlateau, forecast, deficitSpell, readTrend, weekdayPattern, weekBudget,
  proteinAdherence, cycleWeek, trainingDaysPerWeek, monthlyComparison, planAhead, daysAheadThisWeek,
  withoutOutliers, readiness, rateGap, effectiveMaintenance, type Readiness,
  type Measurement, type Forecast, type WeekdayPattern, type WeekBudget, type ProteinAdherence,
  type WeekCycle, type MonthlyComparison, type RateGap,
} from '@/lib/energy';
import { consistency, currentStreak } from '@/lib/dates';
import {
  loadProfileOrDefault, loadWeightLog,
  loadFastLog, loadCookLog, loadPlanHistory,
  loadIntakeLog, loadLastSession, isPremium,
  loadOutliers, measurementPreviewed, markMeasurementPreviewed,
  measurementAnnounced, markMeasurementAnnounced,
  type WeightEntry,
} from '@/lib/store';
import {
  weeklyReview, adaptationStage, weeklyDecision, progressCards,
  intakeWeek, bestWeeks,
  type WeeklyReview, type AdaptationStage, type Decision, type IntakeDay,
  type BestWeeks,
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
        {/* Violet: bodyweight is the body domain, and the line sits on a
            card washed the same way. */}
        <Path d={area} fill={c.bodyWash} />
        <Path d={line} stroke={c.body} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Circle cx={last.x} cy={last.y} r={5} fill={c.bg} />
        <Circle cx={last.x} cy={last.y} r={3} fill={c.body} />
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
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [adapt, setAdapt] = useState<AdaptationStage | null>(null);
  const [eaten, setEaten] = useState<IntakeDay[]>([]);
  /** The day's target, needed to record a correction against the right one. */
  const [dayKcal, setDayKcal] = useState(0);
  /** The exception being planned: a day ahead, and roughly how much over. */
  const [bigDay, setBigDay] = useState<string | null>(null);
  const [bigExtra, setBigExtra] = useState(1000);
  const [floor, setFloor] = useState(0);
  /** Kept so the exception day can be recomputed without another read. */
  const [intake, setIntake] = useState<unknown[]>([]);
  const [best, setBest] = useState<BestWeeks>(null);
  const [need, setNeed] = useState<Readiness | null>(null);
  /** The one-off showing of the first measured figure. Display only. */
  const [preview, setPreview] = useState(false);
  /** True once the measurement existed. Lets an expiry read as an expiry. */
  const [everMeasured, setEverMeasured] = useState(false);
  const [measured, setMeasured] = useState<Measurement | null>(null);
  const [outlook, setOutlook] = useState<Forecast | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [pattern, setPattern] = useState<WeekdayPattern | null>(null);
  const [months, setMonths] = useState<MonthlyComparison>(null);
  const [budget, setBudget] = useState<WeekBudget | null>(null);
  const [protein, setProtein] = useState<ProteinAdherence>(null);
  const [cycle, setCycle] = useState<WeekCycle>(null);
  const [tab, setTab] = useState<'week' | 'body' | 'history'>('week');
  const [steady, setSteady] = useState<{ hit: number; days: number; streak: number } | null>(null);
  const [premium, setPremium] = useState(false);
  /** The plan against the scale, when the two have drifted apart. */
  const [gap, setGap] = useState<RateGap | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // The profile first: the session's fallback training time has to be
        // *this* user's, not the app default. Passing DEFAULT_PROFILE here made
        // the window suggestion come out of the wrong session time entirely.
        const p = await loadProfileOrDefault();
        const [log, fasts, cooks, plans, intake, prem, session] = await Promise.all([
          loadWeightLog(), loadFastLog(), loadCookLog(),
          loadPlanHistory<{ date: string }>(), loadIntakeLog(), isPremium(),
          loadLastSession(p.default_training_time),
        ]);
        const skip = await loadOutliers();
        if (!active) return;
        setProfile(p);
        setEntries(log);
        setPremium(prem);

        // Computed once and shared. measuredMaintenance and readPlateau were
        // each being called twice with identical arguments, which is a second
        // chance to pass different ones by mistake.
        const est = dailyTargets(p, null);
        // Deliberately the unfiltered log. Excluding days here would let
        // anyone mark their way to a flattering measurement — the rule lives
        // in withoutOutliers and this is the call that must not use it.
        const m = measuredMaintenance(intake, log, est.maintenance_kcal);
        const compare = withoutOutliers(intake, skip);
        // All three conditions, not just the intake days — the decision used to
        // say "carry on" after eight evenings while the measurement was still
        // impossible for want of weigh-ins.
        const ready = readiness(intake, log);
        // 500 is the deficit dailyTargets applies for weight loss. The read
        // feeds the decision only — the card it used to fill could never
        // appear, because a stall outranks everything weeklyDecision ranks.
        const stall = readPlateau(intake, log, p.goal, 500);

        // The formula's answer is only a bound and a comparison here.
        setMeasured(m);
        // Forecast from the measured maintenance where there is one, the
        // formula's otherwise — the shape of the answer is the same either way.
        const start = log.length ? log[log.length - 1].weight_kg : p.weight_kg;
        setOutlook(
          p.goal === 'weight_loss'
            ? forecast(p, p.weight_kg, targetWeight(p, start), m.kcal ?? est.maintenance_kcal, est.kcal)
            : null
        );

        setNeed(ready);
        // Shown once, the day it first exists. Deliberately does not touch
        // effectiveMaintenance: the daily target must not jump for a day and
        // then jump back, which would be worse than never showing it.
        // The flag doubles as "a measurement has existed here before", which is
        // the only thing that tells a lapse apart from never having had one.
        // Only the reminder used to set it, and reminders do not exist on web —
        // so a lapsed web user was told they had never measured anything. The
        // screen that can see the figure records it too.
        let ever = await measurementAnnounced();
        if (!ever && m.kcal !== null) {
          await markMeasurementAnnounced();
          ever = true;
        }
        setEverMeasured(ever);
        if (!prem && m.kcal !== null && !(await measurementPreviewed())) {
          setPreview(true);
          await markMeasurementPreviewed();
        }
        setPattern(weekdayPattern(compare));
        setMonths(monthlyComparison(compare, log));
        setBest(bestWeeks(compare, log, plans, fasts));
        setProtein(proteinAdherence(intake));
        const trainDays = trainingDaysPerWeek(plans);
        setCycle(trainDays ? cycleWeek(est.kcal * 7, trainDays, bmr(p)) : null);
        setSteady({ ...consistency(fasts, 30), streak: currentStreak(fasts) });
        setBudget(weekBudget(est.kcal, intake));
        // Against the target actually in force, not the formula's: for someone
        // whose target already follows their measured maintenance the plan has
        // accounted for a cheaper body, and comparing against the formula would
        // invent a gap they already closed.
        const plan = dailyTargets(p, null, effectiveMaintenance(intake, log, est.maintenance_kcal, prem));
        setGap(rateGap(log, plan.maintenance_kcal, plan.kcal, p.goal));
        setEaten(intakeWeek(intake));
        setIntake(intake);
        setDayKcal(est.kcal);
        setFloor(bmr(p));

        // One instruction, chosen from everything the app now knows.
        const spell = deficitSpell(intake, log, p.goal);
        const winFix = session.restDay ? null : suggestWindow(p, session.start_time, session.duration_min);
        setDecision(
          weeklyDecision({
            stalled: stall.stalled,
            direction: stall.direction,
            stalledDays: stall.days,
            newTarget: stall.newTarget,
            breakDue: spell.breakDue,
            deficitWeeks: spell.weeks,
            maintenanceKcal: spell.maintenanceKcal,
            windowStart: winFix?.start ?? null,
            ready,
            trendNote: readTrend(log).note,
          })
        );
        setReview(weeklyReview(fasts, cooks, log, plans));
        setAdapt(adaptationStage(fasts));
        setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  if (!mounted) return null;

  const current = entries.length ? entries[0].weight_kg : profile.weight_kg;
  const start = entries.length ? entries[entries.length - 1].weight_kg : profile.weight_kg;
  const change = current - start;
  const trend = weeklyTrend(entries);

  const hM = profile.height_cm / 100;
  const bmi = current / (hM * hM);
  const bmiLabel = bmi < 18.5 ? 'Under' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Over' : 'Obese';

  const target = targetWeight(profile, start);

  const good = profile.goal === 'weight_loss' ? change < 0 : profile.goal === 'muscle_gain' ? change > 0 : true;

  // Signed, not absolute. Using |current - start| filled the bar when the user
  // moved *away* from the target — 82kg on a climb to 89kg showed 48% done.
  const span = target - start;
  const moved = current - start;
  const pct = span === 0 ? 100 : Math.min(100, Math.max(0, (moved / span) * 100));

  // What this screen is allowed to say, and which single card may ask for
  // money. The rules live in review.ts so they can be asserted; the screen
  // only obeys them.
  const cards = progressCards({
    premium,
    hasOutlook: !!outlook && (outlook.weeks !== null || outlook.stallWeight !== null),
    hasMeasured: measured?.kcal != null,
    hasMonths: !!months,
    hasPattern: !!pattern?.worst,
    hasCycle: !!cycle,
    hasAhead: daysAheadThisWeek().length > 0,
    // Only sellable once there is something counted to sell — a card that says
    // "five more weeks" is a request, not an offer.
    hasBest: !!best && best.differences.length > 0,
  });

  // From the calendar week, not from the intake strip — that one runs seven
  // days backwards, so filtering it for future days finds nothing at all.
  const aheadDays = daysAheadThisWeek();
  const bigPlan = bigDay ? planAhead(dayKcal, intake, bigExtra, bigDay, floor) : null;

  return (
    <Screen>
      <Enter index={0}>
        <PageHeader
          eyebrow={entries.length ? `${entries.length} entries logged` : 'No entries yet'}
          title="Progress"
        />
      </Enter>

      {/* The only card on this screen that tells anyone to do anything. The
          rest are read-outs; several true statements at once is noise, and
          noise is what stops being read. */}
      {decision && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }} tone={decision.headline === 'Carry on' ? undefined : 'accent'}>
            <Eyebrow color={decision.headline === 'Carry on' ? undefined : c.accent}>This week</Eyebrow>
            <Txt variant="subheading" style={{ marginTop: Space.sm }}>{decision.headline}</Txt>
            <Txt variant="body" style={{ marginTop: Space.sm }}>
              {premium || !decision.premiumOnly
                ? decision.action
                : 'Premium works the change out from your own numbers.'}
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>{decision.why}</Txt>
          </Card>
        </Enter>
      )}

      {/* Consistency in front, streak behind it. A streak that resets on one
          missed day is the mechanic that makes people delete a fitness app —
          forty days of work destroyed by one Tuesday with the flu. This number
          survives real life. */}
      {steady && steady.days > 0 && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }}>
            <View style={s.split}>
              <Eyebrow>Consistency</Eyebrow>
              {steady.streak > 0 && (
                <Txt variant="data" color={c.textFaint}>{steady.streak} in a row</Txt>
              )}
            </View>
            <Txt variant="heading" style={{ marginTop: Space.md }}>
              {steady.hit}
              <Txt variant="small" color={c.textFaint}> of the last {steady.days} days</Txt>
            </Txt>
            <Bar pct={(steady.hit / steady.days) * 100} color={c.accent} />
            {protein && (
              <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>{protein.note}</Txt>
            )}
          </Card>
        </Enter>
      )}


      {/* Three segments instead of sixteen cards of equal weight. Nothing is
          removed — it becomes findable. The instruction stays above them,
          because it is the only card that asks for anything. */}
      <Enter index={2}>
        <View style={s.segments}>
          {([['week', 'This week'], ['body', 'Your body'], ['history', 'History']] as const).map(
            ([key, label]) => (
              <Tap
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: tab === key }}
                accessibilityLabel={label}
                style={s.segmentCell}
              >
                <View
                  style={[
                    s.segment,
                    {
                      borderColor: tab === key ? c.accent : c.line,
                      backgroundColor: tab === key ? c.accent : 'transparent',
                    },
                  ]}
                >
                  <Txt variant="small" color={tab === key ? c.onAccent : c.textDim}>{label}</Txt>
                </View>
              </Tap>
            )
          )}
        </View>
      </Enter>

      {tab === 'week' && (
        <>
      {/* The week as a budget, not seven verdicts. Free: it is arithmetic on a
          target the user already has, and gating it would take away something
          they could do on paper. */}
      {budget && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }}>
            <View style={s.split}>
              <Eyebrow>This week's budget</Eyebrow>
              <Txt variant="data" color={budget.perDayLeft < 0 ? c.ember : c.textFaint}>
                {budget.daysLeft > 0 ? `${budget.daysLeft} days left` : 'week done'}
              </Txt>
            </View>
            <Bar
              pct={Math.min(100, (budget.usedKcal / Math.max(1, budget.totalKcal)) * 100)}
              color={budget.perDayLeft < 0 ? c.ember : c.accent}
            />
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>{budget.note}</Txt>
          </Card>
        </Enter>
      )}

      {/* Losing, but not at the rate the target was built for. readPlateau
          covers held and rising and has a better sentence for both; this is the
          case it returns early on, which is most people most of the time.
          Free, and deliberately: gating "your plan is not landing" would be
          charging someone to be told the thing they are already paying for is
          not working. */}
      {gap && (
        <Enter index={2}>
          <Card style={{ marginBottom: Space.base }}>
            <View style={s.split}>
              <Eyebrow>Plan against scale</Eyebrow>
              <Txt variant="data" color={c.textFaint}>{gap.gapKcal} kcal a day</Txt>
            </View>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>{gap.note}</Txt>
          </Card>
        </Enter>
      )}

      {/* The only thing this screen does before a day rather than after it.
          Everything else reads back, but nobody plans a wedding
          retrospectively — you know Saturday will run over, and the useful
          answer is what the other days become, not a verdict on Sunday.
          Rough amounts, not a number field: the answer is an estimate either
          way, and a decimal point would promise a precision it does not have. */}
      {aheadDays.length > 0 && budget && (
        <Enter index={2}>
          <Card style={{ marginBottom: Space.base }}>
            <Eyebrow>A big day coming up</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
              Pick the day and roughly how far over it will run.
            </Txt>

            <View style={s.segments as any}>
              {aheadDays.map((d) => (
                <Tap
                  key={d.date}
                  onPress={() => setBigDay(bigDay === d.date ? null : d.date)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: bigDay === d.date }}
                  accessibilityLabel={`Big day on ${d.date}`}
                  style={s.segmentCell}
                >
                  <View
                    style={[
                      s.segment,
                      {
                        borderColor: bigDay === d.date ? c.accent : c.line,
                        backgroundColor: bigDay === d.date ? c.accent : 'transparent',
                      },
                    ]}
                  >
                    <Txt variant="small" color={bigDay === d.date ? c.onAccent : c.textDim}>{d.label}</Txt>
                  </View>
                </Tap>
              ))}
            </View>

            {bigDay && (
              <View style={s.segments as any}>
                {[500, 1000, 2000].map((x) => (
                  <Tap
                    key={x}
                    onPress={() => setBigExtra(x)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: bigExtra === x }}
                    accessibilityLabel={`About ${x} kcal over`}
                    style={s.segmentCell}
                  >
                    <View
                      style={[
                        s.segment,
                        {
                          borderColor: bigExtra === x ? c.accent : c.line,
                          backgroundColor: bigExtra === x ? c.accent : 'transparent',
                        },
                      ]}
                    >
                      <Txt variant="small" color={bigExtra === x ? c.onAccent : c.textDim}>+{x}</Txt>
                    </View>
                  </Tap>
                ))}
              </View>
            )}

            {bigDay && (
              premium ? (
                bigPlan ? (
                  <>
                    {bigPlan.perDayKcal !== null && (
                      <Txt variant="heading" style={{ marginTop: Space.md }}>
                        {bigPlan.perDayKcal}
                        <Txt variant="small" color={c.textFaint}> kcal on the other days</Txt>
                      </Txt>
                    )}
                    <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                      {bigPlan.note}
                    </Txt>
                  </>
                ) : (
                  <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                    That day is outside the week this budget covers.
                  </Txt>
                )
              ) : (
                <>
                  <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                    Premium works out what the other days become so the week still lands where it was
                    going to — or tells you plainly that it cannot, and what the evening costs instead.
                  </Txt>
                  {cards.sell === 'ahead' && (
                    <Button
                      label="Plan the day"
                      onPress={() => router.push('/paywall')}
                      style={{ marginTop: Space.md }}
                    />
                  )}
                </>
              )
            )}
          </Card>
        </Enter>
      )}

      {/* The magnitudes stayed here when the corrections left: a glyph says a
          day was "ate more", the bars say by how much, and two days that both
          read "ate more" can be six hundred kilocalories apart. Each day is
          drawn against its own target, since the target moves as someone gets
          lighter. */}
      <Enter index={2}>
        <Card style={{ marginBottom: Space.base }}>
          <View style={s.split}>
            <Eyebrow>Evenings this week</Eyebrow>
            <Txt variant="data" color={c.textFaint}>plan · eaten</Txt>
          </View>
          <PairedBars days={eaten} height={72} />
        </Card>
      </Enter>

      {/* The four places you go to fix something used to sit in the middle of
          the readings, which made the week tab twice as long and neither half
          easy to find. They all have a primary path elsewhere — the evening
          question and the weigh-in prompt are both on Today — so one tap away
          costs nothing and gives the readings room to be read. */}
      <Enter index={2}>
        <NavRow
          icon="edit"
          title="Corrections"
          sub="Weigh-in, evenings, fasts, days to leave out"
          onPress={() => router.push('/week/corrections')}
        />
      </Enter>

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

        </>
      )}
      {tab === 'body' && (
        <>
      {/* One line above the cards that each say what they cannot do yet.
          Counted across the three segments there were six or seven of those,
          and every segment opened on one — which reads as an app that cannot
          do anything rather than one that is still counting. */}
      {need && !need.ready && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }}>
            <Eyebrow>Still counting</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>{need.note}</Txt>
          </Card>
        </Enter>
      )}

      {/* The moment people quit — a flat line reads as failure and is not one.
          It used to have a card of its own here, which could never appear:
          weeklyDecision ranks a stall above everything, so the decision card
          above was always already saying it. The days it had to add are now
          part of that sentence instead. */}

      {/* The reason to pay, and it has to be visible before paying: the app
          says plainly that it measured something, and what it means is the
          part that costs. No artificial limit on anything that already worked. */}
      {measured && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }} tone="body">
            <View style={s.split}>
              <Eyebrow color={measured.kcal ? c.accent : undefined}>What your body actually costs</Eyebrow>
              {measured.kcal !== null && (
                <Txt variant="data" color={c.textFaint}>
                  {measured.confidence === 'good' ? 'measured' : 'early'}
                </Txt>
              )}
            </View>

            {measured.kcal === null ? (
              // Every reading looks at 21 days. Three weeks away and the
              // measurement is gone, dailyTargets quietly falls back to the
              // formula, and nothing used to say so — for a paying user the
              // thing they pay for vanished without a word.
              <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                {everMeasured
                  ? `Your measurement has lapsed — it reads the last 21 days, and ${measured.missing} `
                    + 'is what is short. Until it is back, the target comes from the formula again.'
                  : `Not enough to measure yet — ${measured.missing}. Until then the target comes from a `
                    + 'formula, which is right for a population and often wrong for a person.'}
              </Txt>
            ) : premium || preview ? (
              <>
                <Txt variant="heading" style={{ marginTop: Space.md }}>
                  {measured.kcal}
                  <Txt variant="small" color={c.textFaint}> kcal a day</Txt>
                </Txt>
                {/* A single figure implied a precision four weigh-ins cannot
                    support. The band is the scatter in the weigh-ins carried
                    through the same conversion as the figure itself, so it
                    tightens as someone keeps standing on the scale — which is
                    the argument for doing it, made in a number. */}
                {measured.plusMinus !== null && (
                  <Txt variant="small" color={c.textFaint} style={{ marginTop: 2 }}>
                    give or take {measured.plusMinus}, from how much your weigh-ins scatter
                  </Txt>
                )}
                {!premium && (
                  <>
                    <Txt variant="small" color={c.accent} style={{ marginTop: Space.sm }}>
                      This is the figure you spent two weeks earning. It moves as you get lighter —
                      Premium keeps measuring it and pulls your daily target along with it.
                    </Txt>
                    {cards.sell === 'measured' && (
                      <Button
                        label="Keep it moving"
                        onPress={() => router.push('/paywall')}
                        style={{ marginTop: Space.md }}
                      />
                    )}
                  </>
                )}
                {/* "So your target follows it" was said whether the figure came
                    from the log or from the bound it hit on the way out. A
                    clamped answer read exactly like a measured one, which is
                    the one thing the number people pay for cannot afford. */}
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                  {measured.deltaToEstimate === null || measured.deltaToEstimate === 0
                    ? 'Which is what the formula estimated.'
                    : measured.clamped !== 'none'
                      ? `That is ${Math.abs(measured.deltaToEstimate)} kcal ${measured.deltaToEstimate < 0 ? 'below' : 'above'} the formula's estimate, and your log points further still. `
                        + `The target moves as far as ${measured.intakeDays} days of eating and ${measured.weighIns} weigh-ins have earned — more of both let it move the rest of the way.`
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
                {cards.sell === 'measured' && (
                  <Button
                    label="See what it measured"
                    onPress={() => router.push('/paywall')}
                    style={{ marginTop: Space.md }}
                  />
                )}
              </>
            )}
          </Card>
        </Enter>
      )}

      {/* The one thing here nobody could have worked out for themselves,
          because it needs months of their own log to exist. Counting, never
          causation: "in your four best weeks you trained four times" is a
          count; "training four times works for you" is a claim about a
          mechanism drawn from four weeks, which this app does not make. The
          rule is enforced in review.ts, not here. */}
      {best && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }}>
            <Eyebrow>What your best weeks had in common</Eyebrow>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
              {best.differences.length === 0 || premium
                ? best.note
                : `Your best ${best.bestCount} weeks were measurably different from the other `
                  + `${best.restCount}. Premium counts what changed.`}
            </Txt>
            {cards.sell === 'best' && (
              <Button
                label="Count the difference"
                onPress={() => router.push('/paywall')}
                style={{ marginTop: Space.md }}
              />
            )}
          </Card>
        </Enter>
      )}

      {/* The answer to "why is it getting harder", from your own log rather
          than from a study: a lighter body costs less to run, so the same
          plate stops being a deficit. Nothing here is estimated — a month
          without enough days is skipped, not guessed at. */}
      {months && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }}>
            <Eyebrow>Month against month</Eyebrow>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
              {premium
                ? months.note
                : 'You have two months with enough data to compare. Premium works out what changed '
                  + 'between them and what your maintenance did while you got lighter.'}
            </Txt>
            {cards.sell === 'months' && (
              <Button
                label="Compare the months"
                onPress={() => router.push('/paywall')}
                style={{ marginTop: Space.md }}
              />
            )}
          </Card>
        </Enter>
      )}

      {/* What everybody half knows about themselves, turned into a number. */}
      {pattern && (pattern.worst || pattern.note || pattern.missing) && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }}>
            <Eyebrow>Your pattern</Eyebrow>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
              {pattern.missing
                // Written, checked, and never rendered until now: the guard
                // demanded worst or note, and when `missing` is set both are
                // empty. Same class as intakeWeek in point 38.
                ? `Not enough to read a pattern yet — ${pattern.missing}.`
                : premium || !pattern.worst
                ? pattern.note
                : 'Your days are not alike — one of them runs well over the rest. Premium names it and '
                  + 'works out what it costs across a week.'}
            </Txt>
            {!pattern.missing && cards.sell === 'pattern' && (
              <Button
                label="See which day"
                onPress={() => router.push('/paywall')}
                style={{ marginTop: Space.md }}
              />
            )}
          </Card>
        </Enter>
      )}

      {/* The same week, arranged around the sessions. The balance is untouched;
          only how easy the week is to hold changes. */}
      {cycle && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }}>
            <Eyebrow>Around your training</Eyebrow>
            {premium ? (
              <>
                <View style={[s.split, { marginTop: Space.md }]}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="subheading">{cycle.trainingKcal}</Txt>
                    <Eyebrow style={{ marginTop: 2 }}>{cycle.trainingDays} training days</Eyebrow>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="subheading" color={c.textDim}>{cycle.restKcal}</Txt>
                    <Eyebrow style={{ marginTop: 2 }}>{cycle.restDays} rest days</Eyebrow>
                  </View>
                </View>
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>{cycle.note}</Txt>
              </>
            ) : (
              <>
                <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                  You train {cycle.trainingDays} days a week. The same weekly total eats more easily
                  when it follows the sessions — Premium works out the split.
                </Txt>
                {cards.sell === 'cycle' && (
                  <Button
                    label="See the split"
                    onPress={() => router.push('/paywall')}
                    style={{ marginTop: Space.md }}
                  />
                )}
              </>
            )}
          </Card>
        </Enter>
      )}

      {/* The question everyone actually has, answered without the flattery.
          A naive projection divides distance by current rate and is always
          optimistic, because a lighter body costs less to run. This one bends,
          and when the plate is too big to reach the goal it says so. */}
      {outlook && cards.outlook && (
        <Enter index={1}>
          <Card style={{ marginBottom: Space.base }}>
            <View style={s.split}>
              <Eyebrow>Where this leads</Eyebrow>
              {premium && outlook.weeks !== null && (
                <Txt variant="data" color={c.accent}>{outlook.weeks} weeks</Txt>
              )}
            </View>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
              {premium
                ? outlook.note
                : outlook.stallWeight !== null
                  ? 'At your current intake the weight levels off before the target — a lighter body '
                    + 'costs less to run. Premium shows where, and what to eat instead.'
                  : 'Premium works out how long this takes at your current intake, allowing for the '
                    + 'fact that the rate eases as you get lighter.'}
            </Txt>
            {cards.sell === 'outlook' && (
              <Button
                label="See where this leads"
                onPress={() => router.push('/paywall')}
                style={{ marginTop: Space.md }}
              />
            )}
          </Card>
        </Enter>
      )}

        </>
      )}
      {tab === 'history' && (
        <>
      <Enter index={3}>
        <Card tone="body">
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

        </>
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
  segments: { flexDirection: 'row', marginBottom: Space.lg, marginRight: -Space.sm },
  segmentCell: { flex: 1, marginRight: Space.sm },
  segment: {
    minHeight: 34, borderRadius: 17, borderWidth: 1, paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center',
  },
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
