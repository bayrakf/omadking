# OMADCoach — Backlog

Arbeitsliste, von oben nach unten. Ein Punkt pro Durchlauf.

**Status:** `[ ]` offen · `[x]` erledigt · `[BLOCKED]` mit Fehlertext.

## Regeln für jeden Punkt

- Neue Logik mit Verzweigung, Formel oder Parser kommt als **reine Funktion**
  nach `src/lib/`, mit `demo()`-Selbstcheck, eingetragen in
  `scripts/check-logic.mjs`. Bildschirme rechnen nicht selbst.
- Abstände nur über `margin`. `gap` / `rowGap` / `columnGap` brechen RN-Web.
- Native Module nur mit `.web.ts`-Stub daneben.
- Keine erfundenen Nutzerzahlen, Statistiken oder Testimonials.
- Premium wird ausschließlich durch einen verifizierten Kauf gewährt.
- Grün heißt: `npm run typecheck`, `npm run check`,
  `npx expo export --platform web`, `npm run e2e` — alle vier.

---

## 1. [ ] E2E-Suites ins Repo holen

**Warum:** Die Browser-Suites liegen im Session-Scratchpad unter `/private/tmp/`.
Sie sind das einzige, was Regressionen über neun Routen und 38 Interaktionen
findet, und sie überleben die Session nicht. Ohne sie ist Schritt 4 jedes
weiteren Punkts nicht durchführbar.

**Was:**
- `e2e/smoke.mjs` (9 Routen: rendert, keine Konsolenfehler, kein Querscroll) und
  `e2e/interact.mjs` (Onboarding, Dashboard, Planner, Quota, Paywall, Progress)
  aus dem Scratchpad ins Repo, Pfade relativ.
- `e2e/run.mjs`: baut bei Bedarf, startet einen statischen Server auf einem
  freien Port, führt beide Suites aus, räumt auf. Basis-URL über `E2E_URL`
  überschreibbar, damit dieselbe Suite gegen Production läuft.
- `playwright-core` als devDependency. Chrome-Pfad über `CHROME_PATH`
  überschreibbar, Standard macOS-Pfad als Fallback.
- `package.json`: `"e2e": "node e2e/run.mjs"`.

**Fertig wenn:** `npm run e2e` aus einem sauberen Checkout grün ist und
beide Suites zusammen ≥ 45 Checks melden.

---

## 2. [ ] Herkunft des Rezepts festhalten und zeigen

**Warum:** `generateMealPlan` fällt bei Modell-Ausfall still auf
`offlineRecipe()` zurück. Der Nutzer sieht ein generisches Gericht und kann
nicht wissen, ob das die KI war oder der Notnagel — genau die Verwechslung,
die das Debuggen der Gemini-Quota fünf Runden gekostet hat.

**Was:**
- `MealPlan` bekommt `recipe_source: 'ai' | 'offline'`.
- Die Edge Function meldet bereits `source` und `reason`; beides im Client
  auswerten statt zu verwerfen.
- `RecipeCard` zeigt bei `offline` einen ruhigen Hinweis, dass es ein
  Standardrezept ist und ein neuer Versuch ein echtes liefert. Kein Alarm.
- Ein erneuter Versuch nach einem Offline-Fallback darf **kein** Kontingent
  verbrauchen: `consumeQuota()` nur bei `recipe_source === 'ai'`.

**Fertig wenn:** Ein Plan mit Offline-Rezept ist als solcher gekennzeichnet,
das Kontingent bleibt dabei unverändert, und `npm run e2e` prüft beides.

---

## 3. [ ] Chatverlauf überlebt das Schließen

**Warum:** `chat.tsx` startet bei jedem Öffnen bei null. Eine Rückfrage zwei
Stunden später beginnt bei Adam und Eva, und der Verlauf, den `askCoach` als
Kontext mitschickt, ist leer. Der Coach wirkt vergesslich, weil er es ist.

**Was:**
- `KEYS.chatLog` in `src/lib/store.ts`, mit `loadChat` / `saveChat`.
- Auf die letzten 40 Nachrichten begrenzen, damit der Speicher nicht wächst.
- Fehlgeschlagene Nachrichten (`failed`) werden nicht gespeichert — sie sind
  kein Gesprächsinhalt.
- „Verlauf löschen" im Chat-Kopf.

**Fertig wenn:** Nachricht senden, Route wechseln, zurück — der Verlauf steht
noch da. Als E2E-Check verankert.

