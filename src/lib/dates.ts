/**
 * Local-date helpers. Kept free of AsyncStorage so the streak and week-rollover
 * rules are checkable — this is exactly where the original code was wrong
 * (it used toISOString(), which is UTC, to decide what "today" was).
 */

export function todayISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parsed at midday so a DST shift can't tip the date over an edge. */
export function parseISO(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

/** ISO-8601 week key, so the free quota rolls over on Monday. */
export function weekKey(d: Date = new Date()): string {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Move to the Thursday of this week — the ISO week-numbering anchor.
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day + 3);
  const firstThursday = new Date(t.getFullYear(), 0, 4);
  const fDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - fDay + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${t.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Consecutive logged days ending today — or yesterday, so a streak doesn't
 * appear broken during the day before you've logged the current one.
 */
export function currentStreak(dates: string[], today = todayISO()): number {
  const set = new Set(dates ?? []);
  const cursor = parseISO(today);
  if (!set.has(todayISO(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  // Bounded so a corrupt log can never spin forever.
  while (set.has(todayISO(cursor)) && streak < 3650) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Longest historical consecutive streak in the dates array.
 */
export function longestStreak(dates: string[]): number {
  if (!dates || dates.length === 0) return 0;
  const sorted = Array.from(new Set(dates.filter((d) => typeof d === 'string'))).sort();
  if (sorted.length === 0) return 0;

  let maxStreak = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]);
    const curr = parseISO(sorted[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current++;
      if (current > maxStreak) maxStreak = current;
    } else if (diffDays > 1) {
      current = 1;
    }
  }

  return maxStreak;
}

// ---------------------------------------------------------------------------

/**
 * How many of the last N days were logged — a number a bad Tuesday cannot
 * destroy.
 *
 * `currentStreak` falls to zero on one missed day. Someone who holds forty
 * days and then gets ill loses all of it, and that is the mechanic that makes
 * people delete a fitness app. This sits next to the streak rather than
 * replacing it: the streak is still there for whoever enjoys it, but the
 * figure in front is one that survives real life.
 */
export function consistency(dates: string[], days = 30, today = todayISO()): { hit: number; days: number } {
  const set = new Set(Array.isArray(dates) ? dates.filter((d) => typeof d === 'string') : []);
  const cursor = parseISO(today);
  let hit = 0;

  for (let i = 0; i < days; i++) {
    if (set.has(todayISO(cursor))) hit++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { hit, days };
}

// ---------------------------------------------------------------------------
// Human-readable date labels (no cryptic single-letter abbreviations)
// ---------------------------------------------------------------------------

export const GERMAN_WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const GERMAN_WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export const ENGLISH_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const ENGLISH_WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatFullWeekday(date: Date | string, lang: 'de' | 'en' = 'de'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const dayIdx = (d.getDay() + 6) % 7; // Monday = 0
  return lang === 'de' ? GERMAN_WEEKDAYS[dayIdx] : ENGLISH_WEEKDAYS[dayIdx];
}

export function formatReadableDate(date: Date | string, lang: 'de' | 'en' = 'de'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const weekday = formatFullWeekday(d, lang);
  const dayNum = d.getDate();
  const monthName = lang === 'de' ? GERMAN_MONTHS[d.getMonth()] : ENGLISH_MONTHS[d.getMonth()];
  return lang === 'de' ? `${weekday}, ${dayNum}. ${monthName}` : `${weekday}, ${monthName} ${dayNum}`;
}

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  // Local, not UTC: 23:30 on the 5th is still the 5th regardless of timezone.
  assert(todayISO(new Date(2026, 0, 5, 23, 30)) === '2026-01-05', 'late evening stays on the same local date');
  assert(todayISO(new Date(2026, 0, 5, 0, 30)) === '2026-01-05', 'early morning stays on the same local date');

  // Streak counted back from today.
  assert(currentStreak(['2026-03-10', '2026-03-09', '2026-03-08'], '2026-03-10') === 3, 'three logged days in a row');
  // Today not logged yet — yesterday's streak must still show.
  assert(currentStreak(['2026-03-09', '2026-03-08'], '2026-03-10') === 2, 'streak survives an unlogged today');
  // A missed day breaks it.
  assert(currentStreak(['2026-03-10', '2026-03-08'], '2026-03-10') === 1, 'a gap ends the streak');
  // Two days stale is broken.
  assert(currentStreak(['2026-03-08'], '2026-03-10') === 0, 'stale log gives no streak');
  assert(currentStreak([], '2026-03-10') === 0, 'empty log gives no streak');
  // Duplicates must not inflate the count.
  assert(currentStreak(['2026-03-10', '2026-03-10', '2026-03-09'], '2026-03-10') === 2, 'duplicate dates counted once');
  // Across a month boundary.
  assert(currentStreak(['2026-03-01', '2026-02-28', '2026-02-27'], '2026-03-01') === 3, 'streak crosses a month end');

  // Longest streak
  assert(longestStreak(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-10', '2026-01-11']) === 3, 'finds longest segment');
  assert(longestStreak([]) === 0, 'longest streak of empty is 0');

  // Week key rolls over on Monday, not Sunday.
  const sunday = new Date(2026, 2, 8); // Sun 8 Mar 2026
  const monday = new Date(2026, 2, 9); // Mon 9 Mar 2026
  const saturday = new Date(2026, 2, 7);
  assert(weekKey(saturday) === weekKey(sunday), 'Saturday and Sunday share a week');
  assert(weekKey(sunday) !== weekKey(monday), 'Monday starts a new week');

  // --- consistency ---------------------------------------------------------

  const day = (back: number) => {
    const d = parseISO('2026-08-20');
    d.setDate(d.getDate() - back);
    return todayISO(d);
  };

  const perfect = Array.from({ length: 30 }, (_, i) => day(i));
  assert(consistency(perfect, 30, '2026-08-20').hit === 30, 'thirty of thirty');

  // The whole point: one missed day costs one day, not the lot.
  const oneMissed = perfect.filter((d) => d !== day(3));
  assert(consistency(oneMissed, 30, '2026-08-20').hit === 29, 'a single gap costs exactly one day');
  assert(currentStreak(oneMissed, '2026-08-20') === 3, 'while the streak collapses to three');

  assert(consistency([], 30, '2026-08-20').hit === 0, 'nothing logged is nothing');
  assert(consistency(perfect, 7, '2026-08-20').hit === 7, 'a shorter window counts fewer');
  assert(consistency([...perfect, ...perfect], 30, '2026-08-20').hit === 30, 'duplicates do not inflate it');
  assert(consistency(['2020-01-01'], 30, '2026-08-20').hit === 0, 'dates outside the window do not count');
  assert(consistency(null as any, 30, '2026-08-20').hit === 0, 'a missing log does not throw');
  assert(consistency([null, 7, day(1)] as any, 30, '2026-08-20').hit === 1, 'junk entries are ignored');

  // Format checks
  assert(formatFullWeekday('2026-08-15', 'de') === 'Samstag', 'Saturday in German');
  assert(formatFullWeekday('2026-08-15', 'en') === 'Saturday', 'Saturday in English');
  assert(formatReadableDate('2026-08-15', 'de') === 'Samstag, 15. August', 'Full readable German date');
  assert(formatReadableDate('2026-08-15', 'en') === 'Saturday, August 15', 'Full readable English date');

  return 'dates.ts: all checks passed';
}
