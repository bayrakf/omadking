import { SPORT_IDS, type FitnessLevel, type Intensity, type Training } from './nutrition';
import type { Lang } from './i18n';

export type WorkoutCategory = 'calisthenics' | 'strength' | 'hiit' | 'cardio' | 'mobility';
export type RepUnit = 'reps' | 'sec';

export type ExerciseSpec = {
  id: string;
  name: { de: string; en: string };
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  unit?: RepUnit;
  notes: { de: string; en: string };
};

export type WorkoutProgram = {
  id: string;
  title: { de: string; en: string };
  category: WorkoutCategory;
  sport: string;
  durationMin: number;
  intensity: Intensity;
  estBurnKcal: number;
  icon: 'flame' | 'drop' | 'check' | 'bolt' | 'coach';
  hue: 'ember' | 'body' | 'hydro' | 'plan';
  fastingNote: { de: string; en: string };
  exercises?: ExerciseSpec[];
  exercisesByLevel?: Record<FitnessLevel, ExerciseSpec[]>;
};

export type LoggedSet = { reps: number; loadKg?: number };
export type LoggedExercise = { exerciseId: string; name: string; sets: LoggedSet[] };
export type WorkoutLogEntry = {
  id: string;
  date: string;
  workoutId: string;
  sport: string;
  durationMin: number;
  intensity: Intensity;
  startTime?: string;
  exercises: LoggedExercise[];
};

