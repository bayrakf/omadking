/**
 * Two languages, one dictionary, and a check that keeps them in step.
 *
 * The app is written in a deliberate voice — it states no figure it did not
 * compute, and it says what a number means rather than decorating it. That
 * voice is the thing being translated, not the words: `Fasting` becomes
 * `Fastenzeit`, not `Fastend`, because the German is a state you are in, and
 * the English was too.
 *
 * Placeholders are `{name}`. The one failure mode that a dictionary cannot
 * survive is a translation that drops or renames one — the sentence then
 * silently loses its number, which for this app is the whole sentence. So
 * `demo()` asserts that both languages carry exactly the same placeholders for
 * every key, and that neither is missing a key the other has. Getting that
 * wrong fails `npm run check` rather than reaching a reader.
 *
 * German is the informal `du`. This is an app about somebody's own body that
 * asks them a question every evening; `Sie` would be a stranger asking.
 */

export type Lang = 'en' | 'de';

export const LANGS: { id: Lang; label: string; endonym: string }[] = [
  { id: 'en', label: 'English', endonym: 'English' },
  { id: 'de', label: 'German', endonym: 'Deutsch' },
];

/**
 * The language to use, given what was chosen and what the device is set to.
 *
 * Null is a real value: it means nobody has chosen, which is everyone who
 * installed the app before this existed. Following the device is the right
 * default for them, and it is why the setting stores null rather than being
 * initialised to `en` — an initialised `en` would be indistinguishable from a
 * German speaker who deliberately wanted English, and would stop following the
 * device the moment they changed it.
 */
export function pickLang(stored: Lang | null, deviceLocale: string | null | undefined): Lang {
  if (stored === 'en' || stored === 'de') return stored;
  return String(deviceLocale ?? '').toLowerCase().startsWith('de') ? 'de' : 'en';
}

