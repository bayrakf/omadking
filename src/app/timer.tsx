import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Space, Radius, Type } from '@/constants/theme';
import { Screen, Txt, Eyebrow, Enter, Button, useTheme, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useLang } from '@/components/lang';
import { loadProfileOrDefault, loadHydration, saveHydration, markFastComplete, type Hydration } from '@/lib/store';
import { fastingState, fastingStage, formatCountdown, type UserProfile, type FastingState } from '@/lib/nutrition';
import { FastingFeelingBar } from '@/components/FastingFeelingBar';
import { todayISO } from '@/lib/dates';

const { width } = Dimensions.get('window');
const DIAL_SIZE = Math.min(width - 48, 300);
const STROKE_WIDTH = 14;
const RADIUS = (DIAL_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TimerScreen() {
  const c = useTheme();
  const { t } = useLang();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fast, setFast] = useState<FastingState | null>(null);
  const [hydration, setHydration] = useState<Hydration>({ date: todayISO(), ml: 0, electrolytes: false });
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    loadProfileOrDefault().then(setProfile);
    loadHydration().then(setHydration);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const tick = () => {
      const d = new Date();
      setFast(fastingState(profile, d));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [profile]);

  if (!fast || !profile) return null;

  const hoursFasted = fast.isEating ? 0 : fast.fastingHours * (fast.progressPct / 100);
  const stage = fastingStage(hoursFasted);
  const strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(100, fast.progressPct)) / 100;

  const addWater = async (ml: number) => {
    const nextH = { ...hydration, ml: Math.min(8000, hydration.ml + ml) };
    setHydration(nextH);
    await saveHydration(nextH);
  };

  const endAndLog = async () => {
    await markFastComplete();
    setLogged(true);
    setTimeout(() => {
      router.push('/(tabs)');
    }, 800);
  };

  const phaseColor =
    stage.id === 'deep'
      ? '#10B981'
      : stage.id === 'ketosis-rising'
        ? '#8B5CF6'
        : stage.id === 'glycogen-falling'
          ? '#FF6B4A'
          : '#F59E0B';

  return (
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          back
          eyebrow="Live Fasten-Tracker"
          title={fast.isEating ? t('today.windowOpen') : t('today.fasting')}
          tone={fast.isEating ? 'ember' : 'accent'}
        />
      </Enter>

      {/* Hero Timer Dial */}
      <Enter index={1} style={{ alignItems: 'center', marginVertical: Space.lg }}>
        <View style={[s.dialWrap, { width: DIAL_SIZE, height: DIAL_SIZE }]}>
          <Svg width={DIAL_SIZE} height={DIAL_SIZE}>
            <Defs>
              <LinearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={fast.isEating ? c.ember : '#38BDF8'} />
                <Stop offset="1" stopColor={phaseColor} />
              </LinearGradient>
            </Defs>

            {/* Background Track */}
            <Circle
              cx={DIAL_SIZE / 2}
              cy={DIAL_SIZE / 2}
              r={RADIUS}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />

            {/* Progress Arc */}
            <Circle
              cx={DIAL_SIZE / 2}
              cy={DIAL_SIZE / 2}
              r={RADIUS}
              stroke="url(#dialGrad)"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              transform={`rotate(-90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
            />
          </Svg>

          {/* Center Content */}
          <View style={s.centerContent}>
            <View
              style={[
                s.statusBadge,
                { backgroundColor: fast.isEating ? c.emberWash : 'rgba(56, 189, 248, 0.18)' },
              ]}
            >
              <Icon
                name={fast.isEating ? 'plate' : 'flame'}
                size={14}
                color={fast.isEating ? c.ember : '#38BDF8'}
              />
              <Txt
                variant="eyebrow"
                color={fast.isEating ? c.ember : '#38BDF8'}
                style={{ marginLeft: 4, fontSize: 10, fontWeight: '800' }}
              >
                {fast.isEating ? 'ESSENSFENSTER' : 'FASTEN LÄUFT'}
              </Txt>
            </View>

            <Txt variant="hero" style={[Type.hero, s.countdownNum, { color: c.text }]}>
              {formatCountdown(fast.remainingMs)}
            </Txt>

            <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
              {fast.isEating ? `Schließt um ${fast.windowEnd}` : `Essensfenster ab ${fast.windowStart}`}
            </Txt>

            <Txt variant="data" color={phaseColor} style={{ fontSize: 12, fontWeight: '700', marginTop: 6 }}>
              {Math.round(fast.progressPct)}% abgeschlossen
            </Txt>
          </View>
        </View>
      </Enter>

      {/* Biological Phase Details Card */}
      <Enter index={2}>
        <View style={[s.phaseCard, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
          <View style={s.phaseHead}>
            <View style={[s.phaseIconBox, { backgroundColor: `${phaseColor}22` }]}>
              <Icon name="flame" size={18} color={phaseColor} />
            </View>
            <View style={{ flex: 1, marginLeft: Space.sm }}>
              <Eyebrow color={phaseColor}>Biologische Stoffwechsel-Phase</Eyebrow>
              <Txt variant="subheading" style={{ fontSize: 16, fontWeight: '800', marginTop: 1 }}>
                {stage.label} ({hoursFasted.toFixed(1)}h gefastet)
              </Txt>
            </View>
          </View>
          <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm, lineHeight: 19 }}>
            {stage.note}
          </Txt>
        </View>
      </Enter>

      {/* Quick Hydration Chips */}
      <Enter index={3}>
        <View style={[s.quickHydration, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="drop" size={16} color={c.hydro} />
              <Txt variant="subheading" style={{ fontSize: 14, marginLeft: 6 }}>Hydration heute</Txt>
            </View>
            <Txt variant="data" color={c.textDim}>{(hydration.ml / 1000).toFixed(1)} L</Txt>
          </View>
          <View style={s.waterBtnRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => addWater(250)}
              style={[s.waterBtn, { backgroundColor: c.well, borderColor: c.line }]}
            >
              <Icon name="plus" size={12} color={c.hydro} />
              <Txt variant="data" color={c.text} style={{ marginLeft: 4, fontSize: 12 }}>+250ml</Txt>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => addWater(500)}
              style={[s.waterBtn, { backgroundColor: c.well, borderColor: c.line }]}
            >
              <Icon name="plus" size={12} color={c.hydro} />
              <Txt variant="data" color={c.text} style={{ marginLeft: 4, fontSize: 12 }}>+500ml</Txt>
            </TouchableOpacity>
          </View>
        </View>
      </Enter>

      {/* Daily Feeling Logger */}
      <Enter index={4}>
        <FastingFeelingBar />
      </Enter>

      {/* End Fast Button */}
      <Enter index={5} style={{ marginBottom: 40 }}>
        <Button
          label={logged ? 'Fasten erfolgreich geloggt ✓' : 'Fasten für heute abschließen & loggen'}
          icon="check"
          tone={logged ? 'plan' : 'accent'}
          onPress={endAndLog}
        />
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  dialWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: DIAL_SIZE - 40,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginBottom: Space.xs,
  },
  countdownNum: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  phaseCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  phaseHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickHydration: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  waterBtnRow: {
    flexDirection: 'row',
    marginTop: Space.sm,
  },
  waterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: Space.xs,
  },
});