---

## 4. [ ] Einkaufsliste addiert Mengen statt sie zu verwerfen

**Warum:** `buildGroceryList` erkennt „320g Hähnchenbrust" und „400g
Hähnchenbrust" als dasselbe und behält **die erste**. Wer nach dieser Liste
einkauft, hat für den zweiten Tag zu wenig da. Das ist ein Rechenfehler, kein
Schönheitsfehler.

**Was:**
- In `src/lib/grocery.ts`: Menge und Einheit aus der Zeile parsen
  (`320g`, `2 tbsp`, `1.5 kg`, `250 ml`).
- Gleiche Einheit → addieren und als eine Zeile ausgeben.
  Unterschiedliche oder unlesbare Einheiten → Zeilen einzeln behalten, nichts
  raten.
- g/kg und ml/l vor dem Addieren angleichen, Ausgabe in der größeren Einheit,
  sobald es sich lohnt.
- `demo()` erweitern: Summierung, gemischte Einheiten, mengenlose Zutaten
  („Salz nach Geschmack"), Unsinn wie „nach Bedarf".

**Fertig wenn:** Zwei Pläne mit 320g und 400g desselben Artikels ergeben eine
Zeile mit 720g, und die Selbstchecks decken die Sonderfälle ab.

---

## 5. [ ] Planer merkt sich die letzte Session

**Warum:** Wer fünfmal die Woche dasselbe trainiert, stellt fünfmal dieselben
vier Felder ein. Die App weiß es bereits — sie wirft es nur weg.

**Was:**
- `KEYS.lastSession` in `store.ts`: Sportart, Dauer, Intensität, Startzeit,
  Ruhetag-Schalter.
- Beim Öffnen des Planers vorbelegen, beim Erzeugen eines Plans speichern.
- Ohne gespeicherte Session bleibt das heutige Verhalten (Startzeit aus dem
  Profil).
- Nichts wird automatisch abgeschickt — nur vorbelegt.

**Fertig wenn:** Plan mit „Laufen / 90 min / hart" erzeugen, App neu laden,
Planer öffnen: alles steht noch so da.

---

## 6. [ ] Wochenrückblick auf Progress

**Warum:** Die App sammelt Fastenlog, Kochlog, Gewicht und Pläne, wertet aber
nichts über den Tag hinaus aus. Der einzige Ort, an dem Durchhalten sichtbar
wird, ist eine Streak-Zahl.

**Was:**
- `src/lib/review.ts`, rein, mit `demo()`, eingetragen in `check-logic.mjs`:
  `weeklyReview(fastLog, cookLog, weights, plans, today)` liefert
  Fastentage von sieben, vorgekochte Tage, Gewichtsänderung der Woche,
  Trend aus `weeklyTrend()`, und einen sachlichen Satz dazu.
- Keine Bewertung, kein Lob, keine erfundene Prozentzahl. Nur was gezählt
  wurde, plus die Aussage, was daraus folgt.
- Karte oben auf Progress. Bei weniger als drei Datentagen: klare Ansage, was
  noch fehlt, statt einer leeren Karte.

**Fertig wenn:** Selbstchecks decken volle Woche, Teilwoche, leere Woche und
Wochengrenze ab; Karte rendert in beiden Themes ohne Querscroll.

---

## 7. [ ] Fasten nachtragen und zurücknehmen

**Warum:** `unmarkFastComplete()` existiert seit dem Streak-Feature, hat aber
keine Oberfläche. Ein Fehlklick lässt sich nicht korrigieren, ein vergessener
Tag nicht nachtragen — die Streak wird dadurch unehrlich, und Unehrlichkeit war
genau der Grund, die Fake-Streak damals zu entfernen.

**Was:**
- Erledigten `log_fast`-Eintrag in der Dashboard-Timeline erneut antippbar
  machen, mit Bestätigung.
- Auf Progress eine Sieben-Tage-Reihe, in der einzelne Tage nachgetragen oder
  zurückgenommen werden können.
- Zukünftige Tage sind nicht antippbar.

**Fertig wenn:** Nachtragen und Zurücknehmen ändern die Streak korrekt, auch
über eine Lücke hinweg; als E2E-Check verankert.

---

## 8. [ ] Portionen für echtes Vorkochen

**Warum:** Die Rezepte tragen Aufwärm-Anleitungen und die Karte sagt „einmal
kochen, morgen essen" — die Mengen sind aber für **eine** Portion. Die
Kernschleife der App fordert etwas, das ihre eigenen Zahlen nicht hergeben.

**Was:**
- `scaleIngredients(ingredients, factor)` in `src/lib/grocery.ts`, rein, mit
  `demo()`. Skaliert erkannte Mengen, lässt „nach Geschmack" unangetastet.
- Umschalter 1× / 2× / 3× auf der Rezeptkarte. Makros bleiben die Tagesziele
  für **eine** Portion — das ist der wichtige Teil und darf nicht mitskalieren.
- Die Einkaufsliste nutzt den gewählten Faktor.

**Fertig wenn:** 2× verdoppelt jede erkannte Menge, lässt mengenlose Zeilen in
Ruhe, und die Makro-Anzeige bleibt unverändert.

---

## 9. [ ] Fehlerbildschirm, der etwas sagt

**Warum:** `_layout.tsx` exportiert die `ErrorBoundary` von expo-router. Sie
verhindert den weißen Bildschirm, sieht aber aus wie ein Entwicklerwerkzeug und
bietet keinen Ausweg.

**Was:**
- Eigene Boundary im Design des Rests: was passiert ist, was zu tun ist,
  „Neu laden" und „Zur Startseite".
- Die technische Meldung nur ausklappbar, nicht als Erstes.
- Nichts protokollieren, was Nutzerdaten enthält.

**Fertig wenn:** Ein absichtlich geworfener Fehler zeigt den gestalteten
Bildschirm, und „Neu laden" bringt die App zurück.

---

## 10. [ ] Systemschriftgröße respektieren

**Warum:** Alle Größen in `Type` sind feste Zahlen. Wer die Systemschrift
vergrößert — bei einer App für Küche und Fitnessstudio nicht selten —
bekommt exakt dieselbe kleine Schrift.

**Was:**
- `Txt` und `Eyebrow` an `PixelRatio.getFontScale()` koppeln, gedeckelt
  (etwa 1.3), damit die Zifferblatt-Anzeige nicht bricht.
- `DayDial` und die Timeline bei großer Schrift prüfen: Umbruch statt
  Abschneiden.
- Feste Höhen, die Text enthalten, auf Mindesthöhen umstellen.

**Fertig wenn:** Bei 130 % Systemschrift bleibt jeder Bildschirm lesbar, ohne
Querscroll und ohne abgeschnittene Zeilen.

---

## 11. [ ] Startseite erreichbar machen und README nachziehen

**Warum:** `/landing` ist fertig gestaltet, aber aus der App nicht verlinkt und
für bestehende Nutzer nicht auffindbar. Das README beschreibt außerdem einen
Stand vor Agenda, Erinnerungen, Vorkoch-Schleife und Sicherung.

**Was:**
- Dezenter Verweis auf `/landing` im Profil („Worum es hier geht").
- README: neue `src/lib/`-Module, `npm run e2e`, `GEMINI_MODEL`, der
  `.web.ts`-Split als Regel, aktualisierter Abschnitt „Was fehlt noch".
- Keine Behauptungen über Nutzerzahlen oder Wirksamkeit.

**Fertig wenn:** README beschreibt den Stand, den ein frischer Checkout
vorfindet, und die Startseite ist aus der App erreichbar.

---

## 12. [ ] Konten und Synchronisierung — Entscheidung nötig, nicht autonom bauen

**Warum:** Größte offene Lücke. Alles liegt auf dem Gerät; Deinstallieren
löscht Monate. Das Schema in `supabase/migrations/001_initial_schema.sql`
inklusive Row-Level-Security liegt seit dem ersten Tag bereit — es fehlt die
Client-Seite. Ohne Konten ist außerdem das Kontingent nur gerätelokal und die
serverseitige Prüfung wirkungslos.

**Warum nicht im Loop:** Betrifft Anmeldung, Datenhoheit, Migration
vorhandener lokaler Daten und die Kontingent-Durchsetzung gleichzeitig. Das ist
eine Produktentscheidung, keine Aufgabe, die zwischen zwei Commits fällt.

**Vorzulegen, wenn wieder jemand mitliest:**
- Magic-Link oder Passwort?
- Bleibt die App ohne Konto voll nutzbar (lokal zuerst, Konto optional)?
- Was passiert beim ersten Login mit den vorhandenen Gerätedaten — hochladen,
  zusammenführen, verwerfen?

**Fertig wenn:** Die drei Fragen beantwortet sind. Erst danach entsteht ein
eigener Plan.
