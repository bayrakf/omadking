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

## 1. [x] E2E-Suites ins Repo holen

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

**Erledigt** 2026-08-05 — 65 Checks (27 smoke, 38 interact).

---

## 2. [x] Herkunft des Rezepts festhalten und zeigen

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

**Erledigt** 2026-08-05 — 71 Checks. Dabei ein Fehler im e2e-Runner aus
Durchlauf 1 gefunden und behoben: er servierte ein veraltetes Bundle.

---

## 3. [x] Chatverlauf überlebt das Schließen

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

**Erledigt** 2026-08-05 — 80 Checks. Der Planner-Block wurde dabei
deterministisch gemacht: seit Punkt 2 hing „Kontingent sinkt" davon ab, ob das
Modell gerade antwortet.

---

## 4. [x] Einkaufsliste addiert Mengen statt sie zu verwerfen

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

**Erledigt** 2026-08-05 — 85 Checks.

---

## 5. [x] Planer merkt sich die letzte Session

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

**Erledigt** 2026-08-05 — 91 Checks.

---

## 6. [x] Wochenrückblick auf Progress

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

**Erledigt** 2026-08-05 — 98 Checks.

---

## 7. [x] Markdown im Coach rendern

**Warum:** Der Coach antwortet in Markdown, `src/app/chat.tsx` setzt das in ein einfaches `<Txt>`.
Auf dem Bildschirm steht wörtlich `**sodium, potassium, and magnesium**` und
`* **Sodium:** 3,000–5,000 mg`. Kein Stilproblem — ein fehlender Renderer.

**Was:**
- `src/lib/markdown.ts`, rein, mit `demo()`, in `check-logic.mjs` eingetragen. Parst in Blöcke
  (Absatz, Aufzählung, nummerierte Liste, Überschrift) mit Inline-Auszeichnung für fett, kursiv,
  Code.
- Kein neues Paket. Ein Chatmodell produziert eine kleine Teilmenge, und ein Renderer, der bei
  kaputter Eingabe den Rohtext zeigt, ist besser als eine Abhängigkeit.
- Renderkomponente nutzt `Txt` aus `src/components/ui.tsx`.
- Selbstchecks: verschachtelte Auszeichnung, unbalancierte `**`, sehr lange Zeilen, leere Eingabe.

**Fertig wenn:** keine literalen `**` oder `* ` mehr im Chat, als e2e-Check mit gestubbter
Markdown-Antwort verankert.

**Erledigt** 2026-08-05 — 102 Checks.

---

## 8. [x] Antwortformat des Coaches straffen

**Warum:** Der Prompt fordert 150 Wörter, geliefert werden fünf Absätze. Auch gut gesetzt bleibt das
eine Wand.

**Was:** `BASE_PROMPT` in `supabase/functions/chat/index.ts`: eine Antwortzeile zuerst, dann
höchstens vier Stichpunkte, dann ein „Warum"-Satz. Regeln nicht wiederholen, Wortzahl nicht
erwähnen.

**Fertig wenn:** eine echte Antwort gegen Production passt ohne Scrollen in den sichtbaren Bereich.

**Erledigt** 2026-08-05 — teilweise live bestätigt. Eine echte Antwort mit dem neuen Prompt zeigte
Antwortsatz zuerst, `- `-Bullets, fette Zahlen und die eigenen 82 kg des Nutzers. Die abschließende
`Why:`-Zeile blieb unbestätigt, weil das Gemini-Tageskontingent (20 Anfragen/Tag im Free Tier)
mitten in der Prüfung erschöpft war. Der Prompt ist deployt, die vier Gates sind grün.

---

## 9. [x] Titel und lange Zeilen umbrechen statt abschneiden

**Warum:** „Seared Honey-Sesame Chicken Breast with Jasm…" ist kein Titel, das ist ein Rätsel.

**Was:** Rezepttitel in `RecipeCard` und die „Recent plans"-Zeilen im Planer auf zwei Zeilen
erlauben; Zeilenhöhen in `Type` prüfen.

**Fertig wenn:** kein Rezepttitel im Build endet auf `…`.

**Erledigt** 2026-08-05 — 103 Checks. Als Regressionsprobe verankert: der Planer darf nirgends
ein Auslassungszeichen zeigen.

---

## 10. [x] Zubereitungswörter beim Zusammenfassen ignorieren

