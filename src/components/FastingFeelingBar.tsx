import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Space, Radius } from '@/constants/theme';
import { Txt, useTheme, Eyebrow, Button, washOf } from './ui';
import { Icon, type IconName } from './icons';
import { useLang } from './lang';
import { todayISO } from '@/lib/dates';

export type FastingMood = 'energy' | 'fatburn' | 'calm' | 'thirsty' | 'hunger' | 'tired';

/**
 * A palette key, not a colour.
 *
 * These sat on module scope as raw Tailwind hexes, which is one tick before
 * any theme exists — so six full-chroma swatches were painted onto a screen
 * whose palette had already been chosen, and nothing could bring them into
 * line. Naming the slot instead lets the scheme resolve it, so a mood is warm
 * in the warm scheme and legible in the dark one without a second list.
 */
type PaletteKey = 'gold' | 'ember' | 'plan' | 'hydro' | 'body' | 'textDim';

const MOODS: {
  id: FastingMood;
  label: string;
  sub: string;
  icon: IconName;
  hue: PaletteKey;
  advice: string;
}[] = [
  {
    id: 'energy',
    label: 'Fokus',
    sub: 'Mental scharf',
    icon: 'flame',
    hue: 'gold',
    advice: 'Perfekter Zeitpunkt für anspruchsvolle Aufgaben oder ein fokussiertes Workout.',
  },
  {
    id: 'fatburn',
    label: 'Ketose',
    sub: 'Fettverbrennung',
    icon: 'flame',
    hue: 'ember',
    advice: 'Dein Körper verbrennt aktiv Fettreserven. Das Insulin ist am Tiefpunkt.',
  },
  {
    id: 'calm',
    label: 'Ruhig',
    sub: 'Ausgeglichen',
    icon: 'check',
    hue: 'plan',
    advice: 'Stabiler Blutzuckerspiegel ohne Heißhunger-Spitzen.',
  },
  {
    id: 'thirsty',
    label: 'Durst',
    sub: 'Elektrolyte',
    icon: 'drop',
    hue: 'hydro',
    advice: 'Trinke jetzt 500ml Wasser mit einer Prise Natrium/Salz.',
  },
  {
    id: 'hunger',
    label: 'Hunger',
    sub: 'Ghrelin-Welle',
    icon: 'alert',
    hue: 'body',
    advice: 'Hunger kommt in 15-Minuten-Wellen. Eine Prise Salz und ein Schluck Wasser stoppen es.',
  },
  {
    id: 'tired',
    label: 'Müde',
    sub: 'Energietief',
    icon: 'moon',
    hue: 'textDim',
    advice: 'Ein kurzes Glas kaltes Wasser mit Salz oder 5 Min. Bewegung weckt die Mitochondrien.',
  },
];

const SOS_TIPS = [
  {
    icon: 'drop' as IconName,
    title: 'Prise Meersalz auf die Zunge',
    desc: 'Elektrolytmangel täuscht oft Hunger vor. Natrium dämpft Ghrelin innerhalb von 2 Minuten.',
    hue: 'hydro' as PaletteKey,
  },
  {
    icon: 'coach' as IconName,
    title: 'Schwarzer Kaffee oder Grüntee',
    desc: 'Koffein und EGCG stimulieren die Fettoxidation und unterdrücken Magenkontraktionen ohne das Fasten zu brechen.',
    hue: 'body' as PaletteKey,
  },
  {
    icon: 'flame' as IconName,
    title: '5-Minuten Spaziergang',
    desc: 'Muskelkontraktion schüttet Ketone aus und signalisiert dem Gehirn Sättigung durch gespeicherte Energie.',
    hue: 'ember' as PaletteKey,
  },
  {
    icon: 'check' as IconName,
    title: 'Die 15-Minuten-Regel',
    desc: 'Das Hungerhormon Ghrelin flacht nach 15–20 Minuten von selbst wieder vollständig ab.',
    hue: 'plan' as PaletteKey,
  },
];

