import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, Eyebrow, Button, useTheme, washOf, type PaletteHue } from './ui';
import { Icon, type IconName } from './icons';
import { useLang } from './lang';

export interface MetabolicTimelineModalProps {
  visible: boolean;
  onClose: () => void;
  hoursFasted: number;
}

interface StageDetail {
  hoursRange: string;
  minHours: number;
  maxHours: number;
  title: string;
  subtitle: string;
  icon: IconName;
  /** Palette slot; module scope has no theme to resolve a literal against. */
  hue: PaletteHue;
  badge: string;
  points: string[];
  biochemistry: string;
}

const STAGES: StageDetail[] = [
  {
    hoursRange: '0 – 4 Stunden',
    minHours: 0,
    maxHours: 4,
    title: 'Anabole Verdauung & Nährstoffaufnahme',
    subtitle: 'Blutzucker & Insulin sinken langsam ab',
    icon: 'plate',
    hue: 'gold' as PaletteHue,
    badge: 'Verdauung',
    points: [
      'Der Körper verdaut die letzte Mahlzeit und füllt Energie- & Glykogenspeicher.',
      'Insulin ist noch aktiv und blockiert die Fettverbrennung.',
      'Gegen Ende der 4. Stunde fällt der Blutzucker auf den Basiswert.',
    ],
    biochemistry: 'Insulin hoch · Lipolyse gehemmt · Glukoseverbrennung',
  },
  {
    hoursRange: '4 – 12 Stunden',
    minHours: 4,
    maxHours: 12,
    title: 'Katabole Umschaltung & Glykogenabbau',
    subtitle: 'Insulin am Tiefpunkt · Fettverbrennung startet',
    icon: 'flame',
    hue: 'ember' as PaletteHue,
    badge: 'Fettstart',
    points: [
      'Insulinspiegel sinkt auf den Minimalwert. Das Enzym HSL (Hormonsensitive Lipase) wird aktiviert.',
      'Die Leber beginnt ihre Glykogenspeicher (ca. 70–100g) zur Energiegewinnung abzubauen.',
      'Ghrelin (Hungerhormon) erzeugt vorübergehende Wellen – eine Prise Salz dämpft sie sofort.',
    ],
    biochemistry: 'Insulin tief · Glukagon steigt · Freie Fettsäuren steigen',
  },
  {
    hoursRange: '12 – 18 Stunden',
    minHours: 12,
    maxHours: 18,
    title: 'Ketose & Maximale Fettoxidation',
    subtitle: 'Die Leber produziert Ketonkörper für Gehirn & Muskeln',
    icon: 'flame',
    hue: 'body' as PaletteHue,
    badge: 'Ketose',
    points: [
      'Leberglykogen ist weitgehend entleert. Fett wird zum primären Treibstoff.',
      'Produktion von Beta-Hydroxybutyrat (BHB): Erhöht mentalen Fokus und Konzentration.',
      'Körper schüttet Noradrenalin aus – Stoffwechselrate bleibt hoch, kein Verhungern.',
    ],
    biochemistry: 'Beta-Hydroxybutyrat (BHB) aktiv · Ghrelin flacht ab · Fettverbrennung Peak',
  },
  {
    hoursRange: '18 – 24+ Stunden',
    minHours: 18,
    maxHours: 99,
    title: 'Tiefe Autophagie & Zellerneuerung',
    subtitle: 'Zelluläres Recycling & mTOR-Hemmung',
    icon: 'crown',
    hue: 'plan' as PaletteHue,
    badge: 'Autophagie',
    points: [
      'Makroautophagie: Lysosomen zerlegen beschädigte Proteine, defekte Mitochondrien und Zellmüll.',
      'Wachstumshormon (HGH) steigt drastisch an, um Muskelgewebe zu schützen.',
      'Entzündungsmarker (CRP, IL-6) sinken, Insulinsensitivität für das Essen wird maximiert.',
    ],
    biochemistry: 'mTOR gehemmt · AMPK maximiert · HGH +300–500% · Zellerneuerung',
  },
];

