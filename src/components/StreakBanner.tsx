import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, useTheme } from './ui';
import { Icon } from './icons';
import { useT } from './lang';
import { todayISO } from '@/lib/dates';

interface StreakBannerProps {
  streak: number;
  fastLog: string[];
}

export function StreakBanner({ streak, fastLog }: StreakBannerProps) {
  const c = useTheme();
  const t = useT();
  const [showInfo, setShowInfo] = useState(false);

  const today = todayISO();
  const now = new Date();

  // Show the last 5 days up to today and tomorrow
  const tokenDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (4 - i));
    const iso = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const isToday = iso === today;
    const isFuture = iso > today;
    const completed = fastLog.includes(iso);

    return {
      date: iso,
      dayLabel,
      isToday,
      isFuture,
      completed,
    };
  });

  return (
    <View style={[s.card, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
      <View style={s.topRow}>
        <View style={s.streakLeft}>
          <View style={[s.flameBadge, { backgroundColor: c.emberWash }]}>
            <Icon name="flame" size={20} color={c.ember} />
          </View>
          <View style={{ marginLeft: Space.sm }}>
            <Txt variant="subheading" style={{ fontSize: 17, fontWeight: '800' }}>
              {t('today.streakTitle', { n: streak })}
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 12, marginTop: 1 }}>
              {streak > 0 ? `${streak} Tage in Folge erfolgreich gefastet` : 'Starte heute deine Serie'}
            </Txt>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setShowInfo((p) => !p)}
          activeOpacity={0.7}
          style={[s.infoBtn, { backgroundColor: c.well, borderColor: c.line }]}
          accessibilityLabel="Streak Info"
        >
          <Icon name="alert" size={14} color={c.textDim} />
        </TouchableOpacity>
      </View>

      {showInfo && (
        <View style={[s.infoBox, { backgroundColor: c.well, borderColor: c.line }]}>
          <Txt variant="small" color={c.textDim} style={{ lineHeight: 18 }}>
            {t('today.streakInfo')}
          </Txt>
        </View>
      )}

      {/* Horizontal Token Days */}
      <View style={s.tokenRow}>
        {tokenDays.map((item) => (
          <View key={item.date} style={s.tokenCell}>
            <Txt
              variant="eyebrow"
              color={item.isToday ? c.accent : c.textFaint}
              style={{ fontSize: 10, marginBottom: 6 }}
            >
              {item.isToday ? 'Heute' : item.dayLabel}
            </Txt>
            <View
              style={[
                s.tokenCircle,
                {
                  backgroundColor: item.completed
                    ? c.emberWash
                    : item.isToday
                      ? c.accentWash
                      : c.well,
                  borderColor: item.completed
                    ? c.ember
                    : item.isToday
                      ? c.accent
                      : c.line,
                },
              ]}
            >
              {item.completed ? (
                <Icon name="flame" size={16} color={c.ember} />
              ) : item.isToday ? (
                <Icon name="clock" size={14} color={c.accent} />
              ) : item.isFuture ? (
                <View style={[s.ghostDot, { backgroundColor: c.lineStrong }]} />
              ) : (
                <Icon name="close" size={12} color={c.textFaint} />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flameBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Space.sm,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.base,
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  tokenCell: {
    alignItems: 'center',
    flex: 1,
  },
  tokenCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
