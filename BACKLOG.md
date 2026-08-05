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

## 14. [x] Fastenphasen am Zifferblatt

**Warum:** Der Zähler sagt „18h 55m" und sonst nichts. Was zu diesem Zeitpunkt im Körper passiert,
ist genau das, wofür jemand eine OMAD-App öffnet.

**Was:** `fastingStage(hoursFasted)` in `nutrition.ts`, rein, mit `demo()`: Bänder für gesättigt,
postabsorptiv, Glykogen zur Neige, Ketose steigend, langes Fasten. Eine Zeile unter dem `DayDial`.

**Leitplanke:** ausdrücklich als Näherung gekennzeichnet — die Übergänge sind fließend und
verschieben sich mit letzter Mahlzeit, Training und Person. Kein Versprechen über Gesundheit.

**Fertig wenn:** jedes Band hat Selbstchecks an seinen Grenzen, und kein Text behauptet eine Wirkung.

**Erledigt** 2026-08-05 — 113 Checks. Die Wortwahl-Regel ist als Selbstcheck verankert.

---

## 15. [x] Anpassungsphase aus dem eigenen Log

**Warum:** Die ersten Tage OMAD fühlen sich anders an als die vierte Woche. Die App weiß, wie lange
jemand dabei ist, und sagt nichts dazu.

**Was:** `adaptationStage(fastLog, today)` in `src/lib/review.ts`: Tag 1–3, erste Woche, Woche 2–4,
darüber hinaus — abgeleitet aus tatsächlich geloggten Tagen, nicht aus einem Kalenderdatum. Sagt,
was sich in dieser Phase typischerweise ändert, ohne es zu versprechen.

**Fertig wenn:** Phasen wechseln an den richtigen Zählständen, Lücken im Log setzen nicht zurück,
beides als Selbstcheck.

**Erledigt** 2026-08-05 — 116 Checks.

---

## 16. [x] Fasten brechen und „Über OMAD"

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

**Erledigt** 2026-08-05 — 132 Checks. Die Reihenfolge (Warnung vor Nutzen) ist als Check verankert.

---

## 17. [x] Kontingent-Meldung im Client stimmt nicht

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

**Erledigt** 2026-08-05 — 134 Checks.

---

## 18. [x] Fasten nachtragen und zurücknehmen

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


**Erledigt** 2026-08-05 — 138 Checks. Dabei zwei Funde: RN-Web übersetzte
`accessibilityState` nicht nach `aria-checked`, und die e2e-Suite hatte kein Selektor-Zeitlimit.
---

## 19. [x] Portionen für echtes Vorkochen

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

**Erledigt** 2026-08-05 — 141 Checks.

---

## 20. [x] Fehlerbildschirm, der etwas sagt

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

**Erledigt** 2026-08-05 — einmalig gegen eine temporäre Absturzroute geprüft (Bildschirm erscheint,
Detail erst auf Klick), Route danach entfernt und ihr Verschwinden aus dem Bundle geprüft.
**Kein dauerhafter e2e-Check:** einen echten Absturz zu erzwingen hieße, eine Route auszuliefern,
deren einziger Zweck das Abstürzen ist. Die Smoke-Suite deckt weiterhin ab, dass keine echte Route
weiß bleibt.

---

## 21. [x] Systemschriftgröße respektieren

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

**Erledigt** 2026-08-05 — 141 Checks. **Wichtige Einschränkung:** react-native-web fixiert
`fontScale` auf `1`, die Skalierung greift also **nur nativ**. Die e2e-Suite kann sie nicht prüfen;
die Rechnung liegt deshalb als achtes Modul in `src/lib/typography.ts` mit eigenen Selbstchecks.

---

## 22. [x] Startseite erreichbar machen und README nachziehen

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

**Erledigt** 2026-08-05 — 144 Checks.

---

## 23. [x] Konten und Synchronisierung — Entscheidung getroffen

**Entschieden am 2026-08-05:** anonymes Konto, Ende-zu-Ende verschlüsselter Sync, E-Mail höchstens
später und freiwillig. Die App bleibt ohne Konto vollständig nutzbar. Der Server hält eine UUID und
ein Chiffrat, zu dem der Betreiber keinen Schlüssel hat.