**Warum:** Die Mengen-Summierung aus Punkt 4 greift bei echten Daten nicht. Drei Hähnchen-Zeilen
ergeben drei Schlüssel:

```
"boneless skinless chicken breast"
"raw boneless skinless chicken breast diced into cm cubes"
"herb marinated chicken breast or crispy tofu"
```

Im Laden kauft man dreimal dasselbe.

**Was:** `dedupeKey` in `src/lib/grocery.ts` um eine Stoppwortliste erweitern (raw, fresh, diced,
chopped, sliced, minced, cubed, skinless, boneless, marinated, steamed, roasted, organic, ripe,
plain, non-fat, low-fat …) und Alternativen nach „or" abschneiden.

**Die eigentliche Gefahr ist Über-Verschmelzung.** „sweet potato" und „potato" müssen getrennt
bleiben, ebenso „chicken breast" und „chicken thigh". Die Stoppwortliste darf kein unterscheidendes
Wort enthalten, und beide Nicht-Verschmelzungen gehören als Selbstcheck verankert.

**Fertig wenn:** die drei Zeilen oben ergeben eine Position mit korrekter Summe, und die
Nicht-Verschmelzungen sind geprüft.

**Erledigt** 2026-08-05 — 104 Checks. Sieben Nicht-Verschmelzungen als Selbstcheck verankert.

---

## 11. [x] Kurzname groß, Zubereitung klein

**Warum:** „480g raw boneless skinless chicken breast, diced into 2cm cubes" braucht zwei Zeilen für
den Namen allein. Im Laden liest das niemand.

**Was:** `displayName(line)` in `grocery.ts`, rein, mit `demo()`: trennt Menge + Kernzutat vom
Beiwerk. Die Liste zeigt „1,04 kg Hähnchenbrust" prominent, „roh, in 2-cm-Würfeln" klein darunter.

**Fertig wenn:** keine Position braucht mehr zwei Zeilen für den Namen.

**Erledigt** 2026-08-05 — 106 Checks.

---

## 12. [x] Einkaufsliste nach Ladenweg sortieren

**Warum:** Die Kategorien existieren, ihre Reihenfolge folgt aber keinem Weg durch einen Laden.

**Was:** `CATEGORIES` in `grocery.ts` umsortieren: Obst/Gemüse → Protein → Molkerei/Fette →
Kohlenhydrate → Vorrat → Supplemente. Alphabet innerhalb bleibt.

**Fertig wenn:** die Kategorien erscheinen in dieser Reihenfolge.

**Erledigt** 2026-08-05 — 107 Checks.

---

## 13. [x] Protokoll-Typen statt nackter Stundenzahl

**Warum:** Das Onboarding bietet „1h / 2h / 4h" ohne zu sagen, was das ist. OMAD hat benannte
Spielarten, und die Wahl ist eine echte Entscheidung, keine Zahleneingabe.

**Was:** `PROTOCOLS` in `src/lib/nutrition.ts`: `omad-strict` (1h), `warrior` (4h), `18:6` (6h),
`16:8` (8h), je mit Kurzbeschreibung des Unterschieds. Onboarding und Profil bieten die benannte
Auswahl, freie Stundenzahl bleibt möglich. `normalizeProfile` bleibt unverändert — die Stunden
werden dort bereits geprüft.

**Fertig wenn:** jede Auswahl setzt Fenster und Fastenlänge korrekt, Selbstchecks decken jedes
Protokoll und die freie Eingabe ab.

**Erledigt** 2026-08-05 — 110 Checks.

---

## 14. [ ] Fastenphasen am Zifferblatt

**Warum:** Der Zähler sagt „18h 55m" und sonst nichts. Was zu diesem Zeitpunkt im Körper passiert,
ist genau das, wofür jemand eine OMAD-App öffnet.

**Was:** `fastingStage(hoursFasted)` in `nutrition.ts`, rein, mit `demo()`: Bänder für gesättigt,
postabsorptiv, Glykogen zur Neige, Ketose steigend, langes Fasten. Eine Zeile unter dem `DayDial`.

**Leitplanke:** ausdrücklich als Näherung gekennzeichnet — die Übergänge sind fließend und
verschieben sich mit letzter Mahlzeit, Training und Person. Kein Versprechen über Gesundheit.

**Fertig wenn:** jedes Band hat Selbstchecks an seinen Grenzen, und kein Text behauptet eine Wirkung.

