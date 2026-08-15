import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, useTheme } from './ui';
import { Icon } from './icons';
import { todayISO } from '@/lib/dates';

interface WeekdayPillStripProps {
  fastLog?: string[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

export function WeekdayPillStrip({
  fastLog = [],
  selectedDate,
  onSelectDate,
}: WeekdayPillStripProps) {
  const c = useTheme();
  const today = todayISO();
  const currentSelected = selectedDate ?? today;

  // Generate the 7 days of the current week (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
  const mondayOffset = (dayOfWeek + 6) % 7; // Monday = 0

  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayLabels = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
    const isToday = iso === today;
    const isPast = iso < today;
    const isSelected = iso === currentSelected;
    const isFastCompleted = fastLog.includes(iso);

    return {
      date: iso,
      dayNum: d.getDate(),
      label: dayLabels[i],
      isToday,
      isPast,
      isSelected,
      isFastCompleted,
    };
  });

  return (
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
            style={{ fontSize: 9, fontWeight: '700' }}
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
            style={{ fontSize: 14, fontWeight: item.isSelected || item.isToday ? '800' : '600', marginTop: 2 }}
          >
            {item.dayNum}
          </Txt>
          <View style={s.dotSlot}>
            {item.isFastCompleted ? (
              <Icon name="flame" size={10} color={item.isSelected ? c.ember : c.ember} />
            ) : item.isToday ? (
              <View style={[s.todayDot, { backgroundColor: item.isSelected ? c.bg : c.accent }]} />
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.sm,
    marginBottom: Space.md,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginHorizontal: 3,
    minHeight: 56,
  },
  dotSlot: {
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