Die drei offenen Fragen sind damit beantwortet:
- **Magic-Link oder Passwort?** Weder noch. Anonyme Anmeldung, Wiederherstellungssatz statt Konto.
- **Ohne Konto nutzbar?** Ja, unverändert. Sync ist ein Schalter, kein Tor.
- **Was passiert mit lokalen Daten?** Zusammenführen, im Client, nach festen Regeln (Punkt 26).

Aufgeteilt in die Punkte 24–30. Voller Plan samt rechtlicher Einordnung:
`~/.claude/plans/cuddly-dancing-ladybug.md`.

---

## 24. [x] Impressum und Datenschutzerklärung

**Warum:** Beides fehlt im gesamten Code. In Österreich ist ein Impressum für eine kommerzielle App
Pflicht (§5 ECG, §25 MedienG), eine Datenschutzerklärung ohnehin. Das gilt **heute schon**, ohne
Konten — die App schickt bereits Gewicht, Ziel und freien Chattext an Google Gemini.

**Was:**
- Zwei Routen im Muster von `src/app/about.tsx`, verlinkt aus Profil und Landing.
- Inhalt aus dem, was der Code tatsächlich tut: Empfänger (Supabase als Auftragsverarbeiter,
  Google Gemini als Drittland), Zweck und Rechtsgrundlage je Datenfluss, Löschung, Auskunft,
  Beschwerderecht bei der österreichischen Datenschutzbehörde.
- Sichtbar als **anwaltlich zu prüfender Entwurf** gekennzeichnet.
- Keine Behauptung über Vertragsverhältnisse, die noch nicht geschlossen sind.

**Fertig wenn:** Beide Flächen sind aus der App erreichbar, nennen jeden realen Datenfluss, und ein
e2e-Check hält fest, dass sie nichts behaupten, was der Code nicht tut.

**Erledigt** 2026-08-05 — 160 Checks. Inhalt kommt aus `src/lib/legal.ts`, damit die Seite nicht
hinter dem Code zurückfallen kann. Platzhalter sind sichtbar als Entwurf markiert; die noch
fehlenden Angaben stehen unten.

---

## 25. [x] „Meine Daten" — sehen, mitnehmen, löschen

**Warum:** Auskunft und Löschung sind Rechte, keine Freundlichkeiten. Export existiert bereits als
`saveBackup` in `src/lib/backup-file.ts`, ist aber nirgends als Datenschutzfunktion sichtbar.

**Was:** Eine Fläche, die auflistet, was auf dem Gerät liegt; Export; und ein Löschen, das wirklich
löscht — inklusive Bestätigung, weil es nicht umkehrbar ist. Braucht keinen Server.

**Fertig wenn:** Löschen leert jeden Schlüssel aus `KEYS`, und ein e2e-Check weist nach, dass die
App danach im Onboarding startet.

**Erledigt** 2026-08-05 — `eraseEverything()` zählt `KEYS` auf, statt eine Liste zu pflegen.

---

## 26. [x] Krypto-Kern und Zusammenführung (rein, geprüft)

**Warum:** Der ganze Plan steht und fällt damit, dass der Server nichts lesen kann. Und weil er
nichts lesen kann, muss das Zusammenführen im Client passieren.

**Was:**
- `src/lib/crypto.ts`: XChaCha20-Poly1305 aus `@noble/ciphers`. **Bewusst reines JavaScript** — ein
  natives Kryptomodul bräuchte einen `.web.ts`-Split. `seal` / `open` / `generateKey` /
  Wiederherstellungssatz mit Prüfsumme. `open` gibt bei falschem Schlüssel `null` zurück statt zu
  werfen.
- `src/lib/sync-merge.ts`: Logs vereinigen, Skalare nach Zeitstempel. **`premium` kommt nie aus dem
  Sync** — sonst wäre der Paywall über eine präparierte Datei aushebelbar.

**Fertig wenn:** Selbstchecks decken ab: Rundlauf, falscher Schlüssel, gekipptes Bit im Chiffrat,
Nonce wiederholt sich nicht, Merge ist idempotent und für Logs kommutativ, `premium` bleibt unberührt.

**Erledigt** 2026-08-05 — zehn Module in `npm run check`. Zwei echte Fehler fanden die Checks:
der Wiederherstellungssatz war mit 52 Zeichen zu kurz für 44 % aller Schlüssel, und die
handgeschriebene Prüfsumme war wegen `31 ≡ 1 (mod 30)` positionsblind. Beide vor jeder Zeile UI
gefunden.