const EN = {
  // Navigation
  'tab.today': 'Today',
  'tab.plan': 'Plan',
  'tab.progress': 'Progress',
  'tab.shop': 'Shop',
  'tab.you': 'You',

  // Today
  'today.fasting': 'Fasting',
  'today.windowOpen': 'Window open',
  'today.until': 'until {time}',
  'today.approximate': 'Approximate',
  'today.window': '{start}–{end} · {fast}h fast · session {session}',
  'today.agenda': 'Today',
  'today.tick': 'Tick',
  'today.energy': 'Energy',
  'today.protein': 'Protein',
  'today.hydration': 'Hydration',
  'today.streakTitle': '{n}-day streak!',
  'today.streakInfo': 'Fasting streaks measure consecutive days you logged your fast.',
  'today.feelingTitle': 'How are you feeling today?',
  'today.bentoPhase': 'Metabolic Phase',
  'today.bentoHydration': 'Hydration',
  'today.bentoMeal': 'Next Meal',
  'today.bentoBody': 'Body & Weight',
  // Workouts
  'workout.title': 'Workouts & Training',
  'workout.sub': 'Sessions tailored for fasted training and optimal meal timing.',
  'workout.applyToPlan': 'Apply to today’s meal plan',
  'workout.applied': 'Applied to meal plan ✓',
  'workout.fastingNote': 'Fasting protocol',
  'workout.exercises': 'Exercise breakdown',
  'workout.all': 'All',
  'workout.strength': 'Strength',
  'workout.cardio': 'Cardio',
  'workout.hiit': 'HIIT',
  'workout.mobility': 'Mobility',

  // You
  'you.title': 'You',
  'you.setup': 'Your setup',
  'you.data': 'Your data',
  'you.about': 'About',
  'you.body': 'Body',
  'you.bodySub': 'What the targets are calculated from.',
  'you.day': 'Your day',
  'you.daySub': 'When the window opens, and for how long.',
  'you.targets': 'Targets',
  'you.targetsSub': 'Worked out from your body and your goal.',
  'you.reminders': 'Reminders',
  'you.sync': 'Sync',
  'you.export': 'Export, restore, delete',
  'you.exportSub': 'Everything lives on this device',
  'you.language': 'Language',
  'you.languageSub': 'The app, and the recipes it writes.',
  'you.languageFollows': 'Following your device',

  // Language screen
  'lang.title': 'Language',
  'lang.sub': 'The interface, and the language your recipes are written in.',
  'lang.device': 'Follow my device',
  'lang.deviceNote':
    'The app uses your device language, and changes with it. Choosing one below fixes it instead.',
  'lang.recipeNote':
    'The coach and the meal plans are written in the language you pick here, not translated after the fact.',

  // Your day / protocols
  'day.window': 'Window',
  'day.opens': 'Opens',
  'day.length': 'Length',
  'day.training': 'Usual training',
  'day.protocol': 'Protocol',

  'protocol.omad-strict': 'Strict OMAD',
  'protocol.omad-strict.note': 'One sitting, 23 hours off. Hardest to hit a large calorie target in.',
  'protocol.omad': 'OMAD',
  'protocol.omad.note': 'One meal with room to finish it. The usual starting point.',
  'protocol.warrior': 'Warrior 20:4',
  'protocol.warrior.note': 'A long meal or a small one and a large one. Easier on heavy training days.',
  'protocol.18-6': '18:6',
  'protocol.18-6.note': 'Two proper meals. Less strict, and simpler to eat enough protein in.',
  'protocol.16-8': '16:8',
  'protocol.16-8.note': 'The gentlest version. Often where people start before shortening the window.',

  // Plan
  'plan.title': 'Plan the meal',
  'plan.sub': 'Your targets follow the session you actually do.',
  'plan.build': 'Build the plan',
  'plan.building': 'Building your plan…',
  'plan.restDay': 'Rest day',
  'plan.sport': 'Sport',
  'plan.duration': 'Duration',
  'plan.effort': 'Effort',
  'plan.startsAt': 'Starts at',
  'plan.recent': 'Recent plans',
  'plan.copy': 'Copy plan',
  'plan.empty': 'Set the session above, then build a plan with the exact times to eat.',

  // Recipe
  'recipe.ingredients': 'Ingredients',
  'recipe.method': 'Method',
  'recipe.reheat': 'Reheating tomorrow',
  'recipe.prep': '{min} min prep · cook once, eat tomorrow',

  // Shop
  'shop.title': 'Shopping',
  'shop.basket': '{done} of {total} in the basket',
  'shop.copy': 'Copy',
  'shop.clear': 'Clear',

  // Progress
  'progress.title': 'Progress',
  'progress.entries': '{n} entries logged',
  'progress.noEntries': 'No entries yet',
  'progress.thisWeek': 'This week',
  'progress.yourBody': 'Your body',
  'progress.history': 'History',
  'progress.corrections': 'Corrections',
  'progress.correctionsSub': 'Weigh-in, evenings, fasts, days to leave out',

  // Coach
  'coach.title': 'Coach',
  'coach.disclaimer': 'Not medical advice',
  'coach.greeting':
    'Ask me about meal timing, electrolytes, or fuelling a hard session on one meal a day.',
  'coach.placeholder': 'Ask the coach',
  'coach.send': 'Send',
  'coach.message': 'Message',
  'coach.clear': 'Clear conversation',
  'coach.clearShort': 'Clear',
  'coach.knows': 'What the coach could know',
  'coach.free':
    'Answers use general ranges. With Premium the coach reasons with your measured maintenance, your trend and your weekday pattern instead.',
  'coach.p1': 'Best electrolytes for a long fast?',
  'coach.p2': 'Why do I crash mid-session?',
  'coach.p3': 'Pre-workout on OMAD?',
  'coach.p4': 'How much protein do I need?',
  'coach.p5': 'Is tonight’s meal enough?',
  'coach.p6': 'Can I swap an ingredient?',

  // Shared chrome
  'nav.back': 'Back',

  // Plan tabs & gallery
  'plan.tabToday': "Today's plan",
  'plan.tabSaved': 'Saved & history',
  'plan.cookAgain': 'Cook again',
  'plan.noHistory': 'No saved plans yet. Build a plan to save it here.',

  // Shop filters
  'shop.filterAll': 'All',
  'shop.filterOpen': 'To buy',
  'shop.filterDone': 'Done',
  'shop.clearDone': 'Clear checked',

  // Progress segments
  'progress.tabWeek': 'Week & trend',
  'progress.tabBody': 'Body & rate',
  'progress.tabHistory': 'History',

  // Profile Groups
  'you.groupBody': 'Body & goals',
  'you.groupRhythm': 'Fasting & rhythm',
  'you.groupNotifications': 'Notifications',
  'you.groupData': 'Data & cloud',
  'you.groupAbout': 'About & legal',
  'you.premiumActive': 'Premium Active',
  'you.getPremium': 'Get Premium',

  // Body
  'body.avoid': 'Never put in a recipe',

  // Targets
  'targets.numbers': 'Your numbers',
  'targets.training': 'Training',

  // Reminders
  'reminders.sub': 'Local to this device. No account, no push token.',
  'reminders.tellMe': 'Tell me when to eat',
  'reminders.arrives': 'What arrives',

  // Sync
  'sync.title': 'Sync',
  'sync.sub': 'Optional, anonymous, and unreadable to the server.',
  'sync.across': 'Sync across devices',
  'sync.now': 'Sync now',
  'sync.phrase': 'Recovery phrase',

  // Your data
  'data.title': 'Your data',
  'data.sub': 'It lives on this device. Take it with you or remove it.',
  'data.keep': 'Keep a copy',
  'data.export': 'Export',
  'data.restore': 'Restore',
  'data.summary': 'Summary for an appointment',
  'data.startOver': 'Start over',
  'data.reset': 'Reset profile',
  'data.deleteAll': 'Delete all data',
  'data.deleteAccount': 'Delete account and server copy',
  // The day's agenda
  'agenda.cook': 'Start cooking',
  'agenda.cookBody': '{min} min prep, ready for {time}',
  'agenda.snack': 'Pre-training snack',
  'agenda.snackBody': '20–30g fast carbs plus sodium, to protect output',
  'agenda.open': 'Window opens',
  'agenda.openBody': '{hours}h fast ends',
  'agenda.openBodyNoPlan': 'Break the fast',
  'agenda.meal': 'Main meal',
  'agenda.mealBody': '{kcal} kcal · {protein}g protein',
  'agenda.close': 'Window closes',
  'agenda.closeBody': 'Last bite — {hours}h fast starts',
  'agenda.log': 'Log the fast',
  'agenda.logBody': 'Keeps the streak honest',
  // Onboarding
  'onb.tagline': 'One meal a day · built for training',
  'onb.hero': 'Eat once.\nTime it right.',
  'onb.heroSub':
    'Four questions, about a minute. Then you get the exact times to eat around the sessions you actually do.',
  'onb.open': 'Open the app',
  'onb.continue': 'Continue',
  'onb.body': 'Your body',
  'onb.bodySub': 'Sets your energy and protein targets.',
  'onb.weight': 'Weight · kg',
  'onb.height': 'Height · cm',
  'onb.age': 'Age',
  'onb.sex': 'Sex',
  'onb.sexNote': 'Only affects the metabolic rate formula.',
  'onb.male': 'Male',
  'onb.female': 'Female',
  'onb.other': 'Other',
  'onb.training': 'Training and goal',
  'onb.trainedFor': 'How long have you trained?',
  'onb.after': 'What are you after?',
  'onb.beginner': 'Beginner',
  'onb.intermediate': 'Intermediate',
  'onb.advanced': 'Advanced',
  'onb.performance': 'Performance',
  'onb.loseFat': 'Lose fat',
  'onb.buildMuscle': 'Build muscle',
  'onb.whereTo': 'Where to, and how fast',
  'onb.whereToSub': 'Both are editable later, and both are only a direction.',
  'onb.howFast': 'How fast',
  'onb.targetWeight': 'Target weight · kg',
  'onb.window': 'Your window',
  'onb.opensAt': 'Window opens at',
  'onb.howLong': 'How long is it open?',
  'onb.fastLength': 'That is a {hours} hour fast every day.',
  'onb.trainAt': 'You usually train at',
  'onb.done': 'That’s everything',
  'onb.sumWindow': 'Eating window',
  'onb.sumFast': 'Daily fast',
  'onb.sumTraining': 'Usual training',
  'onb.sumGoal': 'Goal',
  'onb.sumTarget': 'Target',
  'onb.sumPace': 'Pace',
  'onb.paceStandard': 'standard',
  'onb.numbersOnly': 'Numbers only',
} as const;