export const WORKOUT_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'calisthenics-push',
    title: { de: 'Calisthenics Push & Core', en: 'Calisthenics Push & Core' },
    category: 'calisthenics',
    sport: 'calisthenics',
    durationMin: 45,
    intensity: 'high',
    estBurnKcal: 360,
    icon: 'bolt',
    hue: 'ember',
    fastingNote: {
      de: '500 ml Wasser + 500 mg Natrium vorab. Hohe neuromuskuläre Kontrolle im gefasteten Zustand.',
      en: '500 ml water + 500 mg sodium pre-session. Crisp fasted neuromuscular tension.',
    },
    exercisesByLevel: {
      beginner: [
        {
          id: 'cali-push-incline',
          name: { de: 'Erhöhte Liegestütze (Incline Push-ups)', en: 'Incline Push-ups' },
          targetSets: 3, targetRepsMin: 10, targetRepsMax: 15,
          notes: { de: 'Ellbogen 45° eng führen', en: 'Keep elbows tucked 45°' },
        },
        {
          id: 'cali-push-scapula',
          name: { de: 'Scapula Liegestütze', en: 'Scapular Push-ups' },
          targetSets: 3, targetRepsMin: 12, targetRepsMax: 15,
          notes: { de: 'Schulterblatt-Kontrolle', en: 'Full protraction at top' },
        },
        {
          id: 'cali-push-pike-knee',
          name: { de: 'Box Pike Push-ups (Knie)', en: 'Knee Pike Push-ups' },
          targetSets: 3, targetRepsMin: 8, targetRepsMax: 12,
          notes: { de: 'Schulter über Hände schieben', en: 'Shift shoulders forward' },
        },
        {
          id: 'cali-push-deadbug',
          name: { de: 'Dead Bug Core Hold', en: 'Slow Dead Bugs' },
          targetSets: 3, targetRepsMin: 10, targetRepsMax: 16,
          notes: { de: 'Unterer Rücken am Boden', en: 'Press lower back flat' },
        },
      ],
      intermediate: [
        {
          id: 'cali-push-dips',
          name: { de: 'Barren-Dips', en: 'Parallel Bar Dips' },
          targetSets: 4, targetRepsMin: 6, targetRepsMax: 10,
          notes: { de: 'Saubere 90°-Tiefe', en: 'Controlled 90° depth' },
        },
        {
          id: 'cali-push-diamond',
          name: { de: 'Diamond Push-ups', en: 'Diamond Push-ups' },
          targetSets: 3, targetRepsMin: 8, targetRepsMax: 12,
          notes: { de: 'Trizeps & innere Brust', en: 'Full lockout every rep' },
        },
        {
          id: 'cali-push-pike',
          name: { de: 'Erhöhte Pike Push-ups', en: 'Elevated Pike Push-ups' },
          targetSets: 3, targetRepsMin: 6, targetRepsMax: 10,
          notes: { de: 'Füße auf Erhöhung', en: 'Feet elevated for shoulder load' },
        },
        {
          id: 'cali-push-hollow',
          name: { de: 'Hollow Body Hold', en: 'Hollow Body Hold' },
          targetSets: 3, targetRepsMin: 30, targetRepsMax: 45, unit: 'sec',
          notes: { de: 'Lendenwirbelsäule fixiert', en: 'Keep ribs knitted down' },
        },
      ],
      advanced: [
        {
          id: 'cali-push-pppu',
          name: { de: 'Pseudo-Planche Push-ups', en: 'Pseudo-Planche Push-ups' },
          targetSets: 4, targetRepsMin: 6, targetRepsMax: 10,
          notes: { de: 'Maximale Schulter-Vorlage', en: 'Lean forward past wrists' },
        },
        {
          id: 'cali-push-ring-dips',
          name: { de: 'Ring-Dips (Turnout)', en: 'Ring Dips (RTO Finish)' },
          targetSets: 4, targetRepsMin: 6, targetRepsMax: 10,
          notes: { de: 'Ringe oben ausdrehen', en: 'Turn rings out at lockout' },
        },
        {
          id: 'cali-push-hspu',
          name: { de: 'Handstand-Liegestütze an der Wand', en: 'Wall Handstand Push-ups' },
          targetSets: 3, targetRepsMin: 5, targetRepsMax: 8,
          notes: { de: '3 Sek. exzentrisch absenken', en: '3-second eccentric lower' },
        },
        {
          id: 'cali-push-lsit',
          name: { de: 'Floor L-Sit Hold', en: 'Floor L-Sit Hold' },
          targetSets: 3, targetRepsMin: 20, targetRepsMax: 35, unit: 'sec',
          notes: { de: 'Schultern aktiv runterdrücken', en: 'Depress shoulders cleanly' },
        },
      ],
    },
  },
  {
    id: 'calisthenics-pull',
    title: { de: 'Calisthenics Pull & Rücken', en: 'Calisthenics Pull & Back' },
    category: 'calisthenics',
    sport: 'calisthenics',
    durationMin: 45,
    intensity: 'high',
    estBurnKcal: 350,
    icon: 'bolt',
    hue: 'body',
    fastingNote: {
      de: 'Fokussierter Zugtag — anschließend glykogen- und proteinreiche OMAD-Mahlzeit.',
      en: 'High-tension pull work — ideal before your high-protein carb-rich OMAD plate.',
    },
    exercisesByLevel: {
      beginner: [
        {
          id: 'cali-pull-rows',
          name: { de: 'Körperrudern (Australian Rows)', en: 'Inverted Australian Rows' },
          targetSets: 4, targetRepsMin: 8, targetRepsMax: 12,
          notes: { de: 'Brust bis zur Stange ziehen', en: 'Pull chest right to bar' },
        },
        {
          id: 'cali-pull-scap',
          name: { de: 'Schulterblatt-Klimmzüge', en: 'Scapular Pull-ups' },
          targetSets: 3, targetRepsMin: 10, targetRepsMax: 15,
          notes: { de: 'Arme gestreckt halten', en: 'Straight arms, pull shoulders down' },
        },
        {
          id: 'cali-pull-hang',
          name: { de: 'Aktives Hängen (Active Hang)', en: 'Active Dead Hang' },
          targetSets: 3, targetRepsMin: 25, targetRepsMax: 45, unit: 'sec',
          notes: { de: 'Griffkraft & Schulter-Deko', en: 'Build grip and shoulder health' },
        },
      ],
      intermediate: [
        {
          id: 'cali-pull-pullups',
          name: { de: 'Saubere Klimmzüge', en: 'Strict Pull-ups' },
          targetSets: 4, targetRepsMin: 6, targetRepsMax: 10,
          notes: { de: 'Kein Schwung aus Hüfte', en: 'Full dead-hang start' },
        },
        {
          id: 'cali-pull-chinups',
          name: { de: 'Enge Chin-ups (Untergriff)', en: 'Close-Grip Chin-ups' },
          targetSets: 3, targetRepsMin: 8, targetRepsMax: 12,
          notes: { de: 'Bizeps & unterer Lat', en: 'Pause 1s at chin over bar' },
        },
        {
          id: 'cali-pull-kneeraise',
          name: { de: 'Knieheben hängend', en: 'Hanging Knee Raises' },
          targetSets: 4, targetRepsMin: 10, targetRepsMax: 15,
          notes: { de: 'Becken einrollen, kein Pendel', en: 'Curl pelvis without swinging' },
        },
      ],
      advanced: [
        {
          id: 'cali-pull-archer',
          name: { de: 'Archer Pull-ups', en: 'Archer Pull-ups' },
          targetSets: 4, targetRepsMin: 5, targetRepsMax: 8,
          notes: { de: 'Ein Arm zieht, ein Arm führt', en: 'Pull toward alternating hands' },
        },
        {
          id: 'cali-pull-ctb',
          name: { de: 'Explosive Chest-to-Bar Pull-ups', en: 'Explosive Chest-to-Bar Pull-ups' },
          targetSets: 4, targetRepsMin: 5, targetRepsMax: 8,
          notes: { de: 'Vorbereitung für Muscle-up', en: 'Power drive for muscle-up' },
        },
        {
          id: 'cali-pull-tuck-fl',
          name: { de: 'Tuck Front Lever Rows', en: 'Tuck Front Lever Rows' },
          targetSets: 3, targetRepsMin: 6, targetRepsMax: 10,
          notes: { de: 'Hüfte auf Stangenhöhe halten', en: 'Keep hips level at height' },
        },
        {
          id: 'cali-pull-toestobar',
          name: { de: 'Strict Toes-to-Bar', en: 'Strict Toes-to-Bar' },
          targetSets: 3, targetRepsMin: 8, targetRepsMax: 12,
          notes: { de: 'Gestreckte Beine bis Stange', en: 'Straight legs, controlled down' },
        },
      ],
    },
  },
  {
    id: 'calisthenics-legs',
    title: { de: 'Calisthenics Beine & Ganzkörper', en: 'Calisthenics Legs & Full Body' },
    category: 'calisthenics',
    sport: 'calisthenics',
    durationMin: 40,
    intensity: 'medium',
    estBurnKcal: 310,
    icon: 'flame',
    hue: 'plan',
    fastingNote: {
      de: 'Perfekt ohne Studio. Erfordert Bein- & Core-Stabilität.',
      en: 'Zero-equipment strength work building unilateral leg power.',
    },
    exercisesByLevel: {
      beginner: [
        {
          id: 'cali-leg-split',
          name: { de: 'Ausfallschritte am Platz (Split Squats)', en: 'Static Split Squats' },
          targetSets: 3, targetRepsMin: 10, targetRepsMax: 15,
          notes: { de: 'Pro Bein kontrolliert absenken', en: 'Per leg, knee tracks toes' },
        },
        {
          id: 'cali-leg-glute',
          name: { de: 'Einbeinige Beckenbrücke', en: 'Single-Leg Glute Bridge' },
          targetSets: 3, targetRepsMin: 10, targetRepsMax: 15,
          notes: { de: '1 Sek. oben anspannen', en: 'Squeeze glute 1s at peak' },
        },
        {
          id: 'cali-leg-calf',
          name: { de: 'Wadenheben auf Kante', en: 'Single-Leg Calf Raise' },
          targetSets: 3, targetRepsMin: 12, targetRepsMax: 20,
          notes: { de: 'Voller Bewegungsumfang', en: 'Full stretch at bottom' },
        },
      ],
      intermediate: [
        {
          id: 'cali-leg-bulgarian',
          name: { de: 'Bulgarische Kniebeugen', en: 'Bulgarian Split Squats' },
          targetSets: 4, targetRepsMin: 8, targetRepsMax: 12,
          notes: { de: 'Hinterer Fuß erhöht', en: 'Deep hip flexion per side' },
        },
        {
          id: 'cali-leg-nordic-ecc',
          name: { de: 'Nordic Hamstring Negatives', en: 'Nordic Hamstring Negatives' },
          targetSets: 3, targetRepsMin: 5, targetRepsMax: 8,
          notes: { de: 'So langsam wie möglich nach vorn', en: 'Slow 4s eccentric descent' },
        },
        {
          id: 'cali-leg-sissy',
          name: { de: 'Sissy / Tempo Kniebeugen', en: 'Tempo Bodyweight Squats' },
          targetSets: 3, targetRepsMin: 12, targetRepsMax: 18,
          notes: { de: '3 Sek. runter, ohne Pause hoch', en: '3s lower, crisp drive up' },
        },
      ],
      advanced: [
        {
          id: 'cali-leg-pistol',
          name: { de: 'Pistol Squats (Einbeinige Kniebeuge)', en: 'Pistol Squats' },
          targetSets: 4, targetRepsMin: 5, targetRepsMax: 10,
          notes: { de: 'Ferse bleibt stabil am Boden', en: 'Heel planted throughout' },
        },
        {
          id: 'cali-leg-shrimp',
          name: { de: 'Shrimp Squats', en: 'Shrimp Squats' },
          targetSets: 3, targetRepsMin: 6, targetRepsMax: 10,
          notes: { de: 'Knie berührt sanft den Boden', en: 'Controlled quad-dominant touch' },
        },
        {
          id: 'cali-leg-nordic',
          name: { de: 'Full Nordic Curls', en: 'Nordic Hamstring Curls' },
          targetSets: 3, targetRepsMin: 4, targetRepsMax: 8,
          notes: { de: 'Hüfte komplett gestreckt', en: 'Keep hips locked straight' },
        },
      ],
    },
  },
  {
    id: 'calisthenics-hiit',
    title: { de: 'Eigengewicht HIIT & Kondition', en: 'Bodyweight HIIT Circuit' },
    category: 'hiit',
    sport: 'hiit',
    durationMin: 25,
    intensity: 'max',
    estBurnKcal: 290,
    icon: 'flame',
    hue: 'ember',
    fastingNote: {
      de: 'Kurzer maximaler Reiz — 20 Min. später Essenfenster ideal zum Glykogen-Laden.',
      en: 'High metabolic spike — best placed right before your eating window opens.',
    },
    exercises: [
      {
        id: 'hiit-burpees',
        name: { de: 'Burpees (sauberes Tempo)', en: 'Controlled Burpees' },
        targetSets: 5, targetRepsMin: 10, targetRepsMax: 15,
        notes: { de: '40s Arbeit / 20s Pause', en: '40s work / 20s rest' },
      },
      {
        id: 'hiit-climbers',
        name: { de: 'Mountain Climbers', en: 'Fast Mountain Climbers' },
        targetSets: 5, targetRepsMin: 30, targetRepsMax: 45, unit: 'sec',
        notes: { de: 'Stabile Schultern über Händen', en: 'Lock shoulders over hands' },
      },
      {
        id: 'hiit-jumpsquat',
        name: { de: 'Explosive Jump Squats', en: 'Explosive Squat Jumps' },
        targetSets: 5, targetRepsMin: 12, targetRepsMax: 18,
        notes: { de: 'Weich auf Vorderfuß landen', en: 'Land softly through hips' },
      },
    ],
  },
  {
    id: 'gym-push',
    title: { de: 'Gym Push Hypertrophie', en: 'Gym Push Hypertrophy' },
    category: 'strength',
    sport: 'weights',
    durationMin: 50,
    intensity: 'high',
    estBurnKcal: 380,
    icon: 'flame',
    hue: 'ember',
    fastingNote: {
      de: '500 ml Wasser + Prise Salz vorab schützen die maximale Satzleistung.',
      en: '500 ml water + pinch of salt protects peak strength while fasted.',
    },
    exercises: [
      {
        id: 'gym-incline-db',
        name: { de: 'Schrägbankdrücken (Kurzhantel)', en: 'Incline Dumbbell Press' },
        targetSets: 4, targetRepsMin: 8, targetRepsMax: 10,
        notes: { de: '2 Min. Satzpause', en: '2 min rest between sets' },
      },
      {
        id: 'gym-ohp',
        name: { de: 'Schulterdrücken stehend', en: 'Standing Overhead Press' },
        targetSets: 3, targetRepsMin: 8, targetRepsMax: 10,
        notes: { de: 'Starker Rumpf', en: 'Brace core and glutes' },
      },
      {
        id: 'gym-latraise',
        name: { de: 'Seitheben Kurzhantel / Kabel', en: 'Lateral Raises' },
        targetSets: 4, targetRepsMin: 12, targetRepsMax: 15,
        notes: { de: 'Ohne Schwung heben', en: 'Controlled tempo, 60s rest' },
      },
    ],
  },
  {
    id: 'zone2-cardio',
    title: { de: 'Zone-2 Fettverbrennung & Ketose', en: 'Zone-2 Aerobic & Ketosis' },
    category: 'cardio',
    sport: 'running',
    durationMin: 45,
    intensity: 'medium',
    estBurnKcal: 340,
    icon: 'drop',
    hue: 'hydro',
    fastingNote: {
      de: 'Puls bei 60–70% HFmax (Nasenatmung möglich). Schont Glykogen & Muskelmasse.',
      en: 'Keep HR 60–70% max (nasal breathing). Maximizes fat oxidation cleanly.',
    },
    exercises: [
      {
        id: 'cardio-zone2',
        name: { de: 'Dauerlauf / Ergometer Zone 2', en: 'Steady Zone-2 Run / Cycle' },
        targetSets: 1, targetRepsMin: 35, targetRepsMax: 45, unit: 'sec',
        notes: { de: 'Angabe in Minuten (35–45 Min. locker)', en: 'Continuous steady aerobic pace' },
      },
    ],
  },
  {
    id: 'mobility-autophagy',
    title: { de: 'Autophagie & Mobilitäts-Flow', en: 'Mobility & Recovery Flow' },
    category: 'mobility',
    sport: 'yoga',
    durationMin: 30,
    intensity: 'low',
    estBurnKcal: 110,
    icon: 'check',
    hue: 'plan',
    fastingNote: {
      de: 'Optimal für Fasten-Ruhetage — ohne Cortisolspitze.',
      en: 'Low-cortisol session for rest days and tight fasted windows.',
    },
    exercises: [
      {
        id: 'mob-9090',
        name: { de: '90/90 Hüft- & Thorakal-Flow', en: '90/90 Hip & Thoracic Flow' },
        targetSets: 3, targetRepsMin: 40, targetRepsMax: 60, unit: 'sec',
        notes: { de: 'Ruhige Nasenatmung', en: 'Deep nasal breaths each side' },
      },
      {
        id: 'mob-squat-hold',
        name: { de: 'Tiefe Kniebeuge Halten (Squat Hold)', en: 'Deep Squat Hold' },
        targetSets: 2, targetRepsMin: 45, targetRepsMax: 90, unit: 'sec',
        notes: { de: 'Brust aufrichten, Fersen unten', en: 'Chest upright, heels down' },
      },
    ],
  },
];