**Nebenbefund, heute schon aktiv:** `importBackup` schrieb `user_premium` zurück — eine
handgeänderte Backup-Datei schaltete Premium frei, an RevenueCat vorbei. Genau das Loch, das
`purchases.ts` schließen sollte. `NEVER_RESTORED` deckt jetzt Datei und Sync ab.

---

## 27. [x] Schlüsselablage und anonymes Konto

**Was:** `src/lib/keystore.ts` + `.web.ts` (nativ `expo-secure-store`, Web `localStorage` mit
ehrlichem Hinweis, dass Browserdaten-Löschen den Schlüssel mitnimmt). Anonyme Anmeldung über
`supabase.auth.signInAnonymously()`.

**Voraussetzung außerhalb des Codes:** Im Supabase-Dashboard „Allow anonymous sign-ins" aktivieren
**und die Projektregion auf EU (Frankfurt) prüfen** — bei einer US-Region entstünde eine
Drittlandsübermittlung ohne Not.

**Fertig wenn:** Anmeldung überlebt einen Neustart, Abmelden entfernt den Schlüssel nicht
versehentlich, Bundle-Probe zeigt 0 Treffer für `expo-secure-store` im Web-Bundle.

**Erledigt** 2026-08-05. Der `.web.ts`-Split hält (0 Treffer für `expo-secure-store` im Web-Bundle).

**Der Blocker war nicht die Einstellung.** Nach dem Aktivieren meldete `/auth/v1/settings` zwar
`anonymous_users: true`, die Anmeldung schlug aber weiter fehl — mit leerer Fehlermeldung im SDK.
Roh gegen die API:

```
POST /auth/v1/signup → 500
{"error_code":"unexpected_failure","msg":"Database error creating anonymous user"}
```

Ursache: der Trigger `on_auth_user_created` aus Migration 001 legte bei jedem neuen Nutzer eine
Klartext-Zeile in `profiles` und `subscriptions` an und scheiterte dabei. Er hätte **jede**
Kontoerstellung verhindert, nicht nur die anonyme. Migration `002` entfernt ihn — was ohnehin nötig
war, weil er genau die Klartext-Tabellen befüllte, die dieser Umbau abschafft.

Der angemeldete Nutzer hält bestätigt: `id, aud, role, last_sign_in_at, created_at, updated_at,
is_anonymous`. Keine E-Mail, keine Telefonnummer.

---

## 28. [x] Wiederherstellungssatz

**Warum:** Er ist zugleich Wiederherstellung und Gerätekopplung. Und er ist die einzige Kopie —
ohne ihn sind die Daten bei Geräteverlust endgültig weg.

**Was:** Einmal anzeigen, Bestätigung abfragen, danach nie wieder. Der Satz über den endgültigen
Verlust gehört in den sichtbaren Bereich, nicht ins Kleingedruckte.

**Fertig wenn:** Ein falscher Satz auf dem zweiten Gerät ergibt eine verständliche Meldung und
löscht nichts.

**Erledigt** 2026-08-05 — 169 Checks. Die Prüfung nutzt ein festes Schlüssel/Satz-Paar, testet also
die echte Kodierung statt dessen, was die App zufällig erzeugt hat.

**Eine Abweichung vom Plan:** Der Plan sagte „einmal anzeigen, danach nie wieder". Der Satz lässt
sich stattdessen erneut aufdecken — hinter einem bewussten Tippen. Wegsperren schützt gegen jemanden
mit dem entsperrten Telefon; der weit wahrscheinlichere Fall ist aber der verlorene Zettel, und eine
App, die dann „du hattest deine Chance" sagt, macht aus einem kleinen Fehler endgültigen
Datenverlust.

---

## 29. [x] Sync

**Was:**
- `supabase/migrations/002_sync_state.sql`: eine Tabelle aus `user_id`, `ciphertext`, `nonce`,
  `revision`, `updated_at`. Row-Level-Security, vier Policies, alle `user_id = auth.uid()`.
  Dieselbe Migration entfernt die ungenutzten Klartext-Tabellen aus `001` — **vorher bestätigen,
  dass sie leer sind**, ein `drop table` ist nicht umkehrbar.
- `src/lib/sync.ts`: ziehen, öffnen, zusammenführen, versiegeln, schreiben. `revision` gegen
  verlorene Schreibvorgänge.
- Profil: Sync an/aus, zuletzt abgeglichen, zweites Gerät koppeln, Konto löschen (muss `auth.users`
  treffen, nicht nur die Zeile).