export type Key = keyof typeof EN;

const DE: Record<Key, string> = {
  'tab.today': 'Heute',
  'tab.plan': 'Plan',
  'tab.progress': 'Verlauf',
  'tab.shop': 'Einkauf',
  'tab.you': 'Du',

  'today.fasting': 'Fastenzeit',
  'today.windowOpen': 'Fenster offen',
  'today.until': 'bis {time}',
  'today.approximate': 'Ungefähr',
  'today.window': '{start}–{end} · {fast} h Fasten · Training {session}',
  'today.agenda': 'Heute',
  'today.tick': 'Haken',
  'today.energy': 'Energie',
  'today.protein': 'Protein',
  'today.hydration': 'Trinken',
  'today.streakTitle': '{n}-Tage Fasten-Serie!',
  'today.streakInfo': 'Die Serie zählt aufeinanderfolgende Tage, an denen du dein Fasten geloggt hast.',
  'today.feelingTitle': 'Wie fühlst du dich heute im Fasten?',
  'today.bentoPhase': 'Stoffwechsel-Phase',
  'today.bentoHydration': 'Hydration',
  'today.bentoMeal': 'Nächste Mahlzeit',
  'today.bentoBody': 'Körper & Gewicht',
  // Workouts
  'workout.title': 'Workouts & Training',
  'workout.sub': 'Einheiten optimiert für gefastetes Training und Nährstoff-Timing.',
  'workout.applyToPlan': 'Für heutigen Tag im Planer übernehmen',
  'workout.applied': 'In Planer übernommen ✓',
  'workout.fastingNote': 'Fasten-Protokoll',
  'workout.exercises': 'Übungsablauf',
  'workout.all': 'Alle',
  'workout.strength': 'Kraft',
  'workout.cardio': 'Cardio',
  'workout.hiit': 'HIIT',
  'workout.mobility': 'Mobilität',

  'you.title': 'Du',
  'you.setup': 'Deine Einstellungen',
  'you.data': 'Deine Daten',
  'you.about': 'Über',
  'you.body': 'Körper',
  'you.bodySub': 'Woraus die Zielwerte berechnet werden.',
  'you.day': 'Dein Tag',
  'you.daySub': 'Wann das Fenster aufgeht, und wie lange.',
  'you.targets': 'Zielwerte',
  'you.targetsSub': 'Aus deinem Körper und deinem Ziel berechnet.',
  'you.reminders': 'Erinnerungen',
  'you.sync': 'Sync',
  'you.export': 'Exportieren, wiederherstellen, löschen',
  'you.exportSub': 'Alles liegt auf diesem Gerät',
  'you.language': 'Sprache',
  'you.languageSub': 'Die App, und die Rezepte, die sie schreibt.',
  'you.languageFollows': 'Folgt deinem Gerät',

  'lang.title': 'Sprache',
  'lang.sub': 'Die Oberfläche, und die Sprache, in der deine Rezepte geschrieben werden.',
  'lang.device': 'Gerät folgen',
  'lang.deviceNote':
    'Die App nimmt die Sprache deines Geräts und wechselt mit ihr. Eine Auswahl unten legt sie stattdessen fest.',
  'lang.recipeNote':
    'Coach und Essensplan werden in der hier gewählten Sprache geschrieben, nicht nachträglich übersetzt.',

  'day.window': 'Fenster',
  'day.opens': 'Öffnet',
  'day.length': 'Dauer',
  'day.training': 'Übliches Training',
  'day.protocol': 'Protokoll',

  'protocol.omad-strict': 'Striktes OMAD',
  'protocol.omad-strict.note':
    'Eine Sitzung, 23 Stunden Pause. Am schwersten, wenn das Kalorienziel hoch ist.',
  'protocol.omad': 'OMAD',
  'protocol.omad.note': 'Eine Mahlzeit mit Zeit, sie aufzuessen. Der übliche Anfang.',
  'protocol.warrior': 'Warrior 20:4',
  'protocol.warrior.note':
    'Eine lange Mahlzeit, oder eine kleine und eine große. Leichter an harten Trainingstagen.',
  'protocol.18-6': '18:6',
  'protocol.18-6.note': 'Zwei richtige Mahlzeiten. Weniger streng, und einfacher fürs Protein.',
  'protocol.16-8': '16:8',
  'protocol.16-8.note':
    'Die sanfteste Variante. Oft der Anfang, bevor das Fenster kürzer wird.',

  'plan.title': 'Mahlzeit planen',
  'plan.sub': 'Deine Zielwerte folgen dem Training, das du wirklich machst.',
  'plan.build': 'Plan erstellen',
  'plan.building': 'Dein Plan entsteht…',
  'plan.restDay': 'Ruhetag',
  'plan.sport': 'Sport',
  'plan.duration': 'Dauer',
  'plan.effort': 'Intensität',
  'plan.startsAt': 'Beginnt um',
  'plan.recent': 'Letzte Pläne',
  'plan.copy': 'Plan kopieren',
  'plan.empty':
    'Stell oben das Training ein, dann entsteht ein Plan mit den genauen Essenszeiten.',

  'recipe.ingredients': 'Zutaten',
  'recipe.method': 'Zubereitung',
  'recipe.reheat': 'Morgen aufwärmen',
  'recipe.prep': '{min} min Vorbereitung · einmal kochen, morgen essen',

  'shop.title': 'Einkauf',
  'shop.basket': '{done} von {total} im Korb',
  'shop.copy': 'Kopieren',
  'shop.clear': 'Leeren',

  'progress.title': 'Verlauf',
  'progress.entries': '{n} Einträge erfasst',
  'progress.noEntries': 'Noch keine Einträge',
  'progress.thisWeek': 'Diese Woche',
  'progress.yourBody': 'Dein Körper',
  'progress.history': 'Historie',
  'progress.corrections': 'Korrekturen',
  'progress.correctionsSub': 'Wiegung, Abende, Fasten, Tage zum Auslassen',
  'coach.title': 'Coach',
  'coach.disclaimer': 'Keine medizinische Beratung',
  'coach.greeting':
    'Frag mich nach Essenszeiten, Elektrolyten oder wie du eine harte Einheit auf eine Mahlzeit am Tag bringst.',
  'coach.placeholder': 'Frag den Coach',
  'coach.send': 'Senden',
  'coach.message': 'Nachricht',
  'coach.clear': 'Unterhaltung löschen',
  'coach.clearShort': 'Löschen',
  'coach.knows': 'Was der Coach wissen könnte',
  'coach.free':
    'Antworten arbeiten mit allgemeinen Bereichen. Mit Premium rechnet der Coach stattdessen mit deinem gemessenen Erhaltungsbedarf, deinem Trend und deinem Wochentagsmuster.',
  'coach.p1': 'Beste Elektrolyte für ein langes Fasten?',
  'coach.p2': 'Warum falle ich mitten im Training ab?',
  'coach.p3': 'Pre-Workout bei OMAD?',
  'coach.p4': 'Wie viel Protein brauche ich?',
  'coach.p5': 'Reicht das Essen heute Abend?',
  'coach.p6': 'Kann ich eine Zutat tauschen?',

  'nav.back': 'Zurück',

  // Plan tabs & gallery
  'plan.tabToday': 'Heutiger Plan',
  'plan.tabSaved': 'Rezepte & Verlauf',
  'plan.cookAgain': 'Erneut kochen',
  'plan.noHistory': 'Noch keine Pläne gespeichert. Erstelle einen Plan, um ihn hier zu sichern.',

  // Shop filters
  'shop.filterAll': 'Alle',
  'shop.filterOpen': 'Offen',
  'shop.filterDone': 'Erledigt',
  'shop.clearDone': 'Erledigte leeren',

  // Progress segments
  'progress.tabWeek': 'Woche & Trend',
  'progress.tabBody': 'Körper & Messung',
  'progress.tabHistory': 'Historie',

  // Profile Groups
  'you.groupBody': 'Mein Körper & Ziele',
  'you.groupRhythm': 'Fasten-Rhythmus & Zeiten',
  'you.groupNotifications': 'Benachrichtigungen',
  'you.groupData': 'Daten & Synchronisation',
  'you.groupAbout': 'Über uns & Rechtliches',
  'you.premiumActive': 'Premium Aktiv',
  'you.getPremium': 'Premium holen',

  'body.avoid': 'Kommt nie ins Rezept',

  'targets.numbers': 'Deine Werte',
  'targets.training': 'Training',

  'reminders.sub': 'Nur auf diesem Gerät. Kein Konto, kein Push-Token.',
  'reminders.tellMe': 'Sag mir, wann ich essen soll',
  'reminders.arrives': 'Was ankommt',

  'sync.title': 'Sync',
  'sync.sub': 'Optional, anonym, und für den Server unlesbar.',
  'sync.across': 'Sync über Geräte hinweg',
  'sync.now': 'Jetzt synchronisieren',
  'sync.phrase': 'Wiederherstellungsphrase',

  'data.title': 'Deine Daten',
  'data.sub': 'Sie liegen auf diesem Gerät. Nimm sie mit oder lösche sie.',
  'data.keep': 'Eine Kopie behalten',
  'data.export': 'Exportieren',
  'data.restore': 'Wiederherstellen',
  'data.summary': 'Zusammenfassung für einen Termin',
  'data.startOver': 'Von vorn',
  'data.reset': 'Profil zurücksetzen',
  'data.deleteAll': 'Alle Daten löschen',
  'data.deleteAccount': 'Konto und Serverkopie löschen',
  'agenda.cook': 'Kochen anfangen',
  'agenda.cookBody': '{min} min Vorbereitung, fertig um {time}',
  'agenda.snack': 'Snack vor dem Training',
  'agenda.snackBody': '20–30 g schnelle Kohlenhydrate plus Natrium, damit die Leistung steht',
  'agenda.open': 'Fenster öffnet',
  'agenda.openBody': '{hours} h Fasten endet',
  'agenda.openBodyNoPlan': 'Fasten brechen',
  'agenda.meal': 'Hauptmahlzeit',
  'agenda.mealBody': '{kcal} kcal · {protein} g Protein',
  'agenda.close': 'Fenster schließt',
  'agenda.closeBody': 'Letzter Bissen — {hours} h Fasten beginnt',
  'agenda.log': 'Fasten eintragen',
  'agenda.logBody': 'Hält die Serie ehrlich',
  'onb.tagline': 'Eine Mahlzeit am Tag · fürs Training gebaut',
  'onb.hero': 'Einmal essen.\nRichtig timen.',
  'onb.heroSub':
    'Vier Fragen, ungefähr eine Minute. Danach bekommst du die genauen Essenszeiten rund um die Einheiten, die du wirklich machst.',
  'onb.open': 'App öffnen',
  'onb.continue': 'Weiter',
  'onb.body': 'Dein Körper',
  'onb.bodySub': 'Bestimmt deine Energie- und Proteinziele.',
  'onb.weight': 'Gewicht · kg',
  'onb.height': 'Größe · cm',
  'onb.age': 'Alter',
  'onb.sex': 'Geschlecht',
  'onb.sexNote': 'Wirkt sich nur auf die Grundumsatzformel aus.',
  'onb.male': 'Männlich',
  'onb.female': 'Weiblich',
  'onb.other': 'Divers',
  'onb.training': 'Training und Ziel',
  'onb.trainedFor': 'Wie lange trainierst du schon?',
  'onb.after': 'Was willst du erreichen?',
  'onb.beginner': 'Anfänger',
  'onb.intermediate': 'Fortgeschritten',
  'onb.advanced': 'Erfahren',
  'onb.performance': 'Leistung',
  'onb.loseFat': 'Fett verlieren',
  'onb.buildMuscle': 'Muskeln aufbauen',
  'onb.whereTo': 'Wohin, und wie schnell',
  'onb.whereToSub': 'Beides ist später änderbar, und beides ist nur eine Richtung.',
  'onb.howFast': 'Wie schnell',
  'onb.targetWeight': 'Zielgewicht · kg',
  'onb.window': 'Dein Fenster',
  'onb.opensAt': 'Fenster öffnet um',
  'onb.howLong': 'Wie lange ist es offen?',
  'onb.fastLength': 'Das sind {hours} Stunden Fasten, jeden Tag.',
  'onb.trainAt': 'Du trainierst meistens um',
  'onb.done': 'Das war alles',
  'onb.sumWindow': 'Essensfenster',
  'onb.sumFast': 'Tägliches Fasten',
  'onb.sumTraining': 'Übliches Training',
  'onb.sumGoal': 'Ziel',
  'onb.sumTarget': 'Ziel',
  'onb.sumPace': 'Tempo',
  'onb.paceStandard': 'Standard',
  'onb.numbersOnly': 'Nur Zahlen',
};

