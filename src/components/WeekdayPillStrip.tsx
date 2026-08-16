import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Radius } from '@/constants/theme';
import { Txt, useTheme } from './ui';
import { Icon } from './icons';
import { todayISO, formatReadableDate, GERMAN_WEEKDAYS_SHORT, ENGLISH_WEEKDAYS_SHORT } from '@/lib/dates';
import { useLang } from './lang';
import { useRouter } from 'expo-router';
import { haptic } from '@/lib/haptic';

interface WeekdayPillStripProps {
  fastLog?: string[];
  streak?: number;
  longestStreakCount?: number;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

export function WeekdayPillStrip({
  fastLog = [],
  streak = 0,
  longestStreakCount = 0,
  selectedDate,
  onSelectDate,
}: WeekdayPillStripProps) {
  const c = useTheme();
  const { lang } = useLang();
  const router = useRouter();
  const today = todayISO();
  const currentSelected = selectedDate ?? today;

  // Generate the 7 days of the current week (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
  const mondayOffset = (dayOfWeek + 6) % 7; // Monday = 0

  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);

  const shortLabels = lang === 'de' ? GERMAN_WEEKDAYS_SHORT : ENGLISH_WEEKDAYS_SHORT;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const isToday = iso === today;
    const isPast = iso < today;
    const isSelected = iso === currentSelected;
    const isFastCompleted = fastLog.includes(iso);

    return {
      date: iso,
      dayNum: d.getDate(),
      label: shortLabels[i],
      isToday,
      isPast,
      isSelected,
      isFastCompleted,
    };
  });

  const isPersonalBest = streak > 0 && streak >= longestStreakCount;

  return (
    <View style={s.wrapper}>
      {/* Readable full date banner */}
      <View style={s.dateHeaderRow}>
        <Txt variant="subheading" style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
          {formatReadableDate(currentSelected, lang)}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {streak > 0 && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                haptic('light');
                router.push('/achievements');
              }}
              style={[s.todayBadge, { backgroundColor: isPersonalBest ? '#FEF3C7' : c.emberWash, borderColor: isPersonalBest ? '#F59E0B' : c.ember, marginRight: 6, flexDirection: 'row', alignItems: 'center' }]}
              accessibilityLabel={`Streak: ${streak} days. Personal record: ${longestStreakCount}. Tap to view achievements.`}
            >
              <Icon name={isPersonalBest ? 'crown' : 'flame'} size={10} color={isPersonalBest ? '#D97706' : c.ember} />
              <Txt variant="data" color={isPersonalBest ? '#B45309' : c.ember} style={{ fontSize: 10, fontWeight: '800', marginLeft: 3 }}>
                {streak} {lang === 'de' ? (streak === 1 ? 'TAG' : 'TAGE') : (streak === 1 ? 'DAY' : 'DAYS')}
                {longestStreakCount > streak && ` · MAX ${longestStreakCount}`}
                {isPersonalBest && streak >= 3 && ' · 👑 REKORD'}
              </Txt>
            </TouchableOpacity>
          )}
          {currentSelected === today && (
            <View style={[s.todayBadge, { backgroundColor: c.accentWash, borderColor: c.accent }]}>
              <Txt variant="data" color={c.accent} style={{ fontSize: 10, fontWeight: '800' }}>
                {lang === 'de' ? 'HEUTE' : 'TODAY'}
              </Txt>
            </View>
          )}
        </View>
      </View>

      {/* 7-Day Pill Strip */}
      <View style={s.container}>
        {days.map((item) => (
          <TouchableOpacity
            key={item.date}
            activeOpacity={0.7}
            onPress={() => onSelectDate?.(item.date)}
            style={[
              s.pill,
              {
                backgroundColor: item.isSelected
                  ? c.text
                  : item.isToday
                    ? c.surfaceElevated ?? c.surface
                    : 'transparent',
                borderColor: item.isSelected
                  ? c.text
                  : item.isToday
                    ? c.accent
                    : c.line,
              },
            ]}
            accessibilityLabel={`${item.label} ${item.dayNum}`}
            accessibilityState={{ selected: item.isSelected }}
          >
            <Txt
              variant="eyebrow"
              color={
                item.isSelected
                  ? c.bg
                  : item.isToday
                    ? c.accent
                    : c.textFaint
              }
              style={{ fontSize: 10, fontWeight: '700' }}
            >
              {item.label}
            </Txt>
            <Txt
              variant="heading"
              color={
                item.isSelected
                  ? c.bg
                  : item.isToday
                    ? c.text
                    : c.textDim
              }
              style={{ fontSize: 15, fontWeight: item.isSelected || item.isToday ? '800' : '600', marginTop: 2 }}
            >
              {item.dayNum}
            </Txt>

            {/* Streak & Completion Indicator */}
            <View style={s.tokenSlot}>
              {item.isFastCompleted ? (
                <Icon name="flame" size={12} color={item.isSelected ? c.bg : c.ember} />
              ) : item.isPast ? (
                <View
                  style={[
                    s.missedDot,
                    { backgroundColor: item.isSelected ? c.bg : c.lineStrong },
                  ]}
                />
              ) : (
                <View style={{ width: 6, height: 6 }} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  todayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    flex: 1,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1.5,
    paddingVertical: 2,
  },
  tokenSlot: {
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  missedDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    opacity: 0.5,
  },
});
