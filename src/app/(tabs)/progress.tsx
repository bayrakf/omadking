import { useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Space, Radius } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Divider, PageHeader, Bar, Empty, Tap,
  PairedBars, NavRow, Columns, SegmentedControl, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { useLang } from '@/components/lang';
import { DEFAULT_PROFILE, weeklyTrend, dailyTargets, suggestWindow, targetWeight, bmr, type UserProfile } from '@/lib/nutrition';
import {
  measuredMaintenance, readPlateau, forecast, deficitSpell, readTrend, weekdayPattern, weekBudget,
  proteinAdherence, cycleWeek, trainingDaysPerWeek, monthlyComparison, planAhead, daysAheadThisWeek,
  withoutOutliers, readiness, rateGap, effectiveMaintenance, type Readiness,
  type Measurement, type Forecast, type WeekdayPattern, type WeekBudget, type ProteinAdherence,
  type WeekCycle, type MonthlyComparison, type RateGap,
} from '@/lib/energy';
import { consistency, currentStreak, formatReadableDate } from '@/lib/dates';
import {
  loadProfileOrDefault, loadWeightLog,
  loadFastLog, loadCookLog, loadPlanHistory,
  loadIntakeLog, loadLastSession, isPremium,
  loadOutliers, measurementPreviewed, markMeasurementPreviewed,
  measurementAnnounced, markMeasurementAnnounced,
  loadAllFastingNotes,
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
 * with a soft gradient band is the honest way to show that the day-to-day scatter is not
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
        <Defs>
          <LinearGradient id="weightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={c.body} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={c.body} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#weightGrad)" />
        <Path d={line} stroke={c.body} strokeWidth={2.8} fill="none" strokeLinecap="round" />
        <Circle cx={last.x} cy={last.y} r={7} fill={c.bodyWash} />
        <Circle cx={last.x} cy={last.y} r={4.5} fill={c.bg} />
        <Circle cx={last.x} cy={last.y} r={3} fill={c.body} />
      </Svg>
    </View>
  );
}