**Fertig wenn:** Ein e2e-Check fängt die ausgehende Anfrage ab und weist nach, dass **weder Gewicht
noch Rezepttitel im Rumpf vorkommen**. Das ist die Prüfung, die die ganze Behauptung trägt.

**Erledigt** 2026-08-05 — 178 Checks. Der Check läuft gegen einen gestubbten Server und prüft, was
der Client tatsächlich auf die Leitung legt: kein `81.7`, kein `weight_kg`, kein `muscle_gain`, kein
Datum, kein Schlüsselname — stattdessen Base64-Chiffrat und Nonce.

**Migration 004 entfernt die sechs Klartext-Tabellen.** Da ihr Inhalt von außen nicht prüfbar war
(RLS verbirgt ihn), verweigert die Migration den Dienst mit einer Fehlermeldung, sobald auch nur
eine Zeile existiert. Sie lief ohne Abbruch durch — das ist der Beleg, dass alle leer waren.
Danach geprüft: alle sechs melden 404, `sync_state` antwortet.

**Nicht gelöst, bewusst:** Kontolöschung entfernt bisher nur die Zeile in `sync_state`, nicht den
`auth.users`-Eintrag. Dafür braucht es die Admin-API in einer Edge Function — steht als Punkt 31.

---

## 30. [x] README und Kontingent ehrlich nachziehen

**Was:** Der Abschnitt „Not built yet" beschreibt Konten als fehlend. Nach 24–29 stimmt das nicht
mehr — und die neue Wahrheit gehört genauso hin: **serverseitige Quota wird durch anonyme Konten nur
etwas besser, nicht gelöst.** Ein anonymes Konto ist kostenlos neu erstellbar; Supabase begrenzt nur
pro IP. Das als gelöst zu verkaufen wäre falsch.

**Fertig wenn:** README beschreibt, was der Server hält und was nicht, und benennt die Grenze der
Quota-Durchsetzung.

**Erledigt** 2026-08-05.


---

## Offen bei dir, nicht im Code

Diese Angaben fehlen in `src/lib/legal.ts`. Solange sie fehlen, zeigt die App auf beiden
Rechtsflächen einen sichtbaren Entwurfshinweis — sie können nicht versehentlich live gehen.

| Feld | Was gebraucht wird |
|---|---|
| `name` | Name oder Firma des Verantwortlichen |
| `street`, `city` | Anschrift in Wien |
| `email` | Adresse für Datenschutzanfragen |
| `companyRegister` | Firmenbuchnummer, falls eingetragen |
| `authority` | Zuständige Aufsichtsbehörde (§5 ECG) |

Ebenfalls außerhalb des Codes: Abrechnung im Google-Projekt aktivieren (Punkt A1 des Plans) und
danach die tatsächlichen Bedingungen des Gemini-Bezahl-Tiers prüfen, bevor sie in der
Datenschutzerklärung behauptet werden.


---

## 31. [x] Konto wirklich löschen

**Warum:** „Serverkopie löschen" entfernt die Zeile in `sync_state`. Der anonyme `auth.users`-Eintrag
bleibt — eine UUID mit Zeitstempeln, sonst nichts, aber eine Löschung nach Art. 17 sollte ihn
mitnehmen. Aus dem Client geht das nicht: das Löschen eines Nutzers braucht die Admin-API und damit
den Service-Role-Key, der niemals ins Bundle darf.

**Was:** Eine Edge Function `delete_account`, die den Aufrufer aus seinem eigenen JWT ermittelt und
ausschließlich diesen einen Nutzer löscht. Kein Parameter, der eine fremde ID annimmt.

**Fertig wenn:** Nach dem Löschen liefert eine Anmeldung mit derselben Session einen Fehler, und die
Datenschutzerklärung beschreibt, was genau verschwindet.

**Erledigt** 2026-08-05 — 178 Checks. Gegen das echte Projekt geprüft, inklusive Angriff:

| Versuch | Ergebnis |
|---|---|
| Ohne Token | 401 |
| Gefälschtes Token | 401 |
| Fremde `user_id` im Rumpf mitgeschickt | 200 — **das eigene** Konto gelöscht, das Opfer existiert weiter |
| Eigenes Token | gelöscht; danach „User from sub claim in JWT does not exist" |

Die Function nimmt keinen Parameter. Ein Endpunkt, der eine ID annimmt, löscht früher oder später
fremde Konten.