export function MetabolicTimelineModal({ visible, onClose, hoursFasted }: MetabolicTimelineModalProps) {
  const c = useTheme();
  const { lang } = useLang();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Eyebrow color={c.accent}>{lang === 'de' ? '24-STUNDEN-BIOLOGIE' : '24-HOUR BIOLOGY'}</Eyebrow>
              <Txt variant="heading" style={{ fontSize: 20, fontWeight: '800', marginTop: 2 }}>
                {lang === 'de' ? 'Stoffwechsel-Phasen' : 'Metabolic Stages'}
              </Txt>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={20} color={c.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520, marginTop: Space.base }}>
            <Txt variant="small" color={c.textDim} style={{ marginBottom: Space.base, lineHeight: 18 }}>
              {lang === 'de'
                ? `Aktuell gefastet: ${hoursFasted.toFixed(1)} Stunden. Dein Körper durchläuft diese 4 biochemischen Stufen:`
                : `Currently fasted: ${hoursFasted.toFixed(1)} hours. Your body undergoes these 4 biochemical stages:`}
            </Txt>

            {STAGES.map((st) => {
              const isCurrent = hoursFasted >= st.minHours && hoursFasted < st.maxHours;
              const isPassed = hoursFasted >= st.maxHours;

              return (
                <View
                  key={st.title}
                  style={[
                    s.stageCard,
                    {
                      backgroundColor: isCurrent ? washOf(c[st.hue]) : c.well,
                      borderColor: isCurrent ? c[st.hue] : isPassed ? 'rgba(255,255,255,0.15)' : c.line,
                      borderWidth: isCurrent ? 1.5 : 1,
                    },
                  ]}
                >
                  <View style={s.stageHeaderRow}>
                    <View style={[s.stageIcon, { backgroundColor: washOf(c[st.hue]) }]}>
                      <Icon name={st.icon} size={18} color={c[st.hue]} />
                    </View>
                    <View style={{ flex: 1, marginLeft: Space.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Txt variant="eyebrow" color={c[st.hue]} style={{ fontSize: 11, fontWeight: '800' }}>
                          {st.hoursRange.toUpperCase()}
                        </Txt>
                        {isCurrent && (
                          <View style={[s.currentPill, { backgroundColor: c[st.hue] }]}>
                            <Txt variant="eyebrow" color="#FFFFFF" style={{ fontSize: 9, fontWeight: '900' }}>
                              {lang === 'de' ? 'JETZT AKTIV' : 'ACTIVE NOW'}
                            </Txt>
                          </View>
                        )}
                      </View>
                      <Txt variant="subheading" style={{ fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                        {st.title}
                      </Txt>
                    </View>
                  </View>

                  <Txt variant="small" color={c.textDim} style={{ marginTop: Space.xs, fontWeight: '600' }}>
                    {st.subtitle}
                  </Txt>

                  <View style={{ marginTop: Space.sm }}>
                    {st.points.map((p, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
                        <Txt variant="small" color={c[st.hue]} style={{ marginRight: 6, fontWeight: '700' }}>•</Txt>
                        <Txt variant="small" color={c.text} style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
                          {p}
                        </Txt>
                      </View>
                    ))}
                  </View>

                  <View style={[s.bioBox, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <Txt variant="data" color={c[st.hue]} style={{ fontSize: 10, fontWeight: '700' }}>
                      🔬 {st.biochemistry}
                    </Txt>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Button
            label={lang === 'de' ? 'Verstanden' : 'Got it'}
            onPress={onClose}
            style={{ marginTop: Space.base }}
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Space.base,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Space.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stageCard: {
    borderRadius: Radius.lg,
    padding: Space.base,
    marginBottom: Space.base,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stageIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  bioBox: {
    marginTop: Space.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
});
