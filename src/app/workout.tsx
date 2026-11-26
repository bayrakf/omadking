import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Button, SegmentedControl, Tap, PageHeader, Notice, useTheme, washOf,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { useLang } from '@/components/lang';
import {
  saveLastSession, loadProfileOrDefault, loadWorkoutLog, saveWorkoutSession,
  loadIntakeLog, loadWeightLog, todayISO,
} from '@/lib/store';
import { DEFAULT_PROFILE, type FitnessLevel, type SessionDraft, type UserProfile } from '@/lib/nutrition';
import { deficitSpell } from '@/lib/energy';
import {
  WORKOUT_PROGRAMS,
  exercisesForLevel,
  formatSetsSummary,
  isProgressionReady,
  lastExercisePerformance,
  recoveryAdvisory,
  type LoggedExercise,
  type LoggedSet,
  type WorkoutCategory,
  type WorkoutLogEntry,
  type WorkoutProgram,
} from '@/lib/workouts';
import { haptic } from '@/lib/haptic';

export default function WorkoutScreen() {
  const c = useTheme();
  const { lang, t } = useLang();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [level, setLevel] = useState<FitnessLevel>('intermediate');
  const [category, setCategory] = useState<WorkoutCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>('calisthenics-push');
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLogEntry[]>([]);
  const [dietBreakDue, setDietBreakDue] = useState(false);

  // Per-exercise active set inputs keyed by `${workoutId}:${exerciseId}`
  const [draftSets, setDraftSets] = useState<Record<string, LoggedSet[]>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, log, intake, weights] = await Promise.all([
          loadProfileOrDefault(),
          loadWorkoutLog(),
          loadIntakeLog(),
          loadWeightLog(),
        ]);
        if (!active) return;
        setProfile(p);
        setLevel(p.fitness_level);
        setWorkoutLog(log);
        const spell = deficitSpell(intake, weights, p.goal);
        setDietBreakDue(spell.breakDue);
      })();
      return () => { active = false; };
    }, [])
  );

  const getDraft = (wId: string, exId: string, setsCount: number, defaultReps: number): LoggedSet[] => {
    const key = `${wId}:${exId}`;
    const existing = draftSets[key];
    if (existing && existing.length === setsCount) return existing;
    const prev = lastExercisePerformance(exId, workoutLog);
    if (prev && prev.length >= setsCount) return prev.slice(0, setsCount).map((s) => ({ ...s }));
    return Array.from({ length: setsCount }, () => ({ reps: defaultReps }));
  };

  const updateSetReps = (wId: string, exId: string, setsCount: number, defaultReps: number, setIdx: number, nextReps: number) => {
    const key = `${wId}:${exId}`;
    const base = getDraft(wId, exId, setsCount, defaultReps);
    const updated = base.map((s, idx) => (idx === setIdx ? { ...s, reps: Math.max(0, Math.min(200, nextReps)) } : s));
    setDraftSets((prev) => ({ ...prev, [key]: updated }));
  };

  const logWorkout = async (w: WorkoutProgram) => {
    const specs = exercisesForLevel(w, level);
    const loggedExercises: LoggedExercise[] = specs.map((ex) => ({
      exerciseId: ex.id,
      name: ex.name[lang],
      sets: getDraft(w.id, ex.id, ex.targetSets, ex.targetRepsMin),
    }));
    const entry: WorkoutLogEntry = {
      id: `${todayISO()}-${w.id}-${Date.now()}`,
      date: todayISO(),
      workoutId: w.id,
      sport: w.sport,
      durationMin: w.durationMin,
      intensity: w.intensity,
      startTime: profile.default_training_time,
      exercises: loggedExercises,
    };
    const nextLog = await saveWorkoutSession(entry);
    setWorkoutLog(nextLog);
    setSavedId(w.id);
    haptic('success');
  };

  const applyWorkout = async (w: WorkoutProgram) => {
    const session: SessionDraft = {
      sport: w.sport,
      duration_min: w.durationMin,
      intensity: w.intensity,
      start_time: profile.default_training_time,
      restDay: false,
    };
    await saveLastSession(session);
    setAppliedId(w.id);
    haptic('medium');
    setTimeout(() => {
      router.push('/planner');
    }, 250);
  };

  const filtered = category === 'all' ? WORKOUT_PROGRAMS : WORKOUT_PROGRAMS.filter((w) => w.category === category);
  const advisory = recoveryAdvisory(dietBreakDue, lang);

  return (
    <Screen wide>
      <PageHeader
        back
        title={t('workout.title')}
        subtitle={t('workout.sub')}
      />

      {advisory ? (
        <View style={{ marginBottom: Space.base }}>
          <Notice tone="warn">{advisory}</Notice>
        </View>
      ) : null}

      {/* Level Switcher for Calisthenics Progression */}
      <View style={{ marginBottom: Space.md }}>
        <Eyebrow color={c.textDim} style={{ marginBottom: Space.xs }}>
          {lang === 'de' ? 'Calisthenics & Kraft-Level' : 'Calisthenics & strength level'}
        </Eyebrow>
        <SegmentedControl
          selected={level}
          onSelect={(v) => setLevel(v as FitnessLevel)}
          values={[
            { id: 'beginner', label: lang === 'de' ? 'Einsteiger' : 'Beginner' },
            { id: 'intermediate', label: lang === 'de' ? 'Fortgeschritten' : 'Intermediate' },
            { id: 'advanced', label: lang === 'de' ? 'Profi' : 'Advanced' },
          ]}
          tone="body"
        />
      </View>

      {/* Filter Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Space.base }}>
        <View style={{ flexDirection: 'row' }}>
          {([
            ['all', t('workout.all')],
            ['calisthenics', t('workout.calisthenics')],
            ['strength', t('workout.strength')],
            ['hiit', t('workout.hiit')],
            ['cardio', t('workout.cardio')],
            ['mobility', t('workout.mobility')],
          ] as const).map(([id, label], idx) => {
            const active = category === id;
            return (
              <Tap
                key={id}
                onPress={() => setCategory(id)}
                accessibilityLabel={label}
                style={[
                  s.catChip,
                  {
                    backgroundColor: active ? c.accent : c.surface,
                    borderColor: active ? c.accent : c.line,
                    marginRight: idx < 5 ? Space.xs : 0,
                  },
                ]}
              >
                <Txt variant="small" color={active ? c.onAccent : c.text} style={{ fontWeight: active ? '600' : '400' }}>
                  {label}
                </Txt>
              </Tap>
            );
          })}
        </View>
      </ScrollView>

      {/* Workout Programs */}
      {filtered.map((w) => {
        const isExpanded = expandedId === w.id;
        const isApplied = appliedId === w.id;
        const isSaved = savedId === w.id;
        const specs = exercisesForLevel(w, level);
        const loggedToday = workoutLog.some((e) => e.date === todayISO() && e.workoutId === w.id);

        return (
          <Card
            key={w.id}
            style={[
              s.card,
              {
                borderColor: isExpanded ? c[w.hue] : c.line,
                backgroundColor: c.surface,
              },
            ]}
          >
            <Tap
              onPress={() => setExpandedId(isExpanded ? null : w.id)}
              accessibilityLabel={w.title[lang]}
              style={s.cardHead}
            >
              <Icon name={w.icon} size={20} color={c[w.hue]} />
              <View style={{ flex: 1, marginLeft: Space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Txt variant="subheading" style={{ flex: 1 }}>
                    {w.title[lang]}
                  </Txt>
                  {loggedToday ? (
                    <View style={[s.badgePill, { backgroundColor: washOf(c.positive), borderColor: c.positive }]}>
                      <Txt variant="small" color={c.positive} style={{ fontSize: 11, fontWeight: '600' }}>
                        {lang === 'de' ? 'Heute geloggt' : 'Logged today'}
                      </Txt>
                    </View>
                  ) : null}
                </View>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                  {w.durationMin} Min · ~{w.estBurnKcal} kcal · {w.category === 'calisthenics' ? (lang === 'de' ? 'Eigengewicht' : 'Bodyweight') : w.sport}
                </Txt>
              </View>
              <View style={{ marginLeft: Space.sm, transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}>
                <Icon name="chevronRight" size={18} color={c.textDim} />
              </View>
            </Tap>

            {isExpanded && (
              <View style={[s.expandedBody, { borderTopColor: c.line }]}>
                <View style={[s.fastingBox, { backgroundColor: washOf(c[w.hue]), borderColor: c.line }]}>
                  <Eyebrow color={c[w.hue]}>{t('workout.fastingNote')}</Eyebrow>
                  <Txt variant="small" color={c.text} style={{ marginTop: 4, lineHeight: 19 }}>
                    {w.fastingNote[lang]}
                  </Txt>
                </View>

                <Eyebrow color={c.textDim} style={{ marginTop: Space.base, marginBottom: Space.sm }}>
                  {t('workout.exercises')} ({specs.length})
                </Eyebrow>

                {specs.map((ex) => {
                  const sets = getDraft(w.id, ex.id, ex.targetSets, ex.targetRepsMin);
                  const prev = lastExercisePerformance(ex.id, workoutLog);
                  const ready = isProgressionReady(ex, prev);
                  const unitSuffix = ex.unit === 'sec' ? 's' : '';

                  return (
                    <View key={ex.id} style={[s.exerciseCard, { backgroundColor: c.well, borderColor: c.line }]}>
                      <View style={s.rowBetween}>
                        <Txt variant="bodyMedium" style={{ fontWeight: '600', flex: 1 }}>
                          {ex.name[lang]}
                        </Txt>
                        <Txt variant="small" color={c.textDim}>
                          {ex.targetSets} × {ex.targetRepsMin}–{ex.targetRepsMax}{unitSuffix}
                        </Txt>
                      </View>
                      <Txt variant="small" color={c.textFaint} style={{ marginTop: 2 }}>
                        {ex.notes[lang]}
                      </Txt>

                      {prev ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Space.xs, flexWrap: 'wrap' }}>
                          <Txt variant="small" color={c.textDim}>
                            {lang === 'de' ? 'Letztes Mal: ' : 'Last time: '}
                            {formatSetsSummary(prev, ex.unit, lang)}
                          </Txt>
                          {ready ? (
                            <View style={[s.badgePill, { backgroundColor: washOf(c.positive), borderColor: c.positive, marginLeft: Space.xs }]}>
                              <Txt variant="small" color={c.positive} style={{ fontSize: 11, fontWeight: '600' }}>
                                {lang === 'de' ? '+1–2 Wdh. / Stufe hoch' : 'Ready to progress'}
                              </Txt>
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      {/* Per-Set Rep Tracker */}
                      <View style={s.setsGrid}>
                        {sets.map((st, sIdx) => (
                          <View key={sIdx} style={[s.setBox, { backgroundColor: c.surface, borderColor: c.line }]}>
                            <Txt variant="small" color={c.textFaint} style={{ fontSize: 11 }}>
                              {lang === 'de' ? `Satz ${sIdx + 1}` : `Set ${sIdx + 1}`}
                            </Txt>
                            <View style={s.stepperRow}>
                              <Tap
                                onPress={() => updateSetReps(w.id, ex.id, ex.targetSets, ex.targetRepsMin, sIdx, st.reps - 1)}
                                accessibilityLabel={`Decrease set ${sIdx + 1}`}
                                style={[s.stepBtn, { borderColor: c.line }]}
                              >
                                <Txt variant="bodyMedium" color={c.text}>-</Txt>
                              </Tap>
                              <TextInput
                                value={String(st.reps)}
                                onChangeText={(v) => {
                                  const n = parseInt(v.replace(/\D/g, ''), 10);
                                  updateSetReps(w.id, ex.id, ex.targetSets, ex.targetRepsMin, sIdx, Number.isFinite(n) ? n : 0);
                                }}
                                keyboardType="numeric"
                                inputMode="numeric"
                                accessibilityLabel={`${ex.name[lang]} set ${sIdx + 1}`}
                                style={[s.repInput, { color: c.text }]}
                              />
                              <Tap
                                onPress={() => updateSetReps(w.id, ex.id, ex.targetSets, ex.targetRepsMin, sIdx, st.reps + 1)}
                                accessibilityLabel={`Increase set ${sIdx + 1}`}
                                style={[s.stepBtn, { borderColor: c.line }]}
                              >
                                <Txt variant="bodyMedium" color={c.text}>+</Txt>
                              </Tap>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                <View style={s.actionRow}>
                  <Button
                    label={
                      isSaved
                        ? lang === 'de' ? 'Gespeichert ✓' : 'Saved ✓'
                        : lang === 'de' ? 'Wiederholungen speichern' : 'Save workout & reps'
                    }
                    variant={isSaved ? 'secondary' : 'primary'}
                    onPress={() => logWorkout(w)}
                    style={{ marginBottom: Space.sm }}
                  />
                  <Button
                    label={isApplied ? t('workout.applied') : t('workout.applyToPlan')}
                    icon="plate"
                    variant="secondary"
                    onPress={() => applyWorkout(w)}
                  />
                </View>
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const s = StyleSheet.create({
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
  },
  card: {
    marginBottom: Space.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandedBody: {
    marginTop: Space.base,
    paddingTop: Space.base,
    borderTopWidth: 1,
  },
  fastingBox: {
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  exerciseCard: {
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Space.sm,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  setsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Space.sm,
  },
  setBox: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Space.xs,
    paddingVertical: 6,
    marginRight: Space.xs,
    marginBottom: Space.xs,
    alignItems: 'center',
    minWidth: 94,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repInput: {
    width: 36,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 2,
  },
  actionRow: {
    marginTop: Space.sm,
  },
});
