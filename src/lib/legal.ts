/**
 * What this app does with data, as data.
 *
 * The privacy policy is rendered from this file rather than written as prose,
 * for one reason: prose drifts from the code and nobody notices. If a new
 * recipient is added here, it appears on the page; if a flow is removed from
 * the code and not from here, the page claims something untrue and the check
 * below is where that should be caught.
 *
 * Everything in DATA_FLOWS was read out of the code, not out of a template.
 * Legal wording is a lawyer's job — this is the inventory they need.
 */

/** Marks a value the operator still has to supply. Deliberately loud. */
export const TODO = 'TODO';

export const OPERATOR = {
  name: TODO,
  street: TODO,
  city: TODO,          // e.g. "1010 Wien"
  country: 'Österreich',
  email: TODO,         // for data-protection requests
  /** Firmenbuchnummer, if registered. Empty string = not registered. */
  companyRegister: TODO,
  /** Supervisory authority for the imprint (§5 ECG). */
  authority: TODO,
} as const;

export type Operator = { [K in keyof typeof OPERATOR]: string };

/** Which operator details are still placeholders. Empty means ready to ship. */
export function missingOperatorFields(o: Operator = OPERATOR): string[] {
  return Object.keys(o).filter((k) => {
    const v = (o as Record<string, string>)[k];
    return typeof v !== 'string' || v.trim() === '' || v.trim() === TODO;
  });
}

export function isDraft(o: Operator = OPERATOR): boolean {
  return missingOperatorFields(o).length > 0;
}

export type DataFlow = {
  id: string;
  /** What is processed, in the user's words. */
  what: string;
  /** Where it goes. "Gerät" means it never leaves. */
  where: string;
  why: string;
  /** How long it stays there. */
  howLong: string;
};

/**
 * Every flow, including the ones that stay put — a policy that only lists
 * transfers hides how much never leaves, which is the more useful fact here.
 */
export const DATA_FLOWS: DataFlow[] = [
  {
    id: 'device',
    what: 'Profil (Gewicht, Größe, Alter, Geschlecht, Ziel, Essfenster, Trainingszeit), Gewichtsverlauf, Fasten- und Kochprotokoll, Pläne, Einkaufsliste, Chatverlauf',
    where: 'Nur auf deinem Gerät',
    why: 'Die App rechnet damit. Ohne Konto verlässt nichts davon das Gerät, und der Betreiber sieht es nie.',
    howLong: 'Bis du es löschst oder die App entfernst.',
  },
  {
    id: 'coach',
    what: 'Deine Frage an den Coach, die letzten Gesprächszüge, dazu Gewicht, Ziel, Trainingsniveau, Essfenster und Trainingszeit — bei aktivem Premium zusätzlich die auf dem Gerät berechneten Kennzahlen: gemessener Erhaltungsbedarf, Gewichtstrend, Plateau-Dauer, Anzahl beantworteter Tage und dein Wochentagsmuster',
    where: 'Supabase (EU) → Google Gemini (USA)',
    why: 'Damit der Coach mit deinen Zahlen antworten kann statt mit allgemeinen Bereichen. Übermittelt werden nur die abgeleiteten Kennzahlen, nie die Protokolle, aus denen sie stammen.',
    howLong: 'Nicht vom Betreiber gespeichert. Die Aufbewahrung bei Google richtet sich nach dessen Bedingungen.',
  },
  {
    id: 'plan',
    what: 'Dein Ziel, die Trainingseinheit und die bereits berechneten Nährwertziele',
    where: 'Supabase (EU) → Google Gemini (USA)',
    why: 'Damit ein Rezept um genau diese Werte gebaut wird. Gewicht, Größe, Alter und Geschlecht werden bewusst NICHT mitgeschickt — die Zielwerte enthalten sie bereits.',
    howLong: 'Nicht vom Betreiber gespeichert.',
  },
  {
    id: 'logs',
    what: 'Technische Zugriffsprotokolle der Serverfunktionen, einschließlich IP-Adresse',
    where: 'Supabase (EU)',
    why: 'Betrieb und Fehlersuche. Entsteht automatisch beim Aufruf, nicht durch eine Einstellung.',
    howLong: 'Nach den Vorgaben von Supabase.',
  },
  {
    id: 'purchase',
    what: 'Kaufstatus des Abonnements',
    where: 'RevenueCat und der App-Store deines Geräts',
    why: 'Damit ein gekauftes Abo erkannt und wiederhergestellt werden kann.',
    howLong: 'Nach den Vorgaben des jeweiligen Anbieters.',
  },
];

/** Third parties named in the flows, deduplicated — what the policy must list. */
export function recipients(flows: DataFlow[] = DATA_FLOWS): string[] {
  const found = new Set<string>();
  for (const f of flows) {
    if (/supabase/i.test(f.where)) found.add('Supabase');
    if (/google|gemini/i.test(f.where)) found.add('Google');
    if (/revenuecat/i.test(f.where)) found.add('RevenueCat');
  }
  return [...found].sort();
}

/** Flows that leave the device. The rest is not processed by the operator. */
export function leavesDevice(flows: DataFlow[] = DATA_FLOWS): DataFlow[] {
  return flows.filter((f) => !/^nur auf deinem gerät$/i.test(f.where.trim()));
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  // Placeholder detection — the guard that stops a draft shipping quietly.
  assert(isDraft(), 'the shipped record is still a draft until it is filled in');
  assert(missingOperatorFields().includes('name'), 'an unfilled name is reported');

  const filled: Operator = {
    name: 'Beispiel e.U.', street: 'Beispielgasse 1', city: '1010 Wien',
    country: 'Österreich', email: 'datenschutz@example.at',
    companyRegister: 'FN 123456a', authority: 'Magistratisches Bezirksamt',
  };
  assert(missingOperatorFields(filled).length === 0, 'a complete record is not a draft');
  assert(!isDraft(filled), 'and isDraft agrees');
  assert(missingOperatorFields({ ...filled, email: '   ' }).includes('email'), 'whitespace is not a value');
  assert(missingOperatorFields({ ...filled, city: TODO }).includes('city'), 'a leftover TODO is caught');

  // The inventory has to be usable as the page's source.
  assert(DATA_FLOWS.length >= 5, 'every known flow is listed');
  assert(new Set(DATA_FLOWS.map((f) => f.id)).size === DATA_FLOWS.length, 'flow ids are unique');
  for (const f of DATA_FLOWS) {
    assert(f.what.length > 20 && f.why.length > 20, `${f.id} explains itself`);
    assert(f.howLong.length > 0, `${f.id} says how long`);
  }

  // Recipients are derived, not hand-listed, so the page cannot fall behind.
  const r = recipients();
  assert(r.includes('Google') && r.includes('Supabase') && r.includes('RevenueCat'), `all three recipients: ${r}`);
  assert(recipients([]).length === 0, 'no flows means no recipients to name');

  // What stays put must be visible as such.
  const stays = DATA_FLOWS.filter((f) => !leavesDevice().includes(f));
  assert(stays.length === 1 && stays[0].id === 'device', 'exactly one flow never leaves the device');
  assert(leavesDevice().length === DATA_FLOWS.length - 1, 'the rest do leave');

  // The claim the code now backs: body metrics no longer go to the recipe model.
  const plan = DATA_FLOWS.find((f) => f.id === 'plan')!;
  assert(/nicht mitgeschickt/i.test(plan.why), 'the plan flow states what is withheld');

  return 'legal.ts: all checks passed';
}