---

## 32. [x] Die App misst den Stoffwechsel, statt ihn zu schätzen

**Warum:** `dailyTargets` rechnete `BMR × NEAT + Training − 500` und blieb dabei. Mifflin-St Jeor
liegt bei Einzelpersonen regelmäßig ±20 % daneben. Wer real 2.200 kcal verbraucht, bekommt 2.110
verordnet, nimmt acht Wochen nichts ab und gibt sich selbst die Schuld. Und die App fragte nie, ob
überhaupt gegessen wurde — es gab kein einziges Zufuhrfeld.

**Was gebaut wurde:**
- **Drei Taps statt Ernährungstagebuch.** Nach Fensterschluss eine Frage auf dem Dashboard: Plan
  gegessen / weniger / mehr / komplett anders. Die Faktoren stehen offen dabei.
- **`src/lib/energy.ts`**, rein, geprüft: `measuredMaintenance` rechnet die Energiebilanz
  (Erhaltung ≈ Zufuhr − Trend × 1100) und **verweigert die Antwort**, solange die Datenlage sie
  nicht trägt — mit der Angabe, was noch fehlt.
- **`readTrend`** unterscheidet Rauschen von Signal. Der Satz „heute 0,8 kg über der Linie, die
  Linie fällt weiter" ist das, was eine Waage nicht kann.
- **`dailyTargets` bekam einen optionalen dritten Parameter.** Fehlt er, ändert sich nichts — zehn
  Bildschirme rufen die Funktion auf.
- **`effectiveMaintenance`** hält die Premium-Regel an genau einer Stelle.

**Die Sperren sind die Substanz, nicht die Formel:** ≥8 Zufuhrtage, ≥4 Wiegungen über ≥10 Tage,
Korrektur höchstens ±15 % pro Schritt, nie unter BMR.

**Premium-Grenze, ehrlich:** Die Karte zeigt allen, *dass* gemessen wurde und woraus. Was
gemessen wurde, kostet. Kein künstliches Limit auf etwas, das vorher kostenlos war.

**Erledigt** 2026-08-05 — 187 Checks, zwölf geprüfte Module. E2E belegt beide Seiten der Grenze und
dass dünne Daten eine Nachfrage erzeugen statt einer Zahl.

**Nebenher aufgeräumt:** Das Profil war auf zehn Karten angewachsen — ich hatte Feature um Feature
angehängt. Jetzt getrennt in „Du" und „App", der Wiederherstellungssatz sitzt beim Sync statt bei
den Rechtstexten. Und auf Progress führt jetzt die Messung statt „nichts geloggt".


---

## 33. [x] Das Plateau aussprechen und die Abendfrage retten

**Zwei Lücken aus Punkt 32, beide echt.**

**Die Abendfrage verlor Tage.** Sie erschien nur, solange `hoursFasted < 6` — also sechs Stunden
nach Fensterschluss. Wer am nächsten Morgen in die App schaute, wurde nie gefragt und der Tag fiel
aus der Messung. `intakeQuestionFor` benennt jetzt den **Tag** statt den Moment: das Fenster, das
zuletzt geöffnet hat, ist bis zum nächsten Fensterschluss beantwortbar.

Das Datum kommt aus dem Zurückdrehen der Uhr um „Minuten seit Fensteröffnung" — eine Größe, die
`fastingState` bereits mitternachtsfest rechnet. Kein eigenes Datumsrechnen, keine Sonderfälle.
Als Selbstcheck verankert: gefragt direkt danach, spät nachts, am nächsten Morgen und bis kurz vor
dem nächsten Fenster; nicht mehr nach der Antwort; und ein Fenster ab 23:00 gehört zum Tag, an dem
es öffnete.

**Das Plateau war erkannt, aber stumm.** `readTrend` lieferte `steady`, ohne dass jemand es erfuhr.
`readPlateau` sagt es jetzt als Rechnung statt als Urteil: „Das Gewicht hält seit 16 Tagen bei rund
2.100 kcal. Das ist, was Erhaltung jetzt kostet — die Zahl hat sich bewegt, nicht deine Disziplin.
1.600 setzt das Defizit zurück."

Genau das ist der Moment, in dem Menschen aufhören, und der Grund ist fast immer, dass sie eine
flache Linie als Versagen lesen. Sie ist keins.

**Premium-Grenze wie zuvor:** der Stillstand wird allen genannt, die neue Zahl kostet.

