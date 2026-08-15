import { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, Eyebrow, Button, useTheme } from './ui';
import { Icon } from './icons';
import { useLang } from './lang';
import { saveTodayWindowShift, clearTodayWindowShift } from '@/lib/store';
import { toMinutes, fromMinutes } from '@/lib/nutrition';

interface WindowShifterModalProps {
  visible: boolean;
  onClose: () => void;
  baseStart: string;
  baseLengthHours: number;
  onShiftApplied: () => void;
}

export function WindowShifterModal({
  visible,
  onClose,
  baseStart,
  baseLengthHours,
  onShiftApplied,
}: WindowShifterModalProps) {
  const c = useTheme();
  const { lang } = useLang();

  const baseStartMin = toMinutes(baseStart);
  const [selectedStart, setSelectedStart] = useState<string>(baseStart);

  const calculateEnd = (start: string) => {
    const sMin = toMinutes(start);
    const eMin = (sMin + baseLengthHours * 60) % 1440;
    return fromMinutes(eMin);
  };

  const currentEnd = calculateEnd(selectedStart);
  const fastingHours = 24 - baseLengthHours;

  const presets = [-120, -60, 0, 60, 120, 180].map((offset) => {
    const shiftedMin = (baseStartMin + offset + 1440) % 1440;
    const timeStr = fromMinutes(shiftedMin);
    const label =
      offset === 0
        ? lang === 'de'
          ? 'Standard'
          : 'Default'
        : `${offset > 0 ? '+' : ''}${offset / 60}h`;
    return {
      offset,
      timeStr,
      label,
    };
  });

  const applyShift = async (time: string) => {
    if (time === baseStart) {
      await clearTodayWindowShift();
    } else {
      await saveTodayWindowShift(time, calculateEnd(time));
    }
    onShiftApplied();
    onClose();
  };

  const resetDefault = async () => {
    await clearTodayWindowShift();
    onShiftApplied();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.modalCard, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
          <View style={s.topRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="clock" size={20} color={c.accent} />
              <Txt variant="subheading" style={{ fontSize: 17, fontWeight: '800', marginLeft: 8 }}>
                {lang === 'de' ? 'Fastenfenster heute anpassen' : 'Adjust Today’s Window'}
              </Txt>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={18} color={c.textDim} />
            </TouchableOpacity>
          </View>

          <Txt variant="small" color={c.textDim} style={{ marginTop: 6, lineHeight: 18 }}>
            {lang === 'de'
              ? 'Hast du heute einen Restaurantbesuch oder ein Event? Verschiebe dein Essensfenster flexibel nur für heute.'
              : 'Dining out or attending an event today? Flexibly shift your eating window for today only.'}
          </Txt>

          {/* Current Selection Preview */}
          <View style={[s.previewBox, { backgroundColor: c.well, borderColor: c.line }]}>
            <Eyebrow color={c.accent}>{lang === 'de' ? 'HEUTIGES ESSENSFENSTER' : 'TODAY’S EATING WINDOW'}</Eyebrow>
            <Txt variant="heading" style={{ fontSize: 24, fontWeight: '800', marginTop: 4 }}>
              {selectedStart} – {currentEnd}
            </Txt>
            <Txt variant="data" color={c.textDim} style={{ fontSize: 12, marginTop: 2 }}>
              {fastingHours}h {lang === 'de' ? 'Fastenphase' : 'Fast'} · {baseLengthHours}h {lang === 'de' ? 'Essensfenster' : 'Window'}
            </Txt>
          </View>

          {/* Quick Presets Grid */}
          <Eyebrow style={{ marginTop: Space.base, marginBottom: Space.xs }}>
            {lang === 'de' ? 'SCHNELL-AUSWAHL' : 'QUICK PRESETS'}
          </Eyebrow>
          <View style={s.presetGrid}>
            {presets.map((p) => {
              const isSelected = selectedStart === p.timeStr;
              return (
                <TouchableOpacity
                  key={p.offset}
                  onPress={() => setSelectedStart(p.timeStr)}
                  activeOpacity={0.7}
                  style={[
                    s.presetBtn,
                    {
                      backgroundColor: isSelected ? c.accent : c.well,
                      borderColor: isSelected ? c.accent : c.line,
                    },
                  ]}
                >
                  <Txt
                    variant="data"
                    color={isSelected ? c.onAccent : c.text}
                    style={{ fontSize: 13, fontWeight: '700' }}
                  >
                    {p.timeStr}
                  </Txt>
                  <Txt
                    variant="eyebrow"
                    color={isSelected ? c.onAccent : c.textDim}
                    style={{ fontSize: 9, marginTop: 1 }}
                  >
                    {p.label}
                  </Txt>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Buttons */}
          <View style={{ marginTop: Space.lg }}>
            <Button
              label={lang === 'de' ? 'Für heute übernehmen' : 'Apply for Today'}
              onPress={() => applyShift(selectedStart)}
            />
            {selectedStart !== baseStart && (
              <Button
                label={lang === 'de' ? 'Auf Standard zurücksetzen' : 'Reset to Default'}
                variant="ghost"
                onPress={resetDefault}
                style={{ marginTop: Space.xs }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Space.base,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Space.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewBox: {
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Space.md,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -3,
    marginTop: 4,
  },
  presetBtn: {
    width: '31%',
    marginHorizontal: '1.16%',
    marginVertical: 4,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