export function exercisesForLevel(program: WorkoutProgram, level: FitnessLevel): ExerciseSpec[] {
  if (program.exercisesByLevel) return program.exercisesByLevel[level] ?? program.exercisesByLevel.intermediate;
  return program.exercises ?? [];
}

/** Find the most recent logged sets for an exercise across saved workout logs. */
export function lastExercisePerformance(exerciseId: string, log: WorkoutLogEntry[]): LoggedSet[] | null {
  if (!Array.isArray(log) || log.length === 0) return null;
  const sorted = [...log].sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of sorted) {
    const found = entry.exercises?.find((e) => e.exerciseId === exerciseId && Array.isArray(e.sets) && e.sets.length > 0);
    if (found) return found.sets;
  }
  return null;
}

export function formatSetsSummary(sets: LoggedSet[], unit: RepUnit = 'reps', _lang: Lang = 'de'): string {
  if (!sets.length) return '';
  const suf = unit === 'sec' ? 's' : '';
  return sets
    .map((s) => `${s.reps}${suf}${s.loadKg ? `@${s.loadKg}kg` : ''}`)
    .join(' / ');
}

/** True once the athlete hits targetRepsMax across all prescribed sets cleanly. */
export function isProgressionReady(spec: ExerciseSpec, latestSets: LoggedSet[] | null): boolean {
  if (!latestSets || latestSets.length < spec.targetSets) return false;
  return latestSets.slice(0, spec.targetSets).every((s) => s.reps >= spec.targetRepsMax);
}

