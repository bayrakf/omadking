import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import { Screen, Card, Txt, Eyebrow, Enter, Button, useTheme, PageHeader, SegmentedControl } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { useLang } from '@/components/lang';
import { saveLastSession } from '@/lib/store';
import type { SessionDraft } from '@/lib/nutrition';

export type WorkoutCategory = 'all' | 'strength' | 'cardio' | 'hiit' | 'mobility';

interface Exercise {
  name: string;
  sets: string;
  notes?: string;
}

interface WorkoutPlan {
  id: string;
  title: string;
  category: 'strength' | 'cardio' | 'hiit' | 'mobility';
  durationMin: number;
  intensity: 'low' | 'medium' | 'high' | 'max';
  estBurnKcal: number;
  icon: IconName;
  color: string;
  wash: string;
  fastingNote: string;
  exercises: Exercise[];
}

const WORKOUTS: WorkoutPlan[] = [
  {
    id: 'push-fasted',
    title: 'Gefastetes Push-Hypertrophie',
    category: 'strength',
    durationMin: 50,
    intensity: 'high',
    estBurnKcal: 380,
    icon: 'flame',
    color: '#FF6B4A',
    wash: 'rgba(255, 107, 74, 0.18)',
    fastingNote: '500ml Wasser + 500mg Natrium 30 Minuten vor dem Training trinken. Maximale Insulinsensitivität für das anschließende Essensfenster.',
    exercises: [
      { name: 'Schrägbankdrücken (Kurzhantel)', sets: '4 Sätze × 8–10 Wiederholungen', notes: '2 Minuten Satzpause' },
      { name: 'Dips / Barrenstütz', sets: '3 Sätze × 10–12 Wiederholungen', notes: 'Körpergewicht oder Zusatzlast' },
      { name: 'Überkopfdrücken (Military Press)', sets: '3 Sätze × 8–10 Wiederholungen', notes: 'Fokus auf Rumpfspannung' },
      { name: 'Seitheben am Kabel / Kurzhantel', sets: '4 Sätze × 12–15 Wiederholungen', notes: 'Kurze Pausen 60 Sekunden' },
      { name: 'Trizepsdrücken am Seil', sets: '3 Sätze × 12–15 Wiederholungen', notes: 'Spitzenkontraktion halten' },
    ],
  },
  {
    id: 'pull-fasted',
    title: 'Gefastetes Pull & Rücken-Power',
    category: 'strength',
    durationMin: 50,
    intensity: 'high',
    estBurnKcal: 390,
    icon: 'flame',
    color: '#8B5CF6',
    wash: 'rgba(139, 92, 246, 0.18)',
    fastingNote: 'Ausreichend Salz vorab schützt vor Kraftverlust bei schweren Grundübungen.',
    exercises: [
      { name: 'Klimmzüge (breiter Griff)', sets: '4 Sätze × 6–8 Wiederholungen', notes: 'Saubere Dehnung im Lat' },
      { name: 'Langhantel-Rudern vorgebeugt', sets: '4 Sätze × 8–10 Wiederholungen', notes: 'Stabiler unterer Rücken' },
      { name: 'Latzug zur Brust (enger Griff)', sets: '3 Sätze × 10–12 Wiederholungen', notes: 'Kontrollierte Exzentrik' },
      { name: 'Face Pulls für hintere Schulter', sets: '4 Sätze × 15 Wiederholungen', notes: 'Schultergesundheit' },
      { name: 'Schrägbank-Bizepscurls', sets: '3 Sätze × 10–12 Wiederholungen', notes: 'Voller Bewegungsumfang' },
    ],
  },
  {
    id: 'legs-fasted',
    title: 'Gefastetes Unterkörper & Beine',
    category: 'strength',
    durationMin: 55,
    intensity: 'high',
    estBurnKcal: 460,
    icon: 'flame',
    color: '#F59E0B',
    wash: 'rgba(245, 158, 11, 0.18)',
    fastingNote: 'Größter Glykogen-Verbrauch. Plane das Fastenbrechen innerhalb von 45–60 Minuten nach Trainingsende.',
    exercises: [
      { name: 'Kniebeugen (Barbell Squat)', sets: '4 Sätze × 6–8 Wiederholungen', notes: '3 Minuten Satzpause' },
      { name: 'Rumänisches Kreuzheben (RDL)', sets: '3 Sätze × 8–10 Wiederholungen', notes: 'Fokus auf Beinbeuger & Gluteus' },
      { name: 'Beinpresse 45°', sets: '3 Sätze × 10–12 Wiederholungen', notes: 'Tiefe Ausführung' },
      { name: 'Beinstrecker & Beinbeuger Supersatz', sets: '3 Sätze × 12–15 Wiederholungen', notes: 'Maximaler Pump' },
      { name: 'Wadenheben stehend', sets: '4 Sätze × 15 Wiederholungen', notes: '2 Sekunden Halt am obersten Punkt' },
    ],
  },
  {
    id: 'zone2-cardio',
    title: 'Zone-2 Fettverbrennung & Ketose',
    category: 'cardio',
    durationMin: 45,
    intensity: 'medium',
    estBurnKcal: 340,
    icon: 'drop',
    color: '#38BDF8',
    wash: 'rgba(56, 189, 248, 0.18)',
    fastingNote: 'Herzfrequenz bei 60–70% HFmax halten (Nasenatmung möglich). Maximiert Fettfluss und schont Muskelmasse.',
    exercises: [
      { name: 'Lockerer Dauerlauf / Joggen', sets: '45 Minuten kontinuierlich', notes: 'Gleichmäßiges Tempo' },
      { name: 'Alternativ: Radergometer / Stairmaster', sets: '45 Minuten gleichmäßig', notes: 'Trittfrequenz ~85 RPM' },
      { name: 'Alternativ: Rucking (Rucksack 10-15kg)', sets: '45 Minuten zügiges Gehen', notes: 'Hervorragende Gelenkschonung' },
    ],
  },
  {
    id: 'hiit-fasted',
    title: 'Fasten-Booster HIIT Zirkel',
    category: 'hiit',
    durationMin: 25,
    intensity: 'max',
    estBurnKcal: 290,
    icon: 'flame',
    color: '#EC4899',
    wash: 'rgba(236, 72, 153, 0.18)',
    fastingNote: 'Extrem intensiver Stoffwechsel-Reiz. 20g schnelle Kohlenhydrate vorab empfohlen, falls 18h+ gefastet.',
    exercises: [
      { name: 'Kettlebell Swings', sets: '5 Runden: 40 Sekunden Belastung / 20 Sekunden Pause', notes: 'Explosive Hüftstreckung' },
      { name: 'Burpees ohne Liegestütz', sets: '5 Runden: 40 Sekunden Belastung / 20 Sekunden Pause', notes: 'Rhythmus halten' },
      { name: 'Assault Bike / Rower Sprints', sets: '5 Runden: 30 Sekunden All-Out / 30 Sekunden Pause', notes: 'Maximaler Laktatausstoß' },
      { name: 'Plank to Push-up', sets: '5 Runden: 40 Sekunden Belastung / 20 Sekunden Pause', notes: 'Rumpfstabilität' },
    ],
  },
  {
    id: 'mobility-fasted',
    title: 'Autophagie & Mobilitäts-Flow',
    category: 'mobility',
    durationMin: 30,
    intensity: 'low',
    estBurnKcal: 110,
    icon: 'check',
    color: '#10B981',
    wash: 'rgba(16, 185, 129, 0.18)',
    fastingNote: 'Perfekt für Fasten-Ruhetage. Fördert Lymphfluss, Durchblutung und zelluläre Regeneration ohne Cortisol-Anstieg.',
    exercises: [
      { name: 'World’s Greatest Stretch', sets: '3 Durchgänge pro Seite', notes: 'Tiefe Atmung' },
      { name: '90/90 Hüftrotationen', sets: '2 Minuten dynamischer Wechsel', notes: 'Hüftöffner' },
      { name: 'Katze-Kuh & Thorakale Rotation', sets: '10 kontrollierte Wiederholungen', notes: 'Wirbelsäulen-Mobilisation' },
      { name: 'Couch Stretch (Hüftbeuger)', sets: '2 Minuten Halten pro Seite', notes: 'Gegen sitzende Haltung' },
      { name: 'Tiefe Kniebeuge im Sitzen (Deep Squat Hold)', sets: '2 Minuten Halten', notes: 'Knöchel- & Hüftbeweglichkeit' },
    ],
  },
];

