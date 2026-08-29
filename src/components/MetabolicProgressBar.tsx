import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, Eyebrow, useTheme } from './ui';
import { Icon } from './icons';
import { useLang } from './lang';

interface MetabolicProgressBarProps {
  hoursFasted: number;
  onPress: () => void;
}

const PHASES = [
  { id: 'fed', from: 0, to: 4, label: '0–4h', nameDe: 'Verdauung', nameEn: 'Fed', hue: 'gold' as const },
  { id: 'post-absorptive', from: 4, to: 12, label: '4–12h', nameDe: 'Post-absorptiv', nameEn: 'Post-absorptive', hue: 'ember' as const },
  { id: 'glycogen-falling', from: 12, to: 16, label: '12–16h', nameDe: 'Glykogen sinkt', nameEn: 'Glycogen falling', hue: 'accent' as const },
  { id: 'ketosis-rising', from: 16, to: 20, label: '16–20h', nameDe: 'Ketose steigt', nameEn: 'Ketones rising', hue: 'plan' as const },
  { id: 'deep', from: 20, to: 24, label: '20h+', nameDe: 'Tiefe Autophagie', nameEn: 'Deep fast', hue: 'body' as const },
];

export function MetabolicProgressBar({ hoursFasted, onPress }: MetabolicProgressBarProps) {
  const c = useTheme();
  const { lang } = useLang();

  // Find active phase and next milestone
  const activePhase =
    PHASES.find((p) => hoursFasted >= p.from && (hoursFasted < p.to || p.to === 24)) ?? PHASES[0];

  const nextPhase = PHASES.find((p) => p.from > hoursFasted);
  const hoursUntilNext = nextPhase ? Math.max(0, nextPhase.from - hoursFasted) : 0;
  const nextMin = Math.round(hoursUntilNext * 60);

  const nextMilestoneNote = nextPhase
    ? lang === 'de'
      ? `Noch ${nextMin >= 60 ? `${Math.floor(nextMin / 60)}h ${nextMin % 60}m` : `${nextMin}m`} bis ${nextPhase.nameDe}`
      : `${nextMin >= 60 ? `${Math.floor(nextMin / 60)}h ${nextMin % 60}m` : `${nextMin}m`} until ${nextPhase.nameEn}`
    : lang === 'de'
    ? 'Maximale Autophagie & Zellreinigung aktiv 🔥'
    : 'Maximum autophagy & cell renewal active 🔥';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[s.container, { backgroundColor: c.surface, borderColor: c.line }]}
      accessibilityLabel={`Metabolische Phase: ${lang === 'de' ? activePhase.nameDe : activePhase.nameEn} (approximate)`}
    >
      <View style={s.headRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="flame" size={13} color={c[activePhase.hue]} />
          <Eyebrow color={c[activePhase.hue]} style={{ marginLeft: 5, fontSize: 10, fontWeight: '700' }}>
            {lang === 'de' ? activePhase.nameDe.toUpperCase() : activePhase.nameEn.toUpperCase()} ({hoursFasted.toFixed(1)}h · {lang === 'de' ? 'ungefähr' : 'approximate'})
          </Eyebrow>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt variant="small" color={c.textDim} style={{ fontSize: 11 }}>
            {nextMilestoneNote}
          </Txt>
          <View style={{ marginLeft: 4 }}>
            <Icon name="chevronRight" size={12} color={c.textDim} />
          </View>
        </View>
      </View>

      {/* Segmented Track */}
      <View style={s.trackRow}>
        {PHASES.map((phase, i) => {
          const isPassed = hoursFasted >= phase.to;
          const isCurrent = hoursFasted >= phase.from && (hoursFasted < phase.to || phase.to === 24);
          const segProgress = isPassed
            ? 1
            : isCurrent
            ? Math.max(0.08, (hoursFasted - phase.from) / (phase.to - phase.from))
            : 0;

          const color = c[phase.hue];

          return (
            <View key={phase.id} style={[s.segWrap, { marginRight: i < PHASES.length - 1 ? 3 : 0 }]}>
              <View style={[s.segTrack, { backgroundColor: c.well }]}>
                {segProgress > 0 && (
                  <View
                    style={[
                      s.segFill,
                      {
                        width: `${segProgress * 100}%`,
                        backgroundColor: color,
                        borderTopLeftRadius: 3,
                        borderBottomLeftRadius: 3,
                        borderTopRightRadius: isPassed ? 3 : 2,
                        borderBottomRightRadius: isPassed ? 3 : 2,
                      },
                    ]}
                  />
                )}
              </View>
              <View style={s.labelRow}>
                <Txt
                  variant="eyebrow"
                  color={isCurrent ? color : isPassed ? c.textDim : c.textFaint}
                  style={{ fontSize: 9, fontWeight: isCurrent ? '800' : '600' }}
                >
                  {lang === 'de' ? phase.nameDe : phase.nameEn}
                </Txt>
                <Txt variant="eyebrow" color={c.textFaint} style={{ fontSize: 8 }}>
                  {phase.label}
                </Txt>
              </View>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.md,
    marginTop: Space.sm,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segWrap: {
    flex: 1,
  },
  segTrack: {
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
    position: 'relative',
  },
  segFill: {
    height: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 1,
  },
});