const TABLES: Record<Lang, Record<Key, string>> = { en: EN, de: DE };

export type Vars = Record<string, string | number>;

/** Every `{name}` in a phrase, in order of appearance. */
export function placeholders(phrase: string): string[] {
  return (phrase.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).map((s) => s.slice(1, -1));
}

/**
 * A phrase in the given language, with its placeholders filled.
 *
 * An unknown placeholder is left standing rather than blanked. A sentence in
 * this app usually exists to carry one number, so silently rendering "You are
 *  down over four weeks" is worse than showing that something is missing —
 * and `demo()` makes sure a reader never sees either.
 */
export function t(lang: Lang, key: Key, vars?: Vars): string {
  const phrase = TABLES[lang]?.[key] ?? EN[key];
  if (!vars) return phrase;
  return phrase.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  );
}

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  const keys = Object.keys(EN) as Key[];
  assert(keys.length > 0, 'the dictionary has entries');

  // Neither language may be missing a key, and neither may have one the other
  // does not — a stray key is a phrase nobody will ever see translated.
  const deKeys = Object.keys(DE);
  assert(deKeys.length === keys.length, `de has ${deKeys.length} keys, en has ${keys.length}`);
  for (const k of keys) {
    assert(typeof DE[k] === 'string' && DE[k].length > 0, `de is missing ${k}`);
  }
  for (const k of deKeys) {
    assert(k in EN, `de has a key en does not: ${k}`);
  }

  // The failure a dictionary cannot survive: a translation that drops the
  // number out of the sentence it exists to carry.
  for (const k of keys) {
    const a = placeholders(EN[k]).slice().sort().join(',');
    const b = placeholders(DE[k]).slice().sort().join(',');
    assert(a === b, `placeholders differ for ${k}: en(${a}) de(${b})`);
  }

  assert(t('en', 'today.until', { time: '18:00' }) === 'until 18:00', 'english fills its slot');
  assert(t('de', 'today.until', { time: '18:00' }) === 'bis 18:00', 'german fills the same slot');
  assert(
    t('en', 'today.until') === 'until {time}',
    'a missing value leaves the slot visible rather than blanking the sentence'
  );
  assert(t('de', 'tab.today') === 'Heute', 'a phrase with no slots is returned as it is');

  // Following the device, and overriding it.
  assert(pickLang(null, 'de-DE') === 'de', 'a German device gets German');
  assert(pickLang(null, 'de') === 'de', 'a bare language tag counts too');
  assert(pickLang(null, 'en-GB') === 'en', 'an English device gets English');
  assert(pickLang(null, null) === 'en', 'no locale at all falls back to English');
  assert(pickLang('en', 'de-DE') === 'en', 'a chosen language outranks the device');
  assert(pickLang('de', 'en-US') === 'de', 'in both directions');
  assert(pickLang('fr' as Lang, 'de-DE') === 'de', 'a stored language we dropped falls back to the device');

  return `i18n.ts: all checks passed (${keys.length} phrases × ${LANGS.length} languages)`;
}