export default function WorkoutScreen() {
  const c = useTheme();
  const { t } = useLang();
  const router = useRouter();

  const [category, setCategory] = useState<WorkoutCategory>('all');
  const [expandedId, setExpandedId] = useState<string | null>('push-fasted');
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [checkedExercises, setCheckedExercises] = useState<Record<string, boolean>>({});

  const toggleCheck = (key: string) => {
    setCheckedExercises((p) => ({ ...p, [key]: !p[key] }));
  };

  const applyWorkout = async (w: WorkoutPlan) => {
    const session: SessionDraft = {
      sport: w.title,
      duration_min: w.durationMin,
      intensity: w.intensity,
      start_time: '17:00', // standard timing
      restDay: false,
    };
    await saveLastSession(session);
    setAppliedId(w.id);
    setTimeout(() => {
      router.push('/planner');
    }, 400);
  };

  const filtered = category === 'all' ? WORKOUTS : WORKOUTS.filter((w) => w.category === category);

  return (
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          back
          eyebrow="OMAD Training"
          title={t('workout.title')}
          sub={t('workout.sub')}
        />
        <Image
          source={require('../../assets/images/fasted_workout_hero.jpg')}
          style={s.heroImage}
          resizeMode="cover"
        />

        {/* Filter Chips */}
        <SegmentedControl
          selected={category}
          onSelect={(id) => setCategory(id as WorkoutCategory)}
          values={[
            { id: 'all', label: t('workout.all') },
            { id: 'strength', label: t('workout.strength') },
            { id: 'cardio', label: t('workout.cardio') },
            { id: 'hiit', label: t('workout.hiit') },
            { id: 'mobility', label: t('workout.mobility') },
          ]}
          style={{ marginBottom: Space.base }}
        />
      </Enter>

      {/* Workout Cards */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {filtered.map((w, index) => {
          const isExpanded = expandedId === w.id;
          const isApplied = appliedId === w.id;

          return (
            <Enter key={w.id} index={index + 1}>
              <Card
                style={[
                  s.card,
                  {
                    borderColor: isExpanded ? w.color : c.line,
                    backgroundColor: c.surfaceElevated ?? c.surface,
                  },
                ]}
              >
                {/* Header */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(isExpanded ? null : w.id)}
                  style={s.cardHead}
                >
                  <View style={[s.iconBox, { backgroundColor: w.wash }]}>
                    <Icon name={w.icon} size={20} color={w.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Space.md }}>
                    <Txt variant="subheading" style={{ fontSize: 17, fontWeight: '800' }}>
                      {w.title}
                    </Txt>
                    <View style={s.metaRow}>
                      <Txt variant="data" color={c.textDim} style={{ fontSize: 12 }}>
                        ⏱️ {w.durationMin} Min · 🔥 ~{w.estBurnKcal} kcal · {w.intensity.toUpperCase()}
                      </Txt>
                    </View>
                  </View>
                  <View style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}>
                    <Icon name="chevronRight" size={18} color={c.textDim} />
                  </View>
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={s.expandedBody}>
                    {/* Fasting Note */}
                    <View style={[s.fastingBox, { backgroundColor: w.wash, borderColor: w.color }]}>
                      <Eyebrow color={w.color}>💡 {t('workout.fastingNote')}</Eyebrow>
                      <Txt variant="small" color={c.text} style={{ marginTop: 4, lineHeight: 18 }}>
                        {w.fastingNote}
                      </Txt>
                    </View>

                    {/* Exercise Breakdown */}
                    <Eyebrow style={{ marginTop: Space.base, marginBottom: Space.sm }}>
                      {t('workout.exercises')} ({w.exercises.length})
                    </Eyebrow>

                    {w.exercises.map((ex, i) => {
                      const exKey = `${w.id}-${i}`;
                      const isDone = checkedExercises[exKey];

                      return (
                        <TouchableOpacity
                          key={i}
                          activeOpacity={0.7}
                          onPress={() => toggleCheck(exKey)}
                          style={[
                            s.exerciseRow,
                            {
                              backgroundColor: isDone ? c.well : 'transparent',
                              borderColor: c.line,
                            },
                          ]}
                        >
                          <View
                            style={[
                              s.checkbox,
                              {
                                backgroundColor: isDone ? w.color : 'transparent',
                                borderColor: isDone ? w.color : c.lineStrong,
                              },
                            ]}
                          >
                            {isDone && <Icon name="check" size={12} color="#080C14" strokeWidth={3} />}
                          </View>
                          <View style={{ flex: 1, marginLeft: Space.sm }}>
                            <Txt
                              variant="bodyMedium"
                              color={isDone ? c.textFaint : c.text}
                              style={isDone ? s.struck : { fontWeight: '600' }}
                            >
                              {ex.name}
                            </Txt>
                            <Txt variant="small" color={c.textDim} style={{ fontSize: 12, marginTop: 1 }}>
                              {ex.sets} {ex.notes ? `· ${ex.notes}` : ''}
                            </Txt>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Apply to Meal Planner Button */}
                    <Button
                      label={isApplied ? t('workout.applied') : t('workout.applyToPlan')}
                      icon="plate"
                      variant={isApplied ? 'ghost' : 'secondary'}
                      onPress={() => applyWorkout(w)}
                      style={{ marginTop: Space.base }}
                    />
                  </View>
                )}
              </Card>
            </Enter>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  heroImage: {
    width: '100%',
    height: 160,
    borderRadius: Radius.lg,
    marginBottom: Space.base,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  expandedBody: {
    marginTop: Space.base,
    paddingTop: Space.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  fastingBox: {
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Space.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginBottom: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