export function loggedSessionToTraining(entry: WorkoutLogEntry, fallbackStart = '18:00'): Training {
  return {
    sport: SPORT_IDS.includes(entry.sport) ? entry.sport : 'weights',
    duration_min: entry.durationMin,
    intensity: entry.intensity,
    start_time: entry.startTime ?? fallbackStart,
  };
}

export function recoveryAdvisory(dietBreakDue: boolean, lang: Lang): string | null {
  if (!dietBreakDue) return null;
  return lang === 'de'
    ? 'Hinweis: Über 8 Wochen im Kaloriendefizit — halte das harte Volumen bei 2–3 sauberen Arbeitssätzen und prüfe im Planer eine Erhaltungswoche.'
    : '8+ weeks in a calorie deficit — hold intensity high but trim volume to 2–3 clean working sets, and consider a maintenance week in Plan.';
}

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  assert(WORKOUT_PROGRAMS.length >= 6, 'ships staged calisthenics + fitness programs');
  const caliPush = WORKOUT_PROGRAMS.find((p) => p.category === 'calisthenics');
  assert(!!caliPush, 'includes calisthenics category');
  for (const p of WORKOUT_PROGRAMS) {
    assert(SPORT_IDS.includes(p.sport), `${p.id} maps to valid SPORT_IDS`);
  }

  if (caliPush) {
    const beg = exercisesForLevel(caliPush, 'beginner');
    const adv = exercisesForLevel(caliPush, 'advanced');
    assert(beg.length >= 3 && adv.length >= 3, 'staged exercises present');
    assert(beg[0].name.en !== adv[0].name.en, 'advanced progression differs from beginner');

    const first = beg[0];
    const log: WorkoutLogEntry[] = [
      {
        id: 'w2',
        date: '2026-11-26',
        workoutId: caliPush.id,
        sport: caliPush.sport,
        durationMin: caliPush.durationMin,
        intensity: caliPush.intensity,
        exercises: [{ exerciseId: first.id, name: first.name.en, sets: Array.from({ length: first.targetSets }, () => ({ reps: first.targetRepsMax })) }],
      },
      {
        id: 'w1',
        date: '2026-11-24',
        workoutId: caliPush.id,
        sport: caliPush.sport,
        durationMin: caliPush.durationMin,
        intensity: caliPush.intensity,
        exercises: [{ exerciseId: first.id, name: first.name.en, sets: [{ reps: first.targetRepsMin }] }],
      },
    ];
    const latest = lastExercisePerformance(first.id, log);
    assert(latest !== null && latest.length === first.targetSets, 'reads newest log entry');
    assert(isProgressionReady(first, latest), 'detects progression readiness when all sets hit targetRepsMax');
    assert(!isProgressionReady(first, [{ reps: first.targetRepsMin - 1 }]), 'does not trigger early');
    assert(formatSetsSummary([{ reps: 8 }, { reps: 8 }, { reps: 7 }]).includes('8 / 8 / 7'), 'formats set summary cleanly');
  }

  return 'workouts.ts: all checks passed';
}
