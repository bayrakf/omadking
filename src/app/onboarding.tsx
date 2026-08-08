import { useState, useRef } from 'react';
import {
  View, TextInput, StyleSheet, Animated, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Space, Radius, Type, MaxContentWidth } from '@/constants/theme';
import { Txt, Eyebrow, Button, Chip, Tap, Card, Divider, useTheme, useReducedMotion } from '@/components/ui';
import { Icon } from '@/components/icons';
import {
  normalizeProfile, normTime, toMinutes, fromMinutes, PROTOCOLS, protocolForHours,
  targetWeight, dailyTargets, bmr, paceDeficit, PACE_OPTIONS, DEFAULT_DEFICIT_KCAL,
  type FitnessLevel, type Goal, type Sex,
} from '@/lib/nutrition';
import { completeOnboarding } from '@/lib/store';
import { resync } from '@/lib/notify';

type Draft = {
  weight_kg: string; height_cm: string; age: string;
  sex: Sex | null; fitness_level: FitnessLevel | null; goal: Goal | null;
  omad_window_start: string; omad_window_hours: number; default_training_time: string;
  target_weight_kg: string; weekly_rate_kg: number | null;
};

/**
 * Six now. The goal and the rate used to be assumed rather than asked: a
 * healthy-BMI midpoint nobody agreed to, and a 500 kcal deficit identical for
 * a 120 kg body and a 60 kg one. The forecast then said "about 47 weeks to
 * 73.7 kg" about a number the person had never seen.
 */
const STEPS = 6;
const EAT_PRESETS = ['12:00', '14:00', '16:00', '18:00'];
const TRAIN_PRESETS = ['06:00', '12:00', '18:00', '19:00'];
const LIMITS = { weight_kg: [30, 300], height_cm: [120, 250], age: [14, 100] } as const;

