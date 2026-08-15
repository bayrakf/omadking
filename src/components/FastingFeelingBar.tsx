import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Space, Radius } from '@/constants/theme';
import { Txt, useTheme, Eyebrow } from './ui';
import { Icon, type IconName } from './icons';
import { useT } from './lang';
import { todayISO } from '@/lib/dates';

export type FastingMood = 'energy' | 'fatburn' | 'calm' | 'thirsty' | 'coffee' | 'tired';

const MOODS: {
  id: FastingMood;
  label: string;
  sub: string;
  icon: IconName;
  color: string;
  bg: string;
  advice: string;
}[] = [
  {
    id: 'energy',
    label: 'Fokus',
    sub: 'Mental scharf',
    icon: 'flame',
    color: '#FBBF24',
    bg: 'rgba(251, 191, 36, 0.18)',
    advice: 'Perfekter Zeitpunkt für anspruchsvolle Aufgaben oder ein Workout.',
  },
  {
    id: 'fatburn',
    label: 'Ketose',
    sub: 'Fettverbrennung',
    icon: 'flame',
    color: '#FF6B4A',
    bg: 'rgba(255, 107, 74, 0.18)',
    advice: 'Dein Körper verbrennt aktiv Fettreserven. Halte den Rhythmus.',
  },
  {
    id: 'calm',
    label: 'Ruhig',
    sub: 'Ausgeglichen',
    icon: 'check',
    color: '#34D399',
    bg: 'rgba(52, 211, 153, 0.18)',
    advice: 'Gleichmäßiger Blutzuckerspiegel ohne Heißhunger-Spitzen.',
  },
  {
    id: 'thirsty',
    label: 'Durst',
    sub: 'Elektrolyte',
    icon: 'drop',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.18)',
    advice: 'Trinke jetzt 500ml Wasser mit einer Prise Natrium/Salz.',
  },
  {
    id: 'coffee',
    label: 'Kaffee',
    sub: 'Koffein-Push',
    icon: 'coach',
    color: '#A855F7',
    bg: 'rgba(168, 85, 247, 0.18)',
    advice: 'Schwarzer Kaffee oder Grüntee unterstützt die Autophagie.',
  },
  {
    id: 'tired',
    label: 'Müde',
    sub: 'Energietief',
    icon: 'moon',
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.18)',
    advice: 'Ein kurzes Glas kaltes Wasser mit Salz hilft gegen das Tief.',
  },
];

const STORAGE_KEY = 'fasting_feeling_log';

export function FastingFeelingBar() {
  const c = useTheme();
  const t = useT();
  const today = todayISO();
  const [selected, setSelected] = useState<FastingMood | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const map = JSON.parse(raw);
          if (map && map[today]) setSelected(map[today]);
        }
      } catch {}
    })();
  }, [today]);

  const selectMood = async (id: FastingMood) => {
    const next = selected === id ? null : id;
    setSelected(next);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (next) map[today] = next;
      else delete map[today];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
  };

  const activeMoodObj = MOODS.find((m) => m.id === selected);

  return (
    <View style={[s.container, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={s.headRow}>
        <Eyebrow color={c.accent}>{t('today.feelingTitle')}</Eyebrow>
        {activeMoodObj && (
          <View style={[s.activePill, { backgroundColor: activeMoodObj.bg, borderColor: activeMoodObj.color }]}>
            <Txt variant="data" color={activeMoodObj.color} style={{ fontSize: 11, fontWeight: '700' }}>
              {activeMoodObj.label}
            </Txt>
          </View>
        )}
      </View>

      <View style={s.moodsRow}>
        {MOODS.map((m) => {
          const isCurrent = selected === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              activeOpacity={0.7}
              onPress={() => selectMood(m.id)}
              style={s.moodCell}
              accessibilityLabel={`${m.label} - ${m.sub}`}
              accessibilityState={{ selected: isCurrent }}
            >
              <View
                style={[
                  s.moodCircle,
                  {
                    backgroundColor: isCurrent ? m.bg : c.well,
                    borderColor: isCurrent ? m.color : c.line,
                    transform: [{ scale: isCurrent ? 1.08 : 1 }],
                  },
                ]}
              >
                <Icon
                  name={m.icon}
                  size={18}
                  color={isCurrent ? m.color : c.textDim}
                />
              </View>
              <Txt
                variant="small"
                color={isCurrent ? m.color : c.textDim}
                style={{ fontSize: 11, fontWeight: isCurrent ? '700' : '500', marginTop: 4 }}
              >
                {m.label}
              </Txt>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeMoodObj && (
        <View style={[s.adviceBox, { backgroundColor: c.well, borderColor: c.line }]}>
          <Txt variant="small" color={c.textDim} style={{ lineHeight: 18 }}>
            💡 <Txt variant="small" color={c.text} style={{ fontWeight: '600' }}>{activeMoodObj.sub}: </Txt>
            {activeMoodObj.advice}
          </Txt>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
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
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  moodsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moodCell: {
    alignItems: 'center',
    flex: 1,
  },
  moodCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adviceBox: {
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Space.md,
  },
});