const STORAGE_KEY = 'fasting_feeling_log';

export function FastingFeelingBar({ embedded = false }: { embedded?: boolean }) {
  const c = useTheme();
  const { lang, t } = useLang();
  const today = todayISO();
  const [selected, setSelected] = useState<FastingMood | null>(null);
  const [showSOS, setShowSOS] = useState(false);

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
    if (id === 'hunger') {
      setShowSOS(true);
    }
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
    <View style={embedded ? s.embeddedContainer : [s.container, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={s.headRow}>
        <Eyebrow color={c.accent}>{t('today.feelingTitle')}</Eyebrow>
        <TouchableOpacity
          onPress={() => setShowSOS(true)}
          activeOpacity={0.7}
          style={[s.sosBtn, { backgroundColor: washOf(c.negative), borderColor: c.negative }]}
          accessibilityLabel="Fasten Notfallhilfe"
        >
          <Icon name="alert" size={11} color={c.negative} />
          <Txt variant="eyebrow" color={c.negative} style={{ fontSize: 9, fontWeight: '800', marginLeft: 3 }}>
            FASTEN-SOS
          </Txt>
        </TouchableOpacity>
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
                    backgroundColor: isCurrent ? washOf(c[m.hue]) : c.well,
                    borderColor: isCurrent ? c[m.hue] : c.line,
                    transform: [{ scale: isCurrent ? 1.08 : 1 }],
                  },
                ]}
              >
                <Icon
                  name={m.icon}
                  size={17}
                  color={isCurrent ? c[m.hue] : c.textDim}
                />
              </View>
              <Txt
                variant="small"
                color={isCurrent ? c[m.hue] : c.textDim}
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

      {/* Fasten SOS Modal */}
      <Modal visible={showSOS} transparent animationType="fade" onRequestClose={() => setShowSOS(false)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
            <View style={s.modalHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="flame" size={20} color={c.negative} />
                <Txt variant="subheading" style={{ fontSize: 17, fontWeight: '800', marginLeft: 8 }}>
                  {lang === 'de' ? 'Fasten-SOS: Hunger-Crusher' : 'Fasting SOS: Hunger Crusher'}
                </Txt>
              </View>
              <TouchableOpacity onPress={() => setShowSOS(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={18} color={c.textDim} />
              </TouchableOpacity>
            </View>

            <Txt variant="small" color={c.textDim} style={{ marginTop: 6, lineHeight: 18 }}>
              {lang === 'de'
                ? 'Du bist stärker als die Ghrelin-Welle! Nutze diese 4 wissenschaftlich bewährten Taktiken:'
                : 'You are stronger than the hunger wave! Use these 4 science-backed tactics:'}
            </Txt>

            <View style={{ marginTop: Space.base }}>
              {SOS_TIPS.map((tip) => (
                <View key={tip.title} style={[s.sosRow, { backgroundColor: c.well, borderColor: c.line }]}>
                  <View style={[s.sosIconBadge, { backgroundColor: washOf(c[tip.hue]), borderColor: c[tip.hue] }]}>
                    <Icon name={tip.icon} size={15} color={c[tip.hue]} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Space.sm }}>
                    <Txt variant="subheading" style={{ fontSize: 13, fontWeight: '700' }}>
                      {tip.title}
                    </Txt>
                    <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 2, lineHeight: 16 }}>
                      {tip.desc}
                    </Txt>
                  </View>
                </View>
              ))}
            </View>

            <Button
              label={lang === 'de' ? 'Verstanden, Fasten durchhalten' : 'Got it, keep fasting'}
              onPress={() => setShowSOS(false)}
              style={{ marginTop: Space.base }}
            />
          </View>
        </View>
      </Modal>
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
  embeddedContainer: {
    padding: 0,
    marginBottom: 0,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
  },
  sosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  modalBackdrop: {
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
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sosRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  sosIconBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