**Erledigt** 2026-08-05 — 192 Checks.


---

## 34. [x] Der Native-Durchlauf — was davon hier möglich war

**Nicht möglich:** Auf dieser Maschine steht kein Xcode (nur Command Line Tools) und kein
Android-SDK. `xcrun simctl` liefert nichts. Ein echter Gerätelauf braucht dich: `npx expo start`,
App öffnen, die vier nativen Pfade durchgehen (Keychain, Erinnerungen, Käufe, Datei-Export).

**Möglich und erledigt: das größte Risiko beseitigt statt geprüft.**

`sync.ts` nutzte `globalThis.btoa` / `atob`. Weder React Native noch Expo definieren sie — nichts in
beiden Paketbäumen. TypeScript akzeptierte es trotzdem, weil die DOM-Bibliothek an ist, und die
e2e-Suite läuft in Chrome. **Es kam also durch jedes Gate und wäre auf dem Telefon sofort
gebrochen** — genau die Klasse Fehler, die ein Web-Only-Test nicht finden kann.

Statt zu prüfen, ob das Global existiert, ist die Abhängigkeit weg: eigenes Base64 in `crypto.ts`,
zwölf Zeilen, mit Selbstchecks über jede Länge modulo 3 und gegen die Referenzkodierung.

**Und aus dem Einzelfund eine stehende Regel:** `npm run check` scannt jetzt `src/lib/` (ohne
`.web.ts`) auf browser-eigene Globals und schlägt fehl. Ein Bildschirm darf auf `Platform.OS`
verzweigen; ein Lib-Modul hat nicht zu wissen, was ein Browser ist. Die Sperre wurde durch
absichtliche Sabotage verifiziert — sie fängt ein eingeschmuggeltes `btoa(` sofort.

**Restrisiko, unverändert:** Keychain, Benachrichtigungen, Käufe und Datei-Export sind weiterhin nur
über ihre Web-Zwillinge getestet. Das kann nur ein Gerätelauf klären.

**Erledigt** 2026-08-05 — 192 Checks.


---

## 35. [x] Vier Premium-Funktionen, die aus den eigenen Daten kommen

**1. Die Prognose, die sich biegt.** Jede App teilt Distanz durch aktuelle Rate und ist damit
systematisch zu optimistisch: ein leichterer Körper kostet weniger, das Defizit schrumpft von
selbst. `forecast()` iteriert wochenweise mit fallender Erhaltung — die Rate kommt aus der
BMR-Formel der App selbst, nicht aus einer Konstante. Als Selbstcheck festgenagelt, dass das
Ergebnis **später** liegt als die naive Division.

Und der Satz, den sonst niemand sagt: bei zu kleinem Defizit nennt sie das Gewicht, bei dem es
stehen bleibt — „für 70 kg musst du später weniger essen, nicht länger".

**2. Die Diätpause.** `deficitSpell()` zählt die Wochen ununterbrochenen Verlusts. Nach acht
Wochen wird eine Woche auf Erhaltung vorgeschlagen, mit der Zahl. Als Entscheidung formuliert,
nicht als Vorwurf: „Planen ist der Unterschied dazu, dass es aus Versehen passiert."

**3. Das Fenster, das zum Training passt.** `suggestWindow()` erkennt die Überschneidung und nennt
eine konkrete neue Startzeit. Die App warnte davor seit dem Timing-Modul — und hat den Fix nie
vorgeschlagen.

**4. Der Wochenentscheid.** `weeklyDecision()` priorisiert alles zu **einer** Sache: Plateau →
Diätpause → Fenster → fehlende Daten → weitermachen. Mehrere wahre Aussagen gleichzeitig sind
Rauschen, und Rauschen wird nicht mehr gelesen.

**Zwei Fehler, die die Prüfungen fanden:**

- Ich reichte `DEFAULT_PROFILE.default_training_time` an `loadLastSession` durch statt der
  Trainingszeit **des Nutzers** — der Fenstervorschlag kam aus der falschen Zeit.
- Schlimmer: die Bezahlschranke saß im Bildschirm und hätte den Fenstervorschlag mitkassiert —
  eine Uhrzeit-Rechnung, die vorher kostenlos war. Jetzt entscheidet `weeklyDecision` selbst per
  `premiumOnly`, was gemessen ist und was nicht, und die Regel steht als Selbstcheck.

**Erledigt** 2026-08-06 — 201 Checks.