export default function ProgressScreen() {
  const c = useTheme();
  const { lang, t } = useLang();
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
  const [fastingNotes, setFastingNotes] = useState<Record<string, string>>({});
  const [premium, setPremium] = useState(false);
  /** The plan against the scale, when the two have drifted apart. */
  const [gap, setGap] = useState<RateGap | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const p = await loadProfileOrDefault();
        const [log, fasts, cooks, plans, intake, prem, session, notes] = await Promise.all([
          loadWeightLog(), loadFastLog(), loadCookLog(),
          loadPlanHistory<{ date: string }>(), loadIntakeLog(), isPremium(),
          loadLastSession(p.default_training_time), loadAllFastingNotes(),
        ]);
        const skip = await loadOutliers();
        if (!active) return;
        setProfile(p);
        setEntries(log);
        setFastingNotes(notes);
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
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          tone="body"
          eyebrow={entries.length ? t('progress.entries', { n: entries.length }) : t('progress.noEntries')}
          title={t('progress.title')}
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
              <Eyebrow>{lang === 'de' ? 'KONSISTENZ' : 'CONSISTENCY'}</Eyebrow>
              {steady.streak > 0 && (
                <Txt variant="data" color={c.textFaint}>
                  {lang === 'de' ? `${steady.streak} in Folge` : `${steady.streak} in a row`}
                </Txt>
              )}
            </View>
            <Txt variant="heading" style={{ marginTop: Space.md }}>
              {steady.hit}
              <Txt variant="small" color={c.textFaint}>
                {lang === 'de' ? ` von den letzten ${steady.days} Tagen` : ` of the last ${steady.days} days`}
              </Txt>
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
        <SegmentedControl
          values={[
            { id: 'week', label: t('progress.tabWeek'), icon: 'chart' },
            { id: 'body', label: t('progress.tabBody'), icon: 'user' },
            { id: 'history', label: t('progress.tabHistory'), icon: 'clock' },
          ]}
          selected={tab}
          onSelect={setTab}
          tone="body"
          style={{ marginBottom: Space.base }}
        />
      </Enter>

      {tab === 'week' && (
        <>
        <Columns>
        {/* Weight & Trend Hero */}
        <Enter index={1}>
          <Card tone="body" style={{ marginBottom: Space.base }}>
            <View style={s.split}>
              <View style={{ flex: 1 }}>
                <Eyebrow color={c.body}>{t('card.currentWeight')}</Eyebrow>
                <View style={s.figRow}>
                  <Txt variant="display" style={{ fontSize: 36, fontWeight: '800' }}>{current.toFixed(1)}</Txt>
                  <Txt variant="data" color={c.textFaint} style={{ marginLeft: 4, fontSize: 16 }}>kg</Txt>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Eyebrow color={c.body}>{t('card.sinceStart')}</Eyebrow>
                <View style={[s.changeBadge, { backgroundColor: good ? c.planWash : c.well }]}>
                  <Txt
                    variant="heading"
                    color={change === 0 ? c.textDim : good ? c.positive : c.negative}
                    style={{ fontSize: 16, fontWeight: '800' }}
                  >
                    {change > 0 ? '+' : ''}{change.toFixed(1)} kg
                  </Txt>
                </View>
              </View>
            </View>

            {entries.length >= 2 ? (
              <>
                <View style={{ marginVertical: Space.sm }}>
                  <TrendChart entries={entries} />
                </View>
                <Divider style={{ marginVertical: Space.sm }} />
                <View style={s.split}>
                  <Txt variant="small" color={c.textDim}>{t('card.weeklyTrend')}</Txt>
                  <Txt variant="data" color={c.body} style={{ fontWeight: '700' }}>
                    {trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend.toFixed(2)} kg / Woche`}
                  </Txt>
                </View>
              </>
            ) : (
              <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md }}>
                {t('card.needTwoWeighIns')}
              </Txt>
            )}

            <View style={{ marginTop: Space.base }}>
              <View style={[s.split, { marginBottom: 6 }]}>
                <Eyebrow>{t('card.goalProgress')} ({profile.goal.replace('_', ' ')})</Eyebrow>
                {/* The bar already shows the share travelled; printing it as
                    a percentage as well spends the app's one wording rule —
                    counted facts, not figures — on a number the reader can
                    see. It also read "0%" on a muscle-gain goal, where the
                    target is above the start and the share is meaningless. */}
                <Txt variant="data" color={c.textDim}>BMI {bmi.toFixed(1)} ({bmiLabel})</Txt>
              </View>
              <Bar pct={pct} color={c.body} />
              <View style={[s.split, { marginTop: 6 }]}>
                <Txt variant="data" color={c.textFaint}>{t('card.start', { kg: start.toFixed(1) })}</Txt>
                <Txt variant="data" color={c.textFaint}>{t('card.target', { kg: target.toFixed(1) })}</Txt>
              </View>
            </View>
          </Card>
        </Enter>

        {gap && (
          <Enter index={2}>
            <Card style={{ marginBottom: Space.base }}>
              <View style={s.split}>
                <Eyebrow>{t('card.planVsScale')}</Eyebrow>
                <Txt variant="data" color={c.textFaint}>{gap.gapKcal} kcal / Tag Differenz</Txt>
              </View>
              <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>{gap.note}</Txt>
            </Card>
          </Enter>
        )}

        {adapt && adapt.daysLogged > 0 && (
          <Enter index={2}>
            <Card style={{ marginBottom: Space.base }}>
              <View style={s.split}>
                <Eyebrow>{adapt.label}</Eyebrow>
                <Txt variant="data" color={c.textFaint}>
                  {adapt.daysLogged === 1 ? t('card.dayLogged') : t('card.daysLogged', { n: adapt.daysLogged })}
                </Txt>
              </View>
              <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                {adapt.note}
              </Txt>
            </Card>
          </Enter>
        )}

        {/* Calorie Balance & Paired Bars */}
        <Enter index={2}>
          <Card style={{ marginBottom: Space.base }}>
            <View style={s.split}>
              <Eyebrow color={c.accent}>{t('card.calorieBalance')}</Eyebrow>
              <Txt variant="data" color={c.textFaint}>{t('card.planVsActual')}</Txt>
            </View>
            <View style={{ marginTop: Space.sm }}>
              <PairedBars days={eaten} height={76} />
            </View>
          </Card>
        </Enter>

        {budget && (
          <Enter index={2}>
            <Card style={{ marginBottom: Space.base }}>
              <View style={s.split}>
                <Eyebrow>{t('card.weekBudget')}</Eyebrow>
                <Txt variant="data" color={budget.perDayLeft < 0 ? c.ember : c.textFaint}>
                  {budget.daysLeft > 0 ? `noch ${budget.daysLeft} Tage` : 'Woche beendet'}
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

        {aheadDays.length > 0 && budget && (
          <Enter index={2}>
            <Card style={{ marginBottom: Space.base }}>
              <Eyebrow>{t('card.bigDay')}</Eyebrow>
              <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                {t('card.bigDayPick')}
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
                          <Txt variant="small" color={c.textFaint}> kcal an den anderen Tagen</Txt>
                        </Txt>
                      )}
                      <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                        {bigPlan.note}
                      </Txt>
                    </>
                  ) : (
                    <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                      {t('card.bigDayOutside')}
                    </Txt>
                  )
                ) : (
                  <>
                    <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                      {t('card.bigDayPremium')}
                    </Txt>
                    {cards.sell === 'ahead' && (
                      <Button
                        label="Woche ausbalancieren"
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

        {review && (
          <Enter index={3}>
            <Card style={{ marginBottom: Space.base }} tone={review.sparse ? 'default' : 'accent'}>
              <Eyebrow>{t('card.last7')}</Eyebrow>
              {review.sparse ? (
                <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                  {review.consequence}
                </Txt>
              ) : (
                <>
                  <View style={s.reviewRow}>
                    <View style={s.reviewCell}>
                      <Txt variant="heading" style={s.reviewFigure}>{review.fastDays}<Txt variant="small" color={c.textFaint}>/7</Txt></Txt>
                      <Txt variant="small" color={c.textDim}>{t('card.fastDays')}</Txt>
                    </View>
                    <Divider style={s.reviewLine} />
                    <View style={s.reviewCell}>
                      <Txt variant="heading" style={s.reviewFigure}>{review.cookDays}</Txt>
                      <Txt variant="small" color={c.textDim}>{t('card.cooked')}</Txt>
                    </View>
                    <Divider style={s.reviewLine} />
                    <View style={s.reviewCell}>
                      <Txt variant="heading" style={s.reviewFigure}>{review.weighIns}</Txt>
                      <Txt variant="small" color={c.textDim}>{t('card.weighIns')}</Txt>
                    </View>
                  </View>
                  <Txt variant="small" color={c.textDim} style={{ marginTop: Space.base }}>
                    {review.headline}
                  </Txt>
                  {/* The line that turns a week of counting into a statement
                      about where it leads. It was dropped in the rewrite, and
                      without it the card reports what happened and stops
                      short of the one thing it exists to say. */}
                  <Txt variant="bodyMedium" style={{ marginTop: Space.sm }}>
                    {review.consequence}
                  </Txt>
                </>
              )}
            </Card>
          </Enter>
        )}

        <Enter index={4}>
          <NavRow
            icon="edit"
            tone="body"
            title={t('progress.corrections')}
            sub={t('progress.correctionsSub')}
            onPress={() => router.push('/week/corrections')}
          />
        </Enter>
        </Columns>
        </>
      )}

      {tab === 'body' && (
        <>
        <Columns>
        {need && !need.ready && (
          <Enter index={1}>
            <Card style={{ marginBottom: Space.base }}>
              <Eyebrow>{t('card.calibrating')}</Eyebrow>
              <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>{need.note}</Txt>
            </Card>
          </Enter>
        )}

        {measured && (
          <Enter index={1}>
            <Card style={{ marginBottom: Space.base }} tone="body">
              <View style={s.split}>
                <Eyebrow color={measured.kcal ? c.body : undefined}>{t('card.actualNeed')}</Eyebrow>
                {measured.kcal !== null && (
                  <View style={[s.changeBadge, { backgroundColor: c.bodyWash }]}>
                    <Txt variant="data" color={c.body} style={{ fontWeight: '700' }}>
                      {measured.confidence === 'good' ? t('card.measured') : t('card.earlyMeasure')}
                    </Txt>
                  </View>
                )}
              </View>

              {measured.kcal === null ? (
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                  {everMeasured
                    ? t('meas.stale', { missing: measured.missing ?? '' })
                    : t('meas.notEnough', { missing: measured.missing ?? '' })}
                </Txt>
              ) : premium || preview ? (
                <>
                  <Txt variant="heading" style={{ marginTop: Space.md, fontSize: 26, fontWeight: '800' }}>
                    {measured.kcal}
                    <Txt variant="small" color={c.textFaint}>{t('meas.perDay')}</Txt>
                  </Txt>
                  {measured.plusMinus !== null && (
                    <Txt variant="small" color={c.textFaint} style={{ marginTop: 2 }}>
                      {t('meas.spread', { n: measured.plusMinus })}
                    </Txt>
                  )}
                  {!premium && (
                    <>
                      <Txt variant="small" color={c.accent} style={{ marginTop: Space.sm }}>
                        {t('meas.yoursNow')}
                      </Txt>
                      {cards.sell === 'measured' && (
                        <Button
                          label={t('meas.sellKeep')}
                          onPress={() => router.push('/paywall')}
                          style={{ marginTop: Space.md }}
                        />
                      )}
                    </>
                  )}
                  <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                    {measured.deltaToEstimate === null || measured.deltaToEstimate === 0
                      ? t('meas.matchesFormula')
                      : t('meas.offBy', {
                          n: Math.abs(measured.deltaToEstimate),
                          days: measured.intakeDays,
                          weighIns: measured.weighIns,
                        })}
                  </Txt>
                  {/* The measurement rests on 7,700 kcal per kilogram, which is
                      an approximation of body tissue and not a fact about this
                      person. Saying so is the same standing rule that keeps
                      "approximate" on the fasting stage — it was lost in the
                      rewrite, and without it the figure reads as measured to
                      the calorie. */}
                  <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
                    {t('meas.approximation')}
                  </Txt>
                </>
              ) : (
                <>
                  <Txt variant="body" style={{ marginTop: Space.md }}>
                    {t('meas.basedOn', { days: measured.intakeDays, weighIns: measured.weighIns })}
                  </Txt>
                  {cards.sell === 'measured' && (
                    <Button
                      label={t('meas.sellShow')}
                      onPress={() => router.push('/paywall')}
                      style={{ marginTop: Space.md }}
                    />
                  )}
                </>
              )}
            </Card>
          </Enter>
        )}

        {cycle && (
          <Enter index={2}>
            <Card style={{ marginBottom: Space.base }}>
              <Eyebrow color={c.plan}>{t('card.trainingSplit')}</Eyebrow>
              {premium ? (
                <>
                  <View style={[s.split, { marginTop: Space.md }]}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="heading" style={{ fontSize: 20 }}>{cycle.trainingKcal} kcal</Txt>
                      <Eyebrow style={{ marginTop: 2 }}>{cycle.trainingDays} Trainingstage</Eyebrow>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="heading" color={c.textDim} style={{ fontSize: 20 }}>{cycle.restKcal} kcal</Txt>
                      <Eyebrow style={{ marginTop: 2 }}>{cycle.restDays} Ruhetage</Eyebrow>
                    </View>
                  </View>
                  <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>{cycle.note}</Txt>
                </>
              ) : (
                <>
                  <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                    Du trainierst {cycle.trainingDays} Tage pro Woche. Premium berechnet die optimale Kalorienaufteilung auf Trainings- und Ruhetage.
                  </Txt>
                  {cards.sell === 'cycle' && (
                    <Button
                      label="Aufteilung freischalten"
                      onPress={() => router.push('/paywall')}
                      style={{ marginTop: Space.md }}
                    />
                  )}
                </>
              )}
            </Card>
          </Enter>
        )}

        {pattern && (pattern.worst || pattern.note || pattern.missing) && (
          <Enter index={3}>
            <Card style={{ marginBottom: Space.base }}>
              <Eyebrow>{t('card.weekdayPattern')}</Eyebrow>
              <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                {pattern.missing
                  ? t('card.noPatternYet')
                  : premium || !pattern.worst
                  ? pattern.note
                  : t('card.patternPremium')}
              </Txt>
              {!pattern.missing && cards.sell === 'pattern' && (
                <Button
                  label="Muster anzeigen"
                  onPress={() => router.push('/paywall')}
                  style={{ marginTop: Space.md }}
                />
              )}
            </Card>
          </Enter>
        )}

        {outlook && cards.outlook && (
          <Enter index={4}>
            <Card style={{ marginBottom: Space.base }}>
              <View style={s.split}>
                <Eyebrow>{t('card.forecast')}</Eyebrow>
                {premium && outlook.weeks !== null && (
                  <Txt variant="data" color={c.accent}>{outlook.weeks} Wochen</Txt>
                )}
              </View>
              <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                {premium
                  ? outlook.note
                  : t('card.forecastPremium')}
              </Txt>
              {cards.sell === 'outlook' && (
                <Button
                  label="Prognose freischalten"
                  onPress={() => router.push('/paywall')}
                  style={{ marginTop: Space.md }}
                />
              )}
            </Card>
          </Enter>
        )}
        </Columns>
        </>
      )}

      {tab === 'history' && (
        <>
        <Columns>
        {best && (
          <Enter index={1}>
            <Card style={{ marginBottom: Space.base }} tone="plan">
              <Eyebrow color={c.plan}>{t('card.bestWeeks')}</Eyebrow>
              <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                {best.differences.length === 0 || premium
                  ? best.note
                  : `Deine ${best.bestCount} besten Wochen unterschieden sich messbar. Premium zeigt die Erfolgsfaktoren.`}
              </Txt>
              {cards.sell === 'best' && (
                <Button
                  label="Erfolgsfaktoren ansehen"
                  onPress={() => router.push('/paywall')}
                  style={{ marginTop: Space.md }}
                />
              )}
            </Card>
          </Enter>
        )}

        {months && (
          <Enter index={2}>
            <Card style={{ marginBottom: Space.base }}>
              <Eyebrow>{t('card.monthly')}</Eyebrow>
              <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                {premium
                  ? months.note
                  : t('card.monthlyPremium')}
              </Txt>
              {cards.sell === 'months' && (
                <Button
                  label="Monate vergleichen"
                  onPress={() => router.push('/paywall')}
                  style={{ marginTop: Space.md }}
                />
              )}
            </Card>
          </Enter>
        )}

        {entries.length > 0 ? (
          <Enter index={3}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.md, marginTop: Space.sm }}>
              <Eyebrow color={c.body}>{t('card.weighHistory')}</Eyebrow>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.print?.();
                  }
                }}
                activeOpacity={0.7}
                style={[s.reportBtn, { backgroundColor: c.well, borderColor: c.line }]}
              >
                <Icon name="share" size={12} color={c.accent} />
                <Txt variant="eyebrow" color={c.accent} style={{ marginLeft: 4, fontSize: 10, fontWeight: '700' }}>
                  {lang === 'de' ? 'BERICHT DRUCKEN / PDF' : 'PRINT REPORT / PDF'}
                </Txt>
              </TouchableOpacity>
            </View>
            <Card style={{ paddingVertical: Space.sm }}>
              {entries.slice(0, 15).map((e, i) => {
                const prev = entries[i + 1];
                const delta = prev ? e.weight_kg - prev.weight_kg : null;
                return (
                  <View key={e.id}>
                    {i > 0 && <Divider />}
                    <View style={s.histRow}>
                      <View style={{ flex: 1 }}>
                        <Txt variant="data" color={c.text}>{formatReadableDate(e.date, lang)}</Txt>
                        {fastingNotes[e.date] ? (
                          <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 2 }}>
                            📝 {fastingNotes[e.date]}
                          </Txt>
                        ) : null}
                      </View>
                      <View style={s.rowEnd}>
                        {delta !== null && delta !== 0 && (
                          <Txt variant="data" color={delta > 0 ? c.negative : c.positive} style={{ marginRight: Space.md }}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
                          </Txt>
                        )}
                        <Txt variant="heading" style={{ fontSize: 16 }}>{e.weight_kg.toFixed(1)} kg</Txt>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </Enter>
        ) : (
          <Enter index={3}>
            <Empty
              icon="chart"
              title="Nothing logged yet"
              body="Weigh in at the same time of day, ideally before your first drink. Consistency matters more than the number."
            />
          </Enter>
        )}

        </Columns>
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
  changeBadge: {
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
