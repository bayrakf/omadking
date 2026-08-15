/**
 * Gamification & Achievement Badges for Fasting and Nutrition Milestones.
 *
 * Pure logic module — testable in plain node via `npm run check`.
 */

export type BadgeCategory = 'streak' | 'fasting' | 'body' | 'workout';

export interface AchievementBadge {
  id: string;
  titleKey: string;
  descKey: string;
  category: BadgeCategory;
  icon: string;
  color: string;
  wash: string;
  unlocked: boolean;
  progress: number; // 0 to 1
  progressLabel: string;
}

export interface AchievementInput {
  streak: number;
  fastLog: string[];
  weighInCount: number;
  workoutsLogged: number;
  measuredMaintenance?: boolean;
}

export function evaluateAchievements(input: AchievementInput): AchievementBadge[] {
  const { streak, fastLog, weighInCount, workoutsLogged, measuredMaintenance } = input;
  const totalFasts = fastLog.length;

  return [
    {
      id: 'first_fast',
      titleKey: 'badge.firstFast',
      descKey: 'badge.firstFastDesc',
      category: 'fasting',
      icon: 'flame',
      color: '#FF6B4A',
      wash: 'rgba(255, 107, 74, 0.18)',
      unlocked: totalFasts >= 1,
      progress: Math.min(1, totalFasts / 1),
      progressLabel: `${Math.min(1, totalFasts)} / 1`,
    },
    {
      id: 'streak_3',
      titleKey: 'badge.streak3',
      descKey: 'badge.streak3Desc',
      category: 'streak',
      icon: 'flame',
      color: '#F59E0B',
      wash: 'rgba(245, 158, 11, 0.18)',
      unlocked: streak >= 3,
      progress: Math.min(1, streak / 3),
      progressLabel: `${Math.min(3, streak)} / 3 Tage`,
    },
    {
      id: 'streak_7',
      titleKey: 'badge.streak7',
      descKey: 'badge.streak7Desc',
      category: 'streak',
      icon: 'crown',
      color: '#FBBF24',
      wash: 'rgba(251, 191, 36, 0.18)',
      unlocked: streak >= 7,
      progress: Math.min(1, streak / 7),
      progressLabel: `${Math.min(7, streak)} / 7 Tage`,
    },
    {
      id: 'streak_30',
      titleKey: 'badge.streak30',
      descKey: 'badge.streak30Desc',
      category: 'streak',
      icon: 'crown',
      color: '#EC4899',
      wash: 'rgba(236, 72, 153, 0.18)',
      unlocked: streak >= 30,
      progress: Math.min(1, streak / 30),
      progressLabel: `${Math.min(30, streak)} / 30 Tage`,
    },
    {
      id: 'weigh_5',
      titleKey: 'badge.weigh5',
      descKey: 'badge.weigh5Desc',
      category: 'body',
      icon: 'chart',
      color: '#10B981',
      wash: 'rgba(16, 185, 129, 0.18)',
      unlocked: weighInCount >= 5,
      progress: Math.min(1, weighInCount / 5),
      progressLabel: `${Math.min(5, weighInCount)} / 5 Wägungen`,
    },
    {
      id: 'metabolism_measured',
      titleKey: 'badge.measured',
      descKey: 'badge.measuredDesc',
      category: 'body',
      icon: 'coach',
      color: '#8B5CF6',
      wash: 'rgba(139, 92, 246, 0.18)',
      unlocked: !!measuredMaintenance,
      progress: measuredMaintenance ? 1 : 0,
      progressLabel: measuredMaintenance ? '1 / 1' : '0 / 1',
    },
    {
      id: 'workout_first',
      titleKey: 'badge.workout1',
      descKey: 'badge.workout1Desc',
      category: 'workout',
      icon: 'flame',
      color: '#38BDF8',
      wash: 'rgba(56, 189, 248, 0.18)',
      unlocked: workoutsLogged >= 1,
      progress: Math.min(1, workoutsLogged / 1),
      progressLabel: `${Math.min(1, workoutsLogged)} / 1 Workout`,
    },
    {
      id: 'workout_10',
      titleKey: 'badge.workout10',
      descKey: 'badge.workout10Desc',
      category: 'workout',
      icon: 'crown',
      color: '#6366F1',
      wash: 'rgba(99, 102, 241, 0.18)',
      unlocked: workoutsLogged >= 10,
      progress: Math.min(1, workoutsLogged / 10),
      progressLabel: `${Math.min(10, workoutsLogged)} / 10 Workouts`,
    },
  ];
}

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  const empty = evaluateAchievements({
    streak: 0,
    fastLog: [],
    weighInCount: 0,
    workoutsLogged: 0,
    measuredMaintenance: false,
  });
  assert(empty.length === 8, '8 total achievements exist');
  assert(empty.every((b) => !b.unlocked), 'all locked at start');

  const advanced = evaluateAchievements({
    streak: 7,
    fastLog: ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'],
    weighInCount: 5,
    workoutsLogged: 2,
    measuredMaintenance: true,
  });
  assert(advanced.find((b) => b.id === 'first_fast')?.unlocked === true, 'first fast unlocked');
  assert(advanced.find((b) => b.id === 'streak_7')?.unlocked === true, '7 day streak unlocked');
  assert(advanced.find((b) => b.id === 'streak_30')?.unlocked === false, '30 day streak still locked');
  assert(advanced.find((b) => b.id === 'metabolism_measured')?.unlocked === true, 'metabolism measured unlocked');

  return 'achievements.ts: all checks passed';
}
