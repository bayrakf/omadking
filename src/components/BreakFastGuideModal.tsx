import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, Eyebrow, Button, useTheme, washOf, type PaletteHue } from './ui';
import { Icon, type IconName } from './icons';
import { useLang } from './lang';

export interface BreakFastGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

interface StepInfo {
  stepNum: string;
  title: string;
  subtitle: string;
  timing: string;
  icon: IconName;
  /** Palette slot; module scope has no theme to resolve a literal against. */
  hue: PaletteHue;
  points: string[];
  scientificEffect: string;
}

const STEPS: StepInfo[] = [
  {
    stepNum: 'SCHRITT 1',
    title: 'Magensäure & Verdauung aufwecken',
    subtitle: 'Verdauungsenzyme und Magen-pH vorbereiten',
    timing: '15–20 Minuten vor dem ersten Bissen',
    icon: 'drop',
    hue: 'hydro' as PaletteHue,
    points: [
      '250ml lauwarmes Wasser mit 1 EL naturtrübem Bio-Apfelessig ODER 200ml warme Knochenbrühe mit einer Prise Meersalz.',
      'Aktiviert die Produktion von Magensäure (HCl) und bereitet die Bauchspeicheldrüse auf die Nährstoffaufnahme vor.',
    ],
    scientificEffect: 'Magen-pH sinkt · Pepsinogen wird zu Pepsin aktiviert · Verhindert Völlegefühl',
  },
  {
    stepNum: 'SCHRITT 2',
    title: 'Protein & gesunde Fette zuerst',
    subtitle: 'Sättigungshormone stimulieren ohne Insulinexplosion',
    timing: 'Die ersten 15–20 Minuten der Mahlzeit',
    icon: 'plate',
    hue: 'plan' as PaletteHue,
    points: [
      'Beginne immer mit der Proteinquelle (Wildlachs, Rindersteak, Eier, Hähnchen, Tofu) und gesunden Fetten (Avocado, Olivenöl, Nüsse).',
      'Eiweiß und Fette stimulieren die Freisetzung der Sättigungshormone GLP-1, PYY und Cholecystokinin (CCK).',
    ],
    scientificEffect: 'GLP-1 & PYY Ausschüttung · Verlangsamte Magenentleerung · Kein Heißhunger',
  },
  {
    stepNum: 'SCHRITT 3',
    title: 'Komplexe Kohlenhydrate zum Schluss',
    subtitle: 'Food-Coma & Blutzuckerspitzen um 40% reduzieren',
    timing: 'Nach dem Protein & Gemüse verzehren',
    icon: 'flame',
    hue: 'gold' as PaletteHue,
    points: [
      'Süßkartoffeln, Reis, Quinoa, Haferflocken oder Früchte erst am Ende der Mahlzeit essen.',
      'Weil der Magen bereits mit Protein und Ballaststoffen gefüllt ist, wird die Glukose stark verlangsamt ins Blut abgegeben.',
    ],
    scientificEffect: 'Glukosespitzen um bis zu 40% gedämpft · Keine Müdigkeit nach dem Essen',
  },
];

export function BreakFastGuideModal({ visible, onClose }: BreakFastGuideModalProps) {
  const c = useTheme();
  const { lang } = useLang();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Eyebrow color="#10B981">{lang === 'de' ? 'FOOD-COMA PRÄVENTION' : 'FOOD-COMA PREVENTION'}</Eyebrow>
              <Txt variant="heading" style={{ fontSize: 20, fontWeight: '800', marginTop: 2 }}>
                {lang === 'de' ? 'Fastenbrechen-Protokoll' : 'Break-Fast Protocol'}
              </Txt>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={20} color={c.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520, marginTop: Space.base }}>
            <Txt variant="small" color={c.textDim} style={{ marginBottom: Space.base, lineHeight: 18 }}>
              {lang === 'de'
                ? 'Bei einer großen OMAD-Mahlzeit (1.500+ kcal) entscheidet die Reihenfolge über Energie vs. Müdigkeit. Befolge diese 3 Stufen:'
                : 'With large OMAD meals (1,500+ kcal), nutrient sequence determines energy vs fatigue. Follow these 3 steps:'}
            </Txt>

            {STEPS.map((step) => (
              <View
                key={step.title}
                style={[s.stepCard, { backgroundColor: c.well, borderColor: c.line }]}
              >
                <View style={s.stepHeader}>
                  <View style={[s.stepIconBox, { backgroundColor: washOf(c[step.hue]) }]}>
                    <Icon name={step.icon} size={18} color={c[step.hue]} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Space.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Txt variant="eyebrow" color={c[step.hue]} style={{ fontSize: 10, fontWeight: '800' }}>
                        {step.stepNum} · {step.timing.toUpperCase()}
                      </Txt>
                    </View>
                    <Txt variant="subheading" style={{ fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                      {step.title}
                    </Txt>
                  </View>
                </View>

                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.xs, fontWeight: '600' }}>
                  {step.subtitle}
                </Txt>

                <View style={{ marginTop: Space.sm }}>
                  {step.points.map((p, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
                      <Txt variant="small" color={c[step.hue]} style={{ marginRight: 6, fontWeight: '700' }}>✓</Txt>
                      <Txt variant="small" color={c.text} style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
                        {p}
                      </Txt>
                    </View>
                  ))}
                </View>

                <View style={[s.bioBox, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Txt variant="data" color={c[step.hue]} style={{ fontSize: 10, fontWeight: '700' }}>
                    💡 {step.scientificEffect}
                  </Txt>
                </View>
              </View>
            ))}
          </ScrollView>

          <Button
            label={lang === 'de' ? 'Bereit zum Fastenbrechen' : 'Ready to break fast'}
            tone="accent"
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
  stepCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioBox: {
    marginTop: Space.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
});