export default function OnboardingScreen() {
  const c = useTheme();
  const router = useRouter();
  const reduced = useReducedMotion();

  const [data, setData] = useState<Draft>({
    weight_kg: '', height_cm: '', age: '',
    sex: null, fitness_level: null, goal: null,
    omad_window_start: '18:00', omad_window_hours: 2, default_training_time: '18:00',
    target_weight_kg: '', weekly_rate_kg: null,
  });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const go = (next: number) => {
    if (reduced) return setStep(next);
    const dir = next > step ? -1 : 1;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(slide, { toValue: dir * 28, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slide.setValue(-dir * 28);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 190, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 190, useNativeDriver: true }),
      ]).start();
    });
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setData((p) => ({ ...p, [k]: v }));

  /**
   * The profile as it will actually be stored.
   *
   * A rate that would put someone under their resting expenditure is shown and
   * explained on the step, but never written — the screen tells the truth and
   * the profile stays honest. Used by the summary too, so what is reviewed is
   * what is saved.
   */
  const savedProfile = () => {
    const draft = normalizeProfile({ ...data, weekly_rate_kg: null });
    const chosen = data.weekly_rate_kg;
    const pace = chosen != null && draft.goal === 'weight_loss'
      ? paceDeficit(chosen, dailyTargets({ ...draft, goal: 'performance' }, null).maintenance_kcal, bmr(draft))
      : null;
    // normalizeProfile clamps and canonicalises, so the store never sees
    // 'Male' or a 400kg bodyweight.
    return normalizeProfile({ ...data, weekly_rate_kg: pace && pace.allowed ? chosen : null });
  };

  const finish = async () => {
    setSaving(true);
    await completeOnboarding(savedProfile());
    // Reminders are off until opted in; this only primes the schedule.
    await resync();
    router.replace('/');
  };

  const numError = (f: 'weight_kg' | 'height_cm' | 'age') => {
    const raw = data[f];
    if (!raw) return null;
    const n = parseFloat(raw);
    const [min, max] = LIMITS[f];
    if (!isFinite(n)) return 'Numbers only';
    if (n < min || n > max) return `Between ${min} and ${max}`;
    return null;
  };
  const numOk = (f: 'weight_kg' | 'height_cm' | 'age') => {
    const n = parseFloat(data[f]);
    const [min, max] = LIMITS[f];
    return isFinite(n) && n >= min && n <= max;
  };

  /** The target and rate step means nothing to someone maintaining or gaining. */
  const skips = (n: number) => n === 4 && data.goal !== 'weight_loss';

  const blocked = () => {
    if (step === 1) return !numOk('weight_kg') || !numOk('height_cm') || !numOk('age') || !data.sex;
    if (step === 2) return !data.fitness_level || !data.goal;
    if (step === 3) return !/^\d{1,2}:\d{2}$/.test(data.omad_window_start) || !/^\d{1,2}:\d{2}$/.test(data.default_training_time);
    return false;
  };

  const numField = (f: 'weight_kg' | 'height_cm' | 'age', label: string, hint: string) => (
    <NumField key={f} f={f} label={label} hint={hint} value={data[f]} error={numError(f)} onChange={set} />
  );

  const timePicker = (k: TimeKey, presets: string[], label: string) => (
    <TimePicker key={k} k={k} presets={presets} label={label} value={data[k]} onChange={set} />
  );

  const render = () => {
    switch (step) {
      case 0:
        return (
          <View style={s.centre}>
            <Eyebrow color={c.accent}>One meal a day · built for training</Eyebrow>
            <Txt variant="display" style={{ marginTop: Space.base }}>
              Eat once.{'\n'}Time it right.
            </Txt>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.base }}>
              Four questions, about a minute. Then you get the exact times to eat around the sessions you actually do.
            </Txt>
          </View>
        );

      case 1:
        return (
          <View style={s.centre}>
            <Txt variant="title">Your body</Txt>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.sm }}>
              Sets your energy and protein targets.
            </Txt>
            <View style={[s.row, { marginTop: Space.xl }]}>
              {numField('weight_kg', 'Weight · kg', '82')}
              <View style={{ width: Space.md }} />
              {numField('height_cm', 'Height · cm', '183')}
            </View>
            <View style={{ marginTop: Space.base }}>
              {numField('age', 'Age', '34')}
            </View>
            <View style={{ marginTop: Space.xl }}>
              <Eyebrow style={{ marginBottom: Space.md }}>Sex</Eyebrow>
              <View style={s.wrap}>
                {(['male', 'female', 'other'] as Sex[]).map((v) => (
                  <Chip
                    key={v}
                    label={v[0].toUpperCase() + v.slice(1)}
                    selected={data.sex === v}
                    onPress={() => set('sex', v)}
                    style={s.chip}
                  />
                ))}
              </View>
              <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md }}>
                Only affects the metabolic rate formula.
              </Txt>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={s.centre}>
            <Txt variant="title">Training and goal</Txt>
            <View style={{ marginTop: Space.xl }}>
              <Eyebrow style={{ marginBottom: Space.md }}>How long have you trained?</Eyebrow>
              <View style={s.wrap}>
                {([['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']] as [FitnessLevel, string][]).map(([v, l]) => (
                  <Chip key={v} label={l} selected={data.fitness_level === v} onPress={() => set('fitness_level', v)} style={s.chip} />
                ))}
              </View>
            </View>
            <View style={{ marginTop: Space.xl }}>
              <Eyebrow style={{ marginBottom: Space.md }}>What are you after?</Eyebrow>
              <View style={s.wrap}>
                {([['performance', 'Performance'], ['weight_loss', 'Lose fat'], ['muscle_gain', 'Build muscle']] as [Goal, string][]).map(([v, l]) => (
                  <Chip key={v} label={l} selected={data.goal === v} onPress={() => set('goal', v)} style={s.chip} />
                ))}
              </View>
            </View>
          </View>
        );

      case 4: {
        // Only for weight loss: a target and a rate mean nothing to somebody
        // maintaining or gaining.
        const p = normalizeProfile({ ...data, target_weight_kg: null });
        const suggestion = targetWeight(p, p.weight_kg);
        const maintenance = dailyTargets({ ...p, goal: 'performance' }, null).maintenance_kcal;
        const floor = bmr(p);
        return (
          <View style={s.centre}>
            <Txt variant="title">Where to, and how fast</Txt>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.sm, textAlign: 'center' }}>
              Both are editable later, and both are only a direction.
            </Txt>

            <View style={{ marginTop: Space.xl, width: '100%' }}>
              <NumField
                f="target_weight_kg"
                label="Target weight · kg"
                hint={String(suggestion)}
                value={data.target_weight_kg}
                error={null}
                onChange={set}
              />
              {/* Visible, not a placeholder: a placeholder vanishes the moment
                  someone types, and this is the number they are agreeing to by
                  leaving the field alone. */}
              <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
                Leave it empty to use {suggestion} kg, the middle of the healthy range for your height.
              </Txt>
            </View>

            <View style={{ marginTop: Space.xl, width: '100%' }}>
              <Eyebrow style={{ marginBottom: Space.md }}>How fast</Eyebrow>
              <View style={s.wrap}>
                {PACE_OPTIONS.map((rate) => {
                  return (
                    <Chip
                      key={rate}
                      label={`${rate} kg / week`}
                      selected={data.weekly_rate_kg === rate}
                      onPress={() => set('weekly_rate_kg', data.weekly_rate_kg === rate ? null : rate)}
                      style={s.chip}
                    />
                  );
                })}
              </View>
              {/* The consequence next to the choice, which is the part every
                  other app leaves out. An option that would put someone under
                  their resting expenditure says so instead of being clamped
                  quietly to something the app is not actually delivering. */}
              {data.weekly_rate_kg !== null && (() => {
                const pace = paceDeficit(data.weekly_rate_kg, maintenance, floor)!;
                return (
                  <Txt variant="small" color={pace.allowed ? c.textDim : c.ember} style={{ marginTop: Space.md }}>
                    {pace.allowed
                      ? `${pace.deficitKcal} kcal a day under what your body uses — about ${pace.targetKcal} kcal to eat.`
                      : `That would leave ${pace.targetKcal} kcal a day, below the ${floor} your body uses at rest. The app will not set it.`}
                  </Txt>
                );
              })()}
              {data.weekly_rate_kg === null && (
                <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md }}>
                  Skip it and the app uses its standard {DEFAULT_DEFICIT_KCAL} kcal a day.
                </Txt>
              )}
            </View>
          </View>
        );
      }

      case 3:
        return (
          <View style={s.centre}>
            <Txt variant="title">Your window</Txt>
            {timePicker('omad_window_start', EAT_PRESETS, 'Window opens at')}
            <View style={{ marginTop: Space.xl }}>
              <Eyebrow style={{ marginBottom: Space.md }}>How long is it open?</Eyebrow>
              <View style={s.wrap}>
                {/* Named shapes rather than bare hours: "2h" says nothing about
                    what you are choosing. */}
                {PROTOCOLS.map((proto) => (
                  <Chip
                    key={proto.id}
                    label={proto.label}
                    selected={data.omad_window_hours === proto.windowHours}
                    onPress={() => set('omad_window_hours', proto.windowHours)}
                    style={s.chip}
                  />
                ))}
              </View>
              {protocolForHours(data.omad_window_hours) && (
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                  {protocolForHours(data.omad_window_hours)!.note}
                </Txt>
              )}
              <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md }}>
                That is a {24 - data.omad_window_hours} hour fast every day.
              </Txt>
            </View>
            {timePicker('default_training_time', TRAIN_PRESETS, 'You usually train at')}
          </View>
        );

      default: {
        const p = savedProfile();
        const end = fromMinutes(toMinutes(p.omad_window_start) + p.omad_window_hours * 60);
        return (
          <View style={s.centre}>
            <Icon name="check" size={26} color={c.accent} strokeWidth={2.2} />
            <Txt variant="title" style={{ marginTop: Space.base }}>That’s everything</Txt>
            <Card style={{ marginTop: Space.xl, paddingVertical: Space.sm }}>
              {([
                ['Eating window', `${p.omad_window_start}–${end}`],
                ['Daily fast', `${24 - p.omad_window_hours}h`],
                ['Usual training', p.default_training_time],
                ['Goal', p.goal.replace('_', ' ')],
                ...(p.goal === 'weight_loss'
                  ? ([
                      ['Target', `${targetWeight(p, p.weight_kg)} kg`],
                          ['Pace', p.weekly_rate_kg ? `${p.weekly_rate_kg} kg / week` : 'standard'],
                    ] as const)
                  : []),
              ] as const).map(([label, value], i) => (
                <View key={label}>
                  {i > 0 && <Divider />}
                  <View style={s.summaryRow}>
                    <Txt variant="body" color={c.textDim}>{label}</Txt>
                    <Txt variant="data" color={c.text}>{value}</Txt>
                  </View>
                </View>
              ))}
            </Card>
            <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.base }}>
              All of this is editable later under You.
            </Txt>
          </View>
        );
      }
    }
  };

  const label = step === 0 ? 'Start' : step === STEPS - 1 ? 'Open the app' : 'Continue';

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          {step > 0 ? (
            <Tap onPress={() => go(skips(step - 1) ? step - 2 : step - 1)} accessibilityLabel="Back">
              <View style={s.back}><Icon name="chevronLeft" size={20} color={c.textDim} /></View>
            </Tap>
          ) : (
            <View style={s.back} />
          )}
          {/* Real sequence, so a step counter genuinely carries information. */}
          <Eyebrow>{String(step + 1).padStart(2, '0')} / {String(STEPS).padStart(2, '0')}</Eyebrow>
          <View style={s.back} />
        </View>

        <View style={[s.progress, { backgroundColor: c.well }]}>
          <View style={[s.progressFill, { backgroundColor: c.accent, width: `${((step + 1) / STEPS) * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={[s.animated, { opacity: fade, transform: [{ translateX: slide }] }]}>
            {render()}
          </Animated.View>
        </ScrollView>

        <View style={s.footer}>
          <Button
            label={label}
            onPress={step === STEPS - 1 ? finish : () => go(skips(step + 1) ? step + 2 : step + 1)}
            disabled={blocked() || saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type NumKey = 'weight_kg' | 'height_cm' | 'age' | 'target_weight_kg';
type TimeKey = 'omad_window_start' | 'default_training_time';

/**
 * Both of these lived inside OnboardingScreen, which made them a new component
 * type on every render — so React discarded the TextInput and mounted a fresh
 * one after every keystroke, and the field lost focus on each character. On the
 * first screen anyone ever sees, while typing their weight.
 */
function NumField({ f, label, hint, value, error, onChange }: {
  f: NumKey; label: string; hint: string; value: string; error: string | null;
  onChange: (f: NumKey, v: any) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Eyebrow style={{ marginBottom: Space.sm }}>{label}</Eyebrow>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(f, v.replace(',', '.'))}
        keyboardType="numeric"
        inputMode="decimal"
        placeholder={hint}
        placeholderTextColor={c.textFaint}
        accessibilityLabel={label}
        style={[Type.data, s.input, { color: c.text, backgroundColor: c.well, borderColor: error ? c.negative : c.line }]}
      />
      {error && <Txt variant="small" color={c.negative} style={{ marginTop: 5 }}>{error}</Txt>}
    </View>
  );
}

function TimePicker({ k, presets, label, value, onChange }: {
  k: TimeKey; presets: string[]; label: string; value: string;
  onChange: (k: TimeKey, v: string) => void;
}) {
  const c = useTheme();
  const custom = !presets.includes(value);
  return (
    <View style={{ marginTop: Space.xl }}>
      <Eyebrow style={{ marginBottom: Space.md }}>{label}</Eyebrow>
      <View style={s.wrap}>
        {presets.map((p) => (
          <Chip key={p} label={p} selected={value === p} onPress={() => onChange(k, p)} style={s.chip} />
        ))}
        <Chip label="Other" selected={custom} onPress={() => onChange(k, custom ? presets[0] : '')} style={s.chip} />
      </View>
      {custom && (
        <TextInput
          value={value}
          onChangeText={(v) => onChange(k, v)}
          onBlur={() => onChange(k, normTime(value, presets[0]))}
          placeholder="HH:MM"
          placeholderTextColor={c.textFaint}
          accessibilityLabel={label}
          style={[Type.data, s.input, { color: c.text, backgroundColor: c.well, borderColor: c.line, marginTop: Space.md }]}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.base, height: 48,
    maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progress: {
    height: 2, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%',
    marginBottom: Space.base,
  },
  progressFill: { height: '100%' },
  scroll: { flexGrow: 1, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  animated: { flex: 1, paddingHorizontal: Space.lg },
  centre: { flex: 1, justifyContent: 'center', paddingVertical: Space.xl },
  row: { flexDirection: 'row' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -Space.sm },
  chip: { marginRight: Space.sm, marginBottom: Space.sm },
  input: { height: 50, borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: Space.base, fontSize: 15 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Space.base },
  footer: {
    padding: Space.lg, paddingBottom: Platform.OS === 'ios' ? Space.sm : Space.lg,
    maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%',
  },
});