---

## 15. [ ] Anpassungsphase aus dem eigenen Log

**Warum:** Die ersten Tage OMAD fühlen sich anders an als die vierte Woche. Die App weiß, wie lange
jemand dabei ist, und sagt nichts dazu.

**Was:** `adaptationStage(fastLog, today)` in `src/lib/review.ts`: Tag 1–3, erste Woche, Woche 2–4,
darüber hinaus — abgeleitet aus tatsächlich geloggten Tagen, nicht aus einem Kalenderdatum. Sagt,
was sich in dieser Phase typischerweise ändert, ohne es zu versprechen.

**Fertig wenn:** Phasen wechseln an den richtigen Zählständen, Lücken im Log setzen nicht zurück,
beides als Selbstcheck.

---

## 16. [ ] Fasten brechen und „Über OMAD"

**Warum:** Die App rechnet den Zeitpunkt der Mahlzeit seit Wochen aus und sagt nie, *wie* man nach
22 Stunden anfängt. Und sie erklärt die Methode nirgends.

**Was:**
- Reihenfolge beim Fastenbrechen auf dem Plan: Protein zuerst, Kohlenhydrate danach, Fett zuletzt,
  langsam, bei angenehmer Sättigung aufhören.
- Referenzfläche „Über OMAD", erreichbar aus dem Profil: Protokollvergleich, wofür der Ansatz
  mechanisch plausibel ist, was er ausdrücklich nicht leistet.

**Leitplanke — gilt wörtlich:**
- Keine erfundenen Zahlen. Keine Studienprozente, Erfolgsquoten, Nutzerzahlen, Testimonials.
- Mechanismus statt Versprechen. „Eine Mahlzeit bedeutet weniger Entscheidungen, was die
  Kalorienkontrolle für manche einfacher macht" ist beschreibbar. „OMAD verbrennt mehr Fett" nicht.
- Gegenanzeigen stehen im sichtbaren Bereich, nicht am Ende: Schwangerschaft und Stillzeit, Diabetes
  unter Medikation, Essstörung in der Vorgeschichte, Blutdruck- oder Blutzuckermedikamente,
  Jugendliche.

**Fertig wenn:** die Fläche enthält keine Zahl ohne Beleg im Text und keine Krankheitsaussage; die
Gegenanzeigen sind ohne Scrollen sichtbar.

---

## 17. [ ] Kontingent-Meldung im Client stimmt nicht

**Warum:** `askCoach` in `src/lib/ai.ts` bildet jeden 429 auf „Too many questions right now — try
again in a minute" ab. Gemini liefert aber zwei verschiedene 429: ein Minutenlimit, das sich in
Sekunden klärt, und das Tageslimit des Free Tier (20 Anfragen), das sich erst am nächsten Tag
klärt. Im zweiten Fall ist „try again in a minute" schlicht unwahr, und der Nutzer versucht es
minutenlang vergeblich.

Beim Testen von Punkt 8 genau so passiert: erst nach 75 Sekunden Pause und einem einzelnen
Versuch war klar, dass es kein Minutenlimit ist.

Die Edge Function liefert `reason` und Googles `detail` bereits mit — der Client verwirft beides.

**Was:**
- `describeQuotaError(reason, detail)` in `src/lib/ai.ts`, rein, mit `demo()`. Googles `detail`
  enthält einen „retry in Xs"-Hinweis; daraus lässt sich Minuten- von Tageslimit ableiten, statt
  es zu raten.
- `askCoach` nutzt die Meldung statt der pauschalen Zeile.
- Dasselbe für den Planer: `generateMealPlan` sagt bei Quota „over its limit right now", ohne zu
  sagen, ob das Minuten oder einen Tag bedeutet.

**Fertig wenn:** ein Tageslimit sagt nicht „in a minute"; Selbstchecks decken beide 429-Arten und
eine unbekannte Form ab.

---

## 18. [ ] Fasten nachtragen und zurücknehmen

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

## 19. [ ] Portionen für echtes Vorkochen

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

## 20. [ ] Fehlerbildschirm, der etwas sagt

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

## 21. [ ] Systemschriftgröße respektieren

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

## 22. [ ] Startseite erreichbar machen und README nachziehen

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

## 23. [ ] Konten und Synchronisierung — Entscheidung nötig, nicht autonom bauen

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
