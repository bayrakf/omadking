import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import { Txt, useTheme, Eyebrow } from './ui';
import { Icon } from './icons';

interface MetabolicStageBarProps {
  hoursFasted: number;
}

export function MetabolicStageBar({ hoursFasted }: MetabolicStageBarProps) {
  const c = useTheme();
  const router = useRouter();

  const stages = [
    {
      id: 'glucose',
      label: 'Blutzucker',
      range: '0–4h',
      minH: 0,
      maxH: 4,
      color: '#F59E0B',
      wash: 'rgba(245, 158, 11, 0.2)',
      desc: 'Insulin sinkt, Verdauung schließt ab',
    },
    {
      id: 'glycogen',
      label: 'Glykogen-Abfall',
      range: '4–12h',
      minH: 4,
      maxH: 12,
      color: '#FF6B4A',
      wash: 'rgba(255, 107, 74, 0.2)',
      desc: 'Leberspeicher leeren sich, Glukose sinkt',
    },
    {
      id: 'ketosis',
      label: 'Ketose & Fett',
      range: '12–18h',
      minH: 12,
      maxH: 18,
      color: '#8B5CF6',
      wash: 'rgba(139, 92, 246, 0.2)',
      desc: 'Ketonkörper steigen, aktive Fettverbrennung',
    },
    {
      id: 'autophagy',
      label: 'Autophagie',
      range: '18–24h+',
      minH: 18,
      maxH: 24,
      color: '#10B981',
      wash: 'rgba(16, 185, 129, 0.2)',
      desc: 'Zelluläre Selbstreinigung & Verjüngung',
    },
  ];

  // Current active stage
  const currentStageIndex = stages.findIndex(
    (s) => hoursFasted >= s.minH && (hoursFasted < s.maxH || s.maxH === 24)
  );
  const activeIndex = currentStageIndex === -1 ? (hoursFasted >= 24 ? 3 : 0) : currentStageIndex;
  const activeStage = stages[activeIndex];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push('/timer')}
      style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <View style={s.headRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[s.iconBox, { backgroundColor: activeStage.wash }]}>
            <Icon name="flame" size={16} color={activeStage.color} />
          </View>
          <View style={{ marginLeft: Space.sm }}>
            <Eyebrow color={activeStage.color}>Aktuelle Phase · Tap für Vollbild</Eyebrow>
            <Txt variant="subheading" style={{ fontSize: 16, fontWeight: '800', marginTop: 1 }}>
              {activeStage.label} ({hoursFasted.toFixed(1)}h gefastet)
            </Txt>
          </View>
        </View>
        <View style={[s.stageBadge, { backgroundColor: activeStage.wash, borderColor: activeStage.color }]}>
          <Txt variant="data" color={activeStage.color} style={{ fontSize: 11, fontWeight: '700' }}>
            {activeStage.range}
          </Txt>
        </View>
      </View>

      {/* Multi-segment Bar (Screenshot 2 style) */}
      <View style={s.multiBarContainer}>
        {stages.map((stg, i) => {
          const isPassed = hoursFasted >= stg.maxH;
          const isCurrent = i === activeIndex;
          const progressInStage = isCurrent
            ? Math.min(1, Math.max(0, (hoursFasted - stg.minH) / (stg.maxH - stg.minH)))
            : isPassed
              ? 1
              : 0;

          return (
            <View key={stg.id} style={s.segmentTrack}>
              <View
                style={[
                  s.segmentFill,
                  {
                    width: `${progressInStage * 100}%`,
                    backgroundColor: stg.color,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Stage Labels */}
      <View style={s.labelsRow}>
        {stages.map((stg, i) => {
          const isCurrent = i === activeIndex;
          return (
            <View key={stg.id} style={s.labelCell}>
              <Txt
                variant="eyebrow"
                color={isCurrent ? stg.color : c.textFaint}
                style={{ fontSize: 9, fontWeight: isCurrent ? '800' : '600' }}
              >
                {stg.range}
              </Txt>
            </View>
          );
        })}
      </View>

      <View style={[s.descBox, { backgroundColor: c.well, borderColor: c.line }]}>
        <Txt variant="small" color={c.textDim} style={{ lineHeight: 18 }}>
          {activeStage.desc}
        </Txt>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  multiBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  segmentTrack: {
    flex: 1,
    height: '100%',
    marginHorizontal: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  labelCell: {
    flex: 1,
    alignItems: 'center',
  },
  descBox: {
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Space.xs,
  },
});
