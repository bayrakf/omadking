# Nachtlauf — Protokoll

Ein Eintrag pro Durchlauf: Punkt, Ergebnis, Commit oder Blocker.

| # | Punkt | Ergebnis | Commit |
|---|---|---|---|
| 1 | E2E-Suites ins Repo holen | grün — 65 Checks | `be0ce03` |
| 2 | Herkunft des Rezepts zeigen | grün — 71 Checks | `b20d45a` |
| 3 | Chatverlauf überlebt das Schließen | grün — 80 Checks | `aa5a995` |
| 4 | Einkaufsliste addiert Mengen | grün — 85 Checks | `433ef1f` |
| 5 | Planer merkt sich die Session | grün — 91 Checks | `2aa3044` |
| 6 | Wochenrückblick auf Progress | grün — 98 Checks | `9251136` |
| 7 | Markdown im Coach rendern | grün — 102 Checks | `2d8ca7c` |
| 8 | Antwortformat des Coaches | grün, live nur teilweise | `8a5242c` |
| 9 | Titel umbrechen statt abschneiden | grün — 103 Checks | `7ed45c3` |
| — | Punkt 17 aufgenommen (Quota-Meldung) | Backlog | `93a1d0c` |
| 10 | Zubereitungswörter ignorieren | grün — 104 Checks | `07290c5` |
| 11 | Kurzname groß, Zubereitung klein | grün — 106 Checks | `d67760d` |
| 12 | Einkaufsliste nach Ladenweg | grün — 107 Checks | `c3489be` |
| 13 | Protokoll-Typen | grün — 110 Checks | `bae2f8a` |
| 14 | Fastenphasen am Zifferblatt | grün — 113 Checks | `3a1e75d` |
| 15 | Anpassungsphase aus dem Log | grün — 116 Checks | `86c3822` |
| 16 | Fastenbrechen + „Über OMAD" | grün — 132 Checks | `1178b10` |
| 17 | Kontingent-Meldung korrigiert | grün — 134 Checks | `d311f6c` |
| 18 | Fasten nachtragen/zurücknehmen | grün — 138 Checks | `c052f7d` |
| 19 | Portionen fürs Vorkochen | grün — 141 Checks | `eb88164` |
| 20 | Fehlerbildschirm | grün, einmalig geprüft | `5f6906f` |
| 21 | Systemschriftgröße | grün — nur nativ wirksam | `5870e38` |
| 22 | Startseite + README | grün — 144 Checks | `8e84284` |

---

## Durchlauf 1 — E2E-Suites ins Repo holen

**Ausgangslage:** `git status` sauber bei `4161ae2`.

**Umgesetzt:**
- `e2e/harness.mjs` — gemeinsame Fixtures, Chrome-Suche über `CHROME_PATH` mit
  Fallback-Liste für macOS und Linux, Reporter, frischer Browser-Kontext pro
  Prüfung.
- `e2e/smoke.mjs` — 9 Routen × 3 Prüfungen (rendert, passt in den Viewport,
  keine Konsolenfehler) = 27 Checks.
- `e2e/interact.mjs` — 38 Checks über Onboarding, Dashboard, Planer,
  Kontingent, Paywall und Progress.
- `e2e/run.mjs` — baut bei Bedarf, serviert `dist/`, führt beide Suites aus,
  räumt auf.
- `playwright-core` als devDependency, `npm run e2e` in `package.json`.

**Zwei Abweichungen von der Scratchpad-Vorlage:**

1. **Kein `serve`-Paket.** Der Runner bringt ~40 Zeilen `node:http` mit, die
   `cleanUrls` nachbilden — `/planner` löst auf `planner.html` auf, wie bei
   Vercel. Alles aus `index.html` zu servieren hätte kaputtes Routing verdeckt,
   also genau den Fehler, den die Suite finden soll. Spart zusätzlich eine
   Abhängigkeit.
2. **`E2E_URL` überschreibbar.** Dieselbe Suite läuft damit gegen Production
   (`E2E_URL=https://omadking.vercel.app npm run e2e`), ohne zweite Kopie.

**Verifikation:** `npm run typecheck` grün · `npm run check` grün (4 Module) ·
`npx expo export --platform web` grün · `npm run e2e` grün, 65 Checks ·
Bundle-Probe: expo-notifications 0, expo-file-system 0, expo-sharing 0,
expo-document-picker 0, react-native-purchases 0.

**Zwischenfall:** Erster Commit-Versuch wurde blockiert. Ich hatte
`git commit --amend` + `git push --force-with-lease` benutzt, um die
Commit-SHA ins Protokoll nachzutragen — Force-Push steht auf der Verbotsliste.
Richtig ist, was der Ablauf ohnehin vorsieht: Schritt 5 committet das Thema,
Schritt 6 trägt das Protokoll separat nach. Ab jetzt zwei Commits pro
Durchlauf, kein Amend.


---

## Durchlauf 2 — Herkunft des Rezepts festhalten und zeigen

**Ausgangslage:** `git status` sauber bei `92db7e7`.

**Umgesetzt:**
- `MealPlan` trägt `recipe_source` (`'ai' | 'offline'`) und `recipe_note`.
- `describeRecipeFallback()` in `src/lib/ai.ts`, rein, mit `demo()`, in
  `check-logic.mjs` eingetragen. Jede Meldung sagt dasselbe Doppelte: es ist
  die Standardplatte, und die Zahlen stimmen trotzdem — sie werden auf dem
  Gerät gerechnet, ein Modellausfall macht den *Plan* nie falsch.
- `RecipeCard` zeigt den Hinweis ruhig, nicht als Alarm.
- `consumeQuota()` läuft nur noch bei `recipe_source === 'ai'`. Vorher kostete
  ein Ausfall den Nutzer einen von drei Wochenplänen.

**Fund: der e2e-Runner aus Durchlauf 1 war fehlerhaft.** Er baute nur, wenn
`dist/` ganz fehlte, und servierte sonst ein veraltetes Bundle. Der erste Lauf
dieses Punkts war deshalb rot mit *korrektem* Code — der Test prüfte den alten
Build. Ein veraltetes Bundle ist schlimmer als gar keins, weil es rote
Änderungen grün aussehen lässt. Der Runner baut jetzt neu, sobald irgendeine
Quell- oder Konfigurationsdatei jünger als der Export ist.

**Neuer e2e-Block:** Die Anfrage an `generate_meal_plan` wird per
`context.route(...).abort()` gekappt. Damit ist der Fallback-Pfad deterministisch
geprüft, statt davon abzuhängen, ob das Modell während des Laufs gerade steht.

**Nebenbei:** `scripts/check-logic.mjs` kompiliert jetzt mit `--types node`,
weil `ai.ts` `process.env` auf Modulebene liest.

**Verifikation:** `npm run typecheck` grün · `npm run check` grün (5 Module) ·
`npx expo export --platform web` grün · `npm run e2e` grün, 71 Checks ·
Bundle-Probe: alle fünf nativen Module 0 Treffer.


---

## Durchlauf 3 — Chatverlauf überlebt das Schließen

**Ausgangslage:** `git status` sauber bei `5428154`.

**Umgesetzt:**
- `conversationOf()` in `src/lib/ai.ts`, rein, mit `demo()`. Die Regel „kein
  Greeting, keine fehlgeschlagene Nachricht" stand bereits inline in
  `chat.tsx`, um den Kontext für den Coach zu bauen. Jetzt entscheidet dieselbe
  Funktion auch, was gespeichert wird — der sichtbare Verlauf und der Kontext
  des Modells können damit nicht auseinanderlaufen.
- `KEYS.chatLog` mit `loadChat` / `saveChat` / `clearChat` in `store.ts`,
  gedeckelt auf 40 Nachrichten.
- Wiederherstellen beim Öffnen, Speichern nach jeder Änderung, „Clear" im Kopf.

**Zwei Korrekturen während des Durchlaufs:**

1. **Der Planner-Check war seit Durchlauf 2 flaky.** Weil ein Fallback-Rezept
   bewusst kein Kontingent mehr verbraucht, hing die Zusicherung „Kontingent
   sinkt" plötzlich davon ab, ob Gemini während des Laufs antwortet — hier tat
   es das nicht, und der Test war rot bei korrektem Code. Der Endpunkt wird
   jetzt mit einem gültigen Rezept gestubbt. Nebeneffekt: die Wartezeit fiel
   von 45s auf 6s.
2. **`clearChat` hinterließ `[]`.** Der Persist-Effekt feuerte direkt nach dem
   Leeren und schrieb eine leere Liste zurück. `saveChat` löscht den Schlüssel
   jetzt, wenn nichts übrig bleibt.

**Verifikation:** `npm run typecheck` grün · `npm run check` grün (5 Module) ·
`npx expo export --platform web` grün · `npm run e2e` grün, 80 Checks ·
Bundle-Probe: alle fünf nativen Module 0 Treffer.


---

## Durchlauf 4 — Einkaufsliste addiert Mengen statt sie zu verwerfen

**Ausgangslage:** `git status` sauber bei `d9fe19d`.

**Umgesetzt:**
- `parseAmount()` und `formatAmount()` in `src/lib/grocery.ts`, rein, mit
  Selbstchecks. Mengen werden gelesen, kompatible Einheiten angeglichen
  (kg→g, l→ml) und summiert.
- Gruppierung nach Zutat **und** Einheit. Ticks schlüsseln jetzt auf beides,
  mit Rückfall auf den alten Schlüssel — sonst wäre eine Liste, mit der gerade
  jemand einkauft, durch das Update stillschweigend leer geklickt worden.

**Zwei Regeln, die wichtiger sind als das Summieren selbst:**

1. **Eine nackte Zahl zählt, sie misst nicht.** „2 eggs" sind zwei Eier —
   `eggs` bleibt Teil der Zutat und wird nicht zu einer Einheit namens „eggs".
2. **Nur kompatible Einheiten werden zusammengefasst.** „2 tbsp olive oil" und
   „30ml olive oil" bleiben zwei Zeilen. Eine geratene Umrechnung setzt eine
   selbstbewusst falsche Zahl auf einen Einkaufszettel; zwei Zeilen sind das
   kleinere Übel.

Zeilen ganz ohne Menge („Sea salt, to taste") bleiben wörtlich stehen und
erscheinen einmal.

**Die alte Zusicherung prüfte den Fehler.** `demo()` behauptete bisher
`all.some(n => n.includes('320g'))` — also dass die *erste* Menge überlebt.
Genau das war der Bug. Ersetzt durch `startsWith('720g')`.

**Verifikation:** `npm run typecheck` grün · `npm run check` grün (5 Module) ·
`npx expo export --platform web` grün · `npm run e2e` grün, 85 Checks ·
Bundle-Probe: alle fünf nativen Module 0 Treffer.


---

## Durchlauf 5 — Planer merkt sich die letzte Session

**Ausgangslage:** `git status` sauber bei `5b88e0c`.

**Umgesetzt:**
- `normalizeSession()` in `src/lib/nutrition.ts`, direkt neben
  `normalizeProfile` und aus demselben Grund: der Wert kommt aus dem
  Gerätespeicher zurück und wird beim Lesen geprüft, nicht geglaubt.
- `SPORT_IDS` wird aus der MET-Tabelle abgeleitet. Damit ist die Whitelist für
  eine wiederhergestellte Session dieselbe Liste, die der Kalorienschätzer
  kennt — beide können nicht auseinanderlaufen. Eine unbekannte Sportart wäre
  sonst auf einen generischen MET-Wert gefallen und hätte die Schätzung still
  verändert.
- `KEYS.lastSession` mit `loadLastSession` / `saveLastSession`.

**Eine Entscheidung:** Gespeichert wird erst, wenn ein Plan tatsächlich gebaut
wurde. Bei jedem Tippen zu speichern hieße, dass bloßes Durchklicken der
Optionen die Session überschreibt, die gestern funktioniert hat. Es ist
Vorbelegung, nichts wird selbstständig abgeschickt — beides ist als Check
verankert.

**Verifikation:** `npm run typecheck` grün · `npm run check` grün (5 Module) ·
`npx expo export --platform web` grün · `npm run e2e` grün, 91 Checks ·
Bundle-Probe: alle fünf nativen Module 0 Treffer.


---

## Durchlauf 6 — Wochenrückblick auf Progress

**Ausgangslage:** Durchlauf 6 war unterbrochen worden — `src/lib/review.ts` geschrieben und grün,
aber nicht committet, `git status` unsauber. Zuerst aufgeräumt, dann fertiggestellt.

**Umgesetzt:**
- `weeklyReview()` in `src/lib/review.ts`, rein, mit `demo()`, in `check-logic.mjs` eingetragen.
- Karte ganz oben auf Progress — die einzige Ansicht, die über heute hinausgeht.

**Zwei Regeln für die Formulierung:**

1. **Nur Gezähltes.** Keine Adhärenz-Quote, kein Prozentwert, den niemand gemessen hat.
   „4 of 7 fasts logged" ist eine Tatsache, eine Erfüllungsrate wäre erfunden.
2. **Eine Folgerung, arithmetisch statt motivierend.** −0,4 kg/Woche sind −1,6 kg in vier Wochen.
   Das folgt. „Weiter so" folgt nicht, und die App hat sich keine Meinung verdient.

Unter drei geloggten Tagen sagt die Karte, was fehlt, statt eine leere Hülle zu zeigen.

**Verifikation:** alle vier grün · 98 Checks · Bundle-Probe: fünf native Module, 0 Treffer.

---

## Backlog neu geordnet — zehn neue Punkte aus den Screenshots

Nach Durchsicht des laufenden Builds durch den Nutzer wurden zehn Punkte ergänzt und **vor** die
bisherigen 7–11 gestellt (die auf 17–21 rutschen). Der Loop nimmt den obersten offenen Punkt, die
Dateireihenfolge ist also die Priorität.

**Zwei Befunde, die im Code nachgeprüft wurden, nicht nur vermutet:**

1. **Der Coach ist unlesbar**, weil `chat.tsx` Markdown in ein einfaches `<Txt>` setzt. Auf dem
   Bildschirm steht wörtlich `**sodium**`. → Punkte 7–8.
2. **Die Mengen-Summierung aus Durchlauf 4 greift bei echten Daten gar nicht.** Nachgerechnet mit
   dem echten `dedupeKey` ergeben drei Hähnchen-Zeilen drei verschiedene Schlüssel, weil
   Zubereitungswörter („raw", „diced into 2cm cubes", „herb-marinated") sie zerlegen. Die Liste
   hatte deshalb 24 Positionen. → Punkte 10–11.

Bei Punkt 10 ist die eigentliche Gefahr **Über**-Verschmelzung: „sweet potato" darf nicht mit
„potato" zusammenfallen. Beide Nicht-Verschmelzungen sind als Abnahmekriterium festgehalten,
sonst wird ein sichtbarer Fehler gegen einen unsichtbaren getauscht.

**Inhaltliche Leitplanke für die OMAD-Punkte 14–16** (vom Nutzer bestätigt: praktisch *und*
evidenzbasiert mit Einschränkungen): keine erfundenen Zahlen, Mechanismus statt Versprechen,
Näherungen als solche gekennzeichnet, Gegenanzeigen im sichtbaren Bereich statt im Kleingedruckten.


---

## Durchlauf 7 — Markdown im Coach rendern

**Ausgangslage:** `git status` sauber bei `3c15cc2`.

**Umgesetzt:**
- `src/lib/markdown.ts`, rein, mit `demo()`, als sechstes Modul in `check-logic.mjs`.
- `Markdown`-Komponente in `src/components/ui.tsx`, nutzt `Txt` und die bestehenden Tokens.
- Nur Coach-Antworten werden geparst. Was der Nutzer tippt, bleibt wörtlich stehen — seine
  Sternchen gehören ihm.

**Warum kein Paket:** Ein Chatmodell produziert eine schmale Teilmenge. Ein Parser, den man in einer
Sitzung durchlesen kann, ist hier mehr wert als vollständiges CommonMark — besonders gegen ein
Bundle von 1,3 MB.

**Die Eigenschaft, auf die es ankommt:** Nichts geht durch den Renderer verloren. Unbalanciertes
`**`, ein einzelnes Sternchen in „2 * 3 = 6" und Auszeichnung innerhalb von Backticks überleben
wörtlich. Blöcke sind gedeckelt, damit eine pathologische Antwort das Rendern nicht aufhängt.

**Zwei Funde aus dem Screenshot nach dem Bau:**
1. Das Bullet-Zeichen rendert in dieser Schrift als winziges Quadrat — der Renderer zeichnet jetzt
   seinen eigenen Punkt, passend zu den Zutatenpunkten der Rezeptkarte.
2. Der Kopf brach auf zwei Zeilen um. Jetzt einzeilig.

**Ein Test musste korrigiert werden:** Die Prüfung hing am Bullet-*Zeichen*. Nachdem der Renderer
einen gezeichneten Punkt nutzt, prüft sie stattdessen die Struktur — dass die Antwort in getrennten
Blöcken ankommt statt als ein Fließtext.

**Verifikation:** alle vier grün · 102 Checks · Bundle-Probe: fünf native Module, 0 Treffer.


---

## Durchlauf 8 — Antwortformat des Coaches straffen

**Umgesetzt:** `BASE_PROMPT` gibt jetzt eine feste Form vor — ein Antwortsatz mit der Zahl darin,
höchstens vier Bullets, eine abschließende `Why:`-Zeile. Dazu der Hinweis, dass Markdown gerendert
wird (fett gehört auf die Zahlen) und dass Überschriften und Tabellen wegbleiben; die Chatblase hat
dafür keinen Platz.

Die medizinische Ausnahme überschreibt die Form ausdrücklich: bei Schwangerschaft, Diabetes,
Medikation oder unklaren Symptomen soll das Modell schlicht auf ärztliche Abklärung verweisen,
statt das in Stichpunkte zu pressen.

**Nur teilweise live bestätigt — und das ist der eigentliche Fund dieses Durchlaufs.**

Mitten in der Prüfung kamen nur noch leere Antworten. Die Diagnose aus Durchlauf „Gemini" zahlte
sich aus: eine Anfrage genügte für die Ursache.

```
generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash
```

Zuerst als Minutenlimit gelesen. Nach 75 Sekunden Pause und **einem** Versuch war es weiterhin
erschöpft — es ist also ein **Tageslimit von 20 Anfragen**. Mein eigener Testlauf hatte es
verbraucht.

Ein Fehler von mir dabei: die erste Warteschleife rief die API alle 20 s erneut auf. Jeder Versuch
setzt das Fenster neu — zu eifriges Wiederholen gegen ein Rate Limit macht es schlimmer, nicht
besser.

Die eine Antwort, die vor dem Limit durchkam, zeigte die gewünschte Form: Antwortsatz zuerst,
`- `-Bullets, fette Zahlen, die eigenen 82 kg des Nutzers. Die abschließende `Why:`-Zeile war
abgeschnitten und bleibt unbestätigt. So im Backlog vermerkt, statt als erledigt behauptet.

---

## Durchlauf 9 — Titel umbrechen statt abschneiden

**Umgesetzt:** Die „Recent plans"-Zeilen im Planer dürfen zwei Zeilen nutzen; die Rezeptkarten-
Überschrift bekam etwas mehr Zeilenabstand, weil sie bei 20 px mit enger Laufweite nach dem Umbruch
gedrängt wirkte.

**Der Check prüft die Abwesenheit eines Auslassungszeichens im ganzen Planer**, nicht das
Vorhandensein eines bestimmten Titels — so überlebt er Textänderungen. Der Stub-Titel im Test ist
jetzt lang genug, dass die alte Einzeilen-Regel ihn gekappt hätte.

**Verifikation beider Punkte:** alle vier Gates grün · 103 Checks · Bundle-Probe: fünf native
Module, 0 Treffer.


---

## Durchlauf 10 — Zubereitungswörter beim Zusammenfassen ignorieren

**Umgesetzt:** `dedupeKey` schneidet am ersten Komma, an „ or " und an einer Klammer — was danach
kommt, ist Zubereitung oder Alternative, nicht Identität — und entfernt anschließend Wörter, die
beschreiben, *wie* etwas zubereitet wurde.

**Das eigentliche Risiko ist das umgekehrte.** Über-Verschmelzung setzt eine selbstbewusst falsche
Einzelzeile dorthin, wo zwei richtig waren, und eine fehlende Position fällt im Laden schwerer auf
als eine doppelte. Die Stoppwortliste enthält deshalb nur Wörter, die niemals zwei getrennt zu
kaufende Dinge unterscheiden können — keine Zutatennamen, keine Sorten, kein „sweet", kein „greek".
Sieben Paare, die getrennt bleiben müssen, sind als Selbstcheck verankert: sweet potato / potato,
chicken breast / thigh, olive / coconut oil, greek yogurt / yogurt, brown / white rice,
egg whites / eggs, salmon / cod.

**„Herb-Marinated" brauchte eine Regel statt eines Worts.** „herb" in die Liste zu setzen wäre
falsch — Kräuter sind eine echte Zutat. Aber ein Bindestrich-Kompositum, das um ein
Zubereitungswort herum gebaut ist, benennt nie ein anderes Produkt, also fällt das ganze Token weg.
`fresh herbs` schlüsselt weiterhin auf `herbs`.

**Zwischenschritt:** Punkt 17 aufgenommen (`93a1d0c`) — die Client-Meldung bei 429 behauptet „try
again in a minute", auch wenn das Tageskontingent erschöpft ist. Aufgefallen beim Prüfen von
Punkt 8.

**Verifikation:** alle vier Gates grün · 104 Checks · Bundle-Probe: fünf native Module, 0 Treffer.


---

## Durchläufe 11 und 12 — Einkaufsliste fertig aufgeräumt

**Punkt 11:** `splitDisplay()` trennt, was man kauft, von dem, wie es zubereitet wird. Originale
Groß-/Kleinschreibung und Wortstellung bleiben — das ist Anzeigetext, kein Schlüssel.

**Ein echter Fehler beim Verdrahten:** Die *erste* gesehene Zeile bestimmte die Formulierung der
Gruppe, und die erste ist meist die kargste. „320g chicken breast" mit „400g raw chicken breast,
diced into 2cm cubes" zu verschmelzen summierte also korrekt und warf die Zubereitung weg. Jetzt
gewinnt die informativere Zeile das Detail.

**Punkt 12:** Kategorien in Ladenweg-Reihenfolge. `categorise()` liefert einen Index in dasselbe
Array, Umsortieren ändert also nur die Ausgabe. Trotzdem abgesichert — eine indexbasierte Zuordnung
ist genau die Sorte, die still bricht, wenn das Array sich bewegt.

**Ein Test war falsch, nicht der Code:** Der Fixture-Datensatz enthielt kein Gemüse, also fehlte die
Kategorie „Vegetables & fruit" auf dem Bildschirm, und der erste Check verglich gegen etwas, das gar
nicht da war. Broccoli ergänzt, statt den Check aufzuweichen.

**Ergebnis am echten Datensatz:** 10 Positionen statt 24. Hähnchen zu einer Zeile zusammengefasst
(800 g) mit „raw boneless skinless, diced into 2cm cubes" leise darunter, „sweet potato" und
„potato" getrennt.

**Verifikation:** alle vier Gates grün · 107 Checks · Bundle-Probe: fünf native Module, 0 Treffer.


---

## Durchläufe 13 und 14 — OMAD kommt inhaltlich an

**Punkt 13:** `PROTOCOLS` benennt die Spielarten — Strict OMAD, OMAD, Warrior 20:4, 18:6, 16:8 —
je mit einer Zeile dazu, was sie kosten und bringen.

Das ist eine **Namensschicht, keine neue Rechnung.** `windowHours` treibt weiterhin alles, eine
handgetippte Fensterlänge funktioniert unverändert und trägt schlicht keinen Namen.
`protocolForHours` liefert `null` statt auf den nächstgelegenen zu runden — jemandes
3-Stunden-Fenster still als etwas anderes zu etikettieren wäre gelogen.

Für jedes Protokoll ist geprüft, dass das Profil es akzeptiert **und** dass es die Fastenlänge
ergibt, die sein Name behauptet. Label und Rechnung können damit nicht auseinanderlaufen.

**Punkt 14:** `fastingStage()` bändert das Fasten — fed, post-absorptive, glycogen falling, ketones
rising, deep. Grenzen beidseitig geprüft, damit kein Fasten durch eine Lücke fällt; Unsinn klemmt
statt zu werfen.

**Die Wortwahl-Regel steht als Selbstcheck, nicht als Vorsatz.** Jede Notiz wird darauf geprüft,
dass sie kein cure/prevent/detox/proven enthält, keine Krankheitsbegriffe, keinen Prozentwert und
keinen Verweis auf „studies". Die e2e-Suite wiederholt dieselbe Prüfung gegen das gerenderte
Dashboard — die Regel zählt dort, wo jemand liest, nicht nur dort, wo sie geschrieben steht.

Im UI steht sichtbar „Approximate". Die Übergänge sind fließend und verschieben sich mit letzter
Mahlzeit, Training und Person; sie als Schalter darzustellen wäre die eigentliche Unwahrheit.

**Verifikation beider Punkte:** alle vier Gates grün · 113 Checks · Bundle-Probe: fünf native
Module, 0 Treffer.


---

## Durchläufe 15 und 16 — Anpassungsphase und die Inhaltsfläche

**Punkt 15:** `adaptationStage()` zählt aus **tatsächlich geloggten Tagen**, nicht ab einem
Startdatum. Wer vier Tage loggt, vierzehn Tage aussetzt und zurückkommt, ist bei Tag fünf — eine
kalenderbasierte Variante hätte ihn grundlos an den Anfang zurückgesetzt, was zugleich falsch und
entmutigend wäre. Direkt abgesichert.

**Punkt 16, Teil 1:** Die Reihenfolge beim Fastenbrechen steht jetzt auf dem Plan. Protein zuerst,
Kohlenhydrate früh wenn nüchtern trainiert wurde, Fett später, langsam, bei angenehmer Sättigung
aufhören.

**Punkt 16, Teil 2 — die Fläche, an der diese App am leichtesten überziehen könnte.**

Die Regeln stehen als Checks, nicht als Vorsatz:

- **Gegenanzeigen stehen an zweiter Stelle der Seite, nicht am Ende.** Sie unter die Vorteile zu
  schieben ist die Art, wie eine Ernährungs-App Schaden anrichtet. Die e2e-Suite prüft die
  Reihenfolge über die Zeichenposition: Warnung@280, Nutzen@1107.
- Keine erfundenen Zahlen, keine Studienprozente, keine Erfolgsquoten, keine Testimonials.
- Der Abschnitt „was es nicht tut" ist so lang wie der Nutzen-Abschnitt und sagt ausdrücklich, dass
  OMAD derselben Nahrung über drei Mahlzeiten **nicht** stoffwechselseitig überlegen ist — wo es
  wirkt, ist die ehrliche Erklärung Adhärenz.

**Ein Check musste präzisiert werden, nicht die Seite.** `/treat/` traf „treatment" im eigenen
Disclaimer der Seite („not a diagnosis or treatment for anything") — also genau das Gegenteil einer
Behauptung. Jetzt wortgrenzenbasierte Verben, damit eine echte Behauptung weiterhin auffliegt.

**Verifikation beider Punkte:** alle vier Gates grün · 132 Checks · Bundle-Probe: fünf native
Module, 0 Treffer.

---

## Zwischenstand

**16 von 23 Punkten erledigt.** Die e2e-Suite ist von 65 auf 132 Checks gewachsen — jeder Punkt
hinterlässt seine eigene Regressionsprobe.

Offen: 17 (Quota-Meldung), 18 (Fasten nachtragen), 19 (Portionen), 20 (Fehlerbildschirm),
21 (Schriftgröße), 22 (Startseite + README), 23 (Konten — Entscheidung, nicht autonom).


---

## Durchläufe 17 und 18

**Punkt 17 — die Meldung sagt jetzt die Wahrheit.** `askCoach` verwarf den Antwortkörper komplett
und machte aus jedem 429 „try again in a minute". Gemini hat mindestens zwei Rate Limits, und sie
sind nicht dasselbe.

**Der „retry in Xs"-Hinweis taugt nicht zur Unterscheidung** — beim Tageslimit meldete er hier unter
einer Minute. Das steht als eigener Selbstcheck, weil genau das die Falle ist. Der Metrikname in
Googles `detail` unterscheidet sie; eine unbekannte Form macht gar keine Zeitaussage, statt zu raten.

**Punkt 18 — der Streak lässt sich korrigieren.** `unmarkFastComplete` existierte seit dem
Streak-Feature, ohne dass irgendetwas es aufrief. Ein Fehltipp war nicht rücknehmbar, ein vergessener
Tag nicht nachtragbar. Ein unwahrer Streak ist schlechter als keiner — genau deshalb war der
erfundene entfernt worden.

**Zwei Funde, die nicht das Feature waren:**

1. **RN-Web übersetzt `accessibilityState` in dieser Version nicht nach `aria-checked`.** Jede
   Checkbox der App — die Einkaufsliste eingeschlossen — sah für einen Screenreader gleich aus,
   egal ob angehakt oder nicht. `Tap` setzt das Attribut jetzt direkt.
2. **Die e2e-Suite hatte kein Selektor-Zeitlimit.** Ein Selektor, der nichts trifft, wartete ewig und
   hing die ganze Suite zehn Minuten auf, statt zu scheitern. Ein falscher Test soll laut sein, nicht
   langsam. Jetzt 15 s.

Beide fand ich nur, weil der eigene Test hängen blieb — nicht durch Nachdenken über Barrierefreiheit.

**Verifikation:** alle vier Gates grün · 138 Checks · Bundle-Probe: fünf native Module, 0 Treffer.


---

## Durchläufe 19 bis 22 — die letzten autonomen Punkte

**19 — Portionen.** Die Karte sagte „einmal kochen, morgen essen", die Mengen waren für eine Portion.
**Die Makros skalieren ausdrücklich nicht mit** — sie sind die Tagesziele für eine Portion, und sie zu
verdoppeln würde aus einer richtigen Zahl eine falsche machen. Der e2e-Check hält fest, dass sie
stehen bleiben während die Zutaten sich verdoppeln, weil genau das später aus Versehen „repariert"
werden könnte. Die Einkaufsliste kauft für die gewählte Menge; das Rezept zu skalieren und die Liste
nicht wäre schlimmer als gar nichts.

**20 — Fehlerbildschirm.** Eigene Boundary im Design des Rests. Die technische Meldung bleibt (ohne
sie ist ein Fehlerbericht unmöglich), steht aber hinter einem Aufklapper und wird nirgendwohin
gesendet.

**Bewusst kein dauerhafter e2e-Check.** Einen echten Absturz zu erzwingen hieße, eine Route
auszuliefern, deren einziger Zweck das Abstürzen ist — und die Parser wurden gerade deshalb gehärtet,
damit kein gespeicherter Wert einen auslösen kann. Einmalig gegen eine temporäre Absturzroute
geprüft, Route entfernt, ihr Verschwinden aus dem Bundle nachgewiesen.

**21 — Systemschriftgröße.** Der Deckel ist die Substanz, nicht die Skalierung: über etwa 1,3 passen
Zifferblatt und Makro-Zeile nicht mehr, und ein brechendes Layout ist schlechter als eines, das
weniger wächst als gewünscht. Zeilenhöhe wächst mit, sonst kollidiert große Schrift mit sich selbst.

**Wichtige Einschränkung, die ich beim Prüfen fand:** react-native-web fixiert `fontScale` auf `1`.
Die Verbesserung wirkt **nur nativ**, im Browser ist sie ein No-op — die e2e-Suite kann sie also gar
nicht prüfen. Deshalb liegt die Rechnung als achtes Modul in `src/lib/typography.ts` mit eigenen
Selbstchecks, und die Einschränkung steht in der Datei und im Backlog, statt entdeckt zu werden.

**Eine Korrektur unterwegs:** Mein erster Check behauptete, ein `Infinity`-Skalenwert würde bei 1,3
gedeckelt. Tut er nicht — ein nicht-endlicher Wert ist keine Schriftpräferenz und fällt auf „keine
Änderung" zurück. Der Check war falsch, nicht der Deckel.

**22 — Startseite und README.** `/landing` war fertig gestaltet und nur per URL erreichbar. Das
README beschrieb einen Checkout von vor Agenda, Erinnerungen, Vorkoch-Schleife, Sicherung,
Protokollen, Portionen und e2e-Suite.

---

## Abschluss

**22 von 23 Punkten erledigt.** Punkt 23 (Konten und Synchronisierung) bleibt offen und war von
Anfang an als Produktentscheidung markiert, nicht als Loop-Aufgabe.

Die e2e-Suite ist von 65 auf **144 Checks** gewachsen, `npm run check` von drei auf **acht Module**.
Jeder Punkt hinterließ seine eigene Regressionsprobe — einschließlich der Wortwahl-Regeln, die gegen
das gerenderte UI laufen, nicht nur gegen den Quelltext.

**Was diese Durchläufe fanden, ohne danach zu suchen:**
- Die Mengen-Summierung der Einkaufsliste griff bei echten Daten nie (Durchlauf 10).
- RN-Web meldete keinen Checkbox-Zustand an Screenreader (Durchlauf 18).
- Die e2e-Suite hatte kein Selektor-Zeitlimit und hing zehn Minuten statt zu scheitern (Durchlauf 18).
- Googles „retry in Xs" taugt nicht zur Unterscheidung von Minuten- und Tageslimit (Durchlauf 17).
- RN-Web fixiert `fontScale` auf 1 (Durchlauf 21).

Alle fünf kamen aus dem Prüfen, nicht aus dem Planen.


---

## Nachtrag 2026-08-06 — Bestandsanalyse

Eine Übernahme, die nicht mit Bauen anfing, sondern mit Nachmessen: alle vier Gates laufen lassen,
bevor irgendeine Behauptung über den Stand geglaubt wurde. Alle grün. Danach drei Befunde, von denen
nur einer als Aufgabe im Backlog stand.

**Der Fund, nach dem niemand gesucht hat.** Die Bezahlschranke bewarb *session-aware macros*,
*reheat instructions* und *unlimited coaching*. Alle drei sind gratis — die ersten beiden rechnet
bzw. rendert die App bedingungslos, und der Coach hat weder im Client noch in der Edge Function ein
Limit. Es wurde gegen eine Grenze geworben, die es nicht gibt. Gleichzeitig standen die zwei Dinge
hinter `isPremium()` gar nicht auf der Seite. Kein Test konnte das fangen, weil die Liste als Prosa
im Bildschirm lag: Prosa driftet vom Code, und niemand merkt es. Jetzt `offer.ts`, jede Behauptung
an ihr Gate gebunden, mit den drei alten Zeilen als Gegenbeispiel im Selbstcheck — damit der Check
bewiesen scheitern *kann* und nicht nur besteht.

**Der Fund, der eine Karte löschte statt eine zu bauen.** Progress sollte entzerrt werden. Beim
Lesen stellte sich heraus, dass die Plateau-Karte gar nicht erreichbar war: `weeklyDecision` stellt
ein Plateau über alles, also sagte die Entscheidungskarte darüber es immer schon. Niemand hat je
beide gesehen. Das ist kein Layoutproblem, das ist toter Code mit Zustand, State und Aufrufen. Weg
damit, und das eine Detail, das ihr voraus war, in den Satz der Entscheidung.

**Was die Selbstchecks diesmal fanden, wieder bevor es UI gab:**
- Ich behauptete drei Treffer für drei falsche Paywall-Zeilen — es waren fünf, weil „meal-prep
  instructions" auch „reheat" enthält. Die Zählung war falsch, nicht der Befund.
- Ich schrieb für das Zielgewicht das alte `normNumber`-Verhalten fest, das bei unlesbarer Eingabe
  Körpergewicht eingesetzt hätte. Genau das erfundene Ziel, das die Änderung verhindern soll.
- `78,5` wurde beim Parsen zu `78`. Ein deutschsprachiger Nutzer hätte ein halbes Kilo verloren und
  es nie gemeldet.
- Das neue Profilfeld hätte die Gerätesynchronisierung stillschweigend nicht überlebt, wäre es
  `normalizeProfile` unbekannt geblieben — jetzt als Merge-Check festgenagelt.

**Stand:** e2e von 201 auf **215 Checks**, `npm run check` von zwölf auf **13 Module**.

Die Lehre aus diesen drei Punkten ist dieselbe wie aus den ersten 35: Was nicht in einem reinen
Modul mit Selbstcheck liegt, driftet. Die Bezahlschranke war der teuerste Beleg dafür — eine
Behauptung über Geld, die achtundzwanzig Commits lang niemandem auffiel.

---

## Punkt 37 — Ordnung vor Umfang

Zwei Dinge, die ich falsch angenommen hatte, gehören ins Protokoll:

- Ich hielt die fehlende Plateau-Karte für eine Regression und wollte sie zurückbauen. Sie war
  bewusst entfernt worden, und der e2e-Kommentar sagte es wörtlich: die Karte konnte nie
  erscheinen, weil `weeklyDecision` den Stillstand über alles andere stellt. Die Anweisung oben
  sagte es längst.
- Zwei Dashboard-Checks wurden rot, ohne dass sich Code geändert hatte. Es war 18:04 und das
  Essfenster offen. Ein fest auf 18:00 gesetztes Fenster hieß, dass diese Checks zwei Stunden am
  Tag rot waren — ein Test, der zweimal täglich über den Code lügt. `closedWindowProfile()` legt
  das Fenster jetzt relativ zur Uhr, nicht absolut.

Der Umbau selbst hat die e2e-Suite ehrlicher gemacht: Karten hinter Segmenten zwingen jeden Check,
zu sagen, in welchem Segment die Karte lebt (`bodyIn`). Vorher prüfte er, was der Standardtab
zufällig enthielt.

**Stand:** e2e **245 Checks**, alle Gates grün, Bundle-Probe fünfmal 0.

---

## Punkt 38 — die Bestandsaufnahme drehte die Reihenfolge um

Die Frage war „welche neuen Features". Die Antwort war: erst mal die erreichbar machen, die es
schon gibt.

- Ich habe letzte Runde selbst einen der vier Kaufknöpfe eingebaut, an `progressCards` vorbei —
  einem Modul, das ausdrücklich existiert, um genau das zu verhindern. Eine Regel, die nur an zwei
  von fünf Stellen durchgesetzt wird, ist keine Regel.
- `intakeWeek` habe ich in Punkt 37 committet und den Commit-Text zu großzügig formuliert: nur die
  Heute-Korrektur war live, der Sieben-Tage-Streifen nie gebaut. Steht jetzt.
- `syncEntitlement` war seit dem Kaufmodul da und wurde nie gerufen. Das ist der einzige Fund in
  dieser Runde, bei dem Geld in die falsche Richtung floss.
- `gatesUsed()` las die Claims und nannte sich damit eine Prüfung. Es prüfte, dass das Angebot mit
  sich selbst übereinstimmt. Der neue Guard liest die Bildschirme.

**Stand:** e2e **253 Checks**, `npm run check` mit einem vierzehnten Modul-Guard.

---

## Punkt 39 — zwei Wochenbegriffe, die sich widersprachen

Der Fehler, der eine Karte unsichtbar machte, war ein Denkfehler über Zeit, nicht über Code:
`intakeWeek` läuft sieben Tage **rückwärts**, die Wochenplanung läuft von Montag **vorwärts**. Ich
habe den Streifen nach künftigen Tagen gefiltert und keine gefunden — es gibt dort per Definition
keine. `daysAheadThisWeek` leitet sie jetzt aus dem Kalender ab, und ein Selbstcheck hält fest,
dass jeder angebotene Tag auch einer ist, den `planAhead` annimmt. Dass zwei Funktionen dasselbe
Wort für zwei verschiedene Zeiträume benutzen, war der eigentliche Fund.

`weekBudget.daysLeft` hatte dieselbe Sorte Fehler in kleiner: es zählt offene Tage, nicht
verbleibende. Für die Anzeige war das nie falsch aufgefallen. Für eine Umverteilung schon.

**Stand:** e2e **261 Checks**.

---

## Punkt 40 — die Prüfung, die sich selbst prüft

Bei dieser Funktion ist nicht die Rechnung das Risiko, sondern der Satz. Eine Zählung über vier
Wochen als „das funktioniert bei dir" auszugeben, wäre genau die Sorte Behauptung, die diese App
nirgends sonst macht.

Deshalb steht die Verbotsliste im Modul und nicht im Bildschirm — und daneben ein Selbstcheck, der
einen erfundenen kausalen Satz durch dieselbe Prüfung schickt und erwartet, dass sie anschlägt. Eine
Prüfung, die nur bestätigt, dass sie nichts findet, kann auch kaputt sein und dasselbe sagen.

**Stand:** e2e **269 Checks**.

---

## Punkt 41 — eine Prüfung, die eine Konstante bestanden hätte

Mein erster Selbstcheck für den Arztbericht sammelte die erwarteten Ziffern in einer Whitelist und
prüfte, dass keine anderen auftauchen. Das hätte auch dann bestanden, wenn `healthSummary` einen
fest verdrahteten Text zurückgegeben hätte — die Zahlen wären ja alle „erwartet" gewesen.

Ersetzt durch das Gegenteil: jede Eingabe verschieben und verlangen, dass das Dokument sich
mitbewegt, samt der Prüfung, dass die alte Zahl **verschwindet**. Das ist der Unterschied zwischen
„die Ausgabe sieht plausibel aus" und „die Ausgabe hängt an der Eingabe".

**Stand:** e2e **278 Checks**, `npm run check` über vierzehn Module plus zwei Guards.

---

## Punkt 42 — der Guard sah nur eine Richtung

Der Guard aus Punkt 38 prüft, dass jede Karte, die Geld verlangt, auch auf der Paywall steht. Er
findet Karten daran, dass sie verkaufen. Ein Gate, das sperrt **ohne** zu verkaufen, war für ihn
per Konstruktion unsichtbar — und genau eines gab es: der Chat antwortete ohne Premium mit
allgemeinen Bereichen und sagte kein Wort darüber.

Die Lehre ist dieselbe wie beim Browser-Globals-Guard: eine Prüfung, die nur eine Richtung kennt,
bestätigt vor allem sich selbst. `GATE_SITES` dreht sie um — nicht mehr „findet sich zu jeder
Verkaufsstelle ein Angebot", sondern „findet sich zu jedem Gate eine Stelle, an der es überhaupt
noch durchgesetzt wird".

Und die Landing-Page war der teuerste Fall derselben Familie: sie war nicht falsch, sie war
austauschbar. Alle drei beworbenen Punkte standen wörtlich in `FREE_CAPABILITIES`.

**Stand:** e2e **287 Checks**, `npm run check` mit vier Guards neben den vierzehn Modulen.

---

## Punkt 43 — eine Anzeigefrage, die keine war

Gefragt war „kcal statt Prozent, zu schwer?". Die Anzeige war der kleinere Teil. Beim Nachrechnen
stellte sich heraus, dass `1.3` als Obergrenze das Protokoll systematisch nach unten zieht und
damit die gemessene Erhaltung und das ausgegebene Tagesziel gleich mit. Ein ausgelassener Tag
verliert den Tag ehrlich; ein gedeckelter Tag lügt über ihn. Der vierte Knopf ist die eigentliche
Änderung, die Kilokalorien sind die sichtbare.

Zweiter Fund, diesmal im Test: der Fasten-Streifen-Test griff auf `[role="checkbox"]` zu, ohne zu
sagen, welcher Streifen gemeint ist. Solange es nur einen gab, war er grün. Der neue
Ausreißer-Streifen brachte sieben weitere Rollen — der Test zählte vierzehn und tippte auf
irgendeine davon. Er war die ganze Zeit an die Abwesenheit eines zweiten Streifens gebunden, ohne
das irgendwo zu sagen. Jetzt an den eigenen Labels festgenagelt.

Und die Regel, auf der Punkt 3 steht, ist als Selbstcheck formuliert statt als Kommentar: derselbe
Verlauf mit und ohne markierte Tage **muss** dieselbe gemessene Erhaltung ergeben — und der Check
weist zusätzlich nach, dass ein Weglassen sie sehr wohl verschieben würde. Ein Verbot ist nur so
viel wert wie der Nachweis, dass es etwas verhindert.

**Stand:** e2e **299 Checks**.

---

## Punkt 44 — die Frage war, was mir als Nutzer fehlen würde

Die Antwort war nicht „ein Feature". Die App verlangte nicht, was sie braucht: die Messung, das
ganze Verkaufsargument, hängt an vier Wiegungen über zehn Tage, und nichts in der App hat je um
eine Wiegung gebeten. Die eine wöchentliche Anweisung zählte nur die Abende und meldete danach
Vollzug. Jemand konnte alles richtig machen, „Nichts zu ändern diese Woche" lesen und die Messung
nie bekommen.

Zwei Dinge, die ich beim Verifizieren gelernt habe:

- `SEED` bringt drei Wiegungen mit **festen Datumsangaben** (2026-07-28 bis 08-04). Mein Test traf
  deshalb den Span-Zweig statt des Wiegungs-Zweigs. Das ist auch eine Zeitbombe: sobald das echte
  Datum 21 Tage darüber hinaus ist, fallen sie aus dem Fenster und mehrere Checks ändern still ihr
  Verhalten. Notiert, nicht in dieser Runde behoben.
- Der Span-Zweig sagte „Four weigh-ins in N days" — starr „Four", egal wie viele es waren. Ein
  fest verdrahtetes Zahlwort in einem Satz, dessen einziger Zweck das Zählen ist.

Und die Zähler konnten ihre eigene Schwelle überschreiten: „10 of 8 evenings". Liest sich wie ein
Fehler und verkauft den fertigen Teil unter Wert.

**Stand:** e2e **308 Checks**.

---

## Punkte 45 und 47 — ein Test, der von einer Abwesenheit lebte

Der ältere Test „but the figure itself is not given away" wurde rot, und zwar richtig: er prüft die
Bezahlschranke und hat dafür die Abwesenheit einer Vorschau vorausgesetzt, ohne das zu sagen. Er
sät jetzt ausdrücklich, dass die Vorschau verbraucht ist. Dieselbe Klasse wie der Fasten-Streifen
in Punkt 43, der an der Abwesenheit eines zweiten Streifens hing.

Die Einmal-Regel liegt bewusst in `shouldAnnounceMeasurement` statt im Bildschirm, und der
Selbstcheck schickt zwanzig Vordergrund-Ereignisse durch und verlangt genau eine Auslösung. Eine
Regel, die nur im Kommentar steht, ist eine Hoffnung.

**Stand:** e2e **316 Checks**.

---

## Punkt 46 — der Test wählte eine Option, die die App zu Recht ablehnt

Der e2e klickte 0,75 kg/Woche für einen 82-kg-Körper. Das sind 825 kcal Defizit auf einen
Erhaltungsbedarf von rund 2.290 — also 1.461 zu essen, unter dem Grundumsatz von 1.633. Die
Ablehnung war richtig. Falsch war, was ich daraus gemacht hatte: die Auswahl setzte einfach `null`,
also passierte sichtbar **nichts**. Ein Knopf, der auf Tippen nichts tut und nichts sagt, lehrt
niemanden etwas — das ist schlimmer als eine Ablehnung und schlimmer als ein stilles Klammern,
weil man nicht einmal merkt, dass etwas passiert ist.

Jetzt wählt der Tipp immer aus, die Folge steht darunter, und gespeichert wird nur, was die App
auch liefert. Die Zusammenfassung liest aus derselben Funktion wie das Speichern, damit geprüft
wird, was abgelegt wird.

Zweiter Fund im selben Zug: der Hinweistext hing als **Placeholder** am Eingabefeld. Er
verschwindet, sobald jemand tippt — und genau dann agiert er zu der Zahl, der er zustimmt, wenn er
das Feld leer lässt. Jetzt sichtbarer Text.

**Stand:** e2e **323 Checks**.

---

## Punkt 48 — mein Test kämpfte gegen den Harness, nicht gegen den Code

`avoid` kam nicht im Anfrage-Body an, obwohl der Speichern-Check grün war. Ursache war keine der
Stellen, an denen ich gesucht habe: `newPage` setzt den Seed über `addInitScript`
(`harness.mjs:140`), und der läuft bei **jedem** Dokumentenladen. Mein Test hat das Feld über die
Oberfläche gespeichert und ist dann zum Planer navigiert — die Navigation hat `onboarding_profile`
auf den Seed zurückgesetzt und die Eingabe verworfen.

Die Lehre gilt für jeden künftigen Test: **was über die UI gespeichert und danach wegnavigiert
wird, ist weg.** Speichern und Senden müssen in getrennten Kontexten geprüft werden, sonst prüft man
den Harness.

Der zweite Fund der Runde ist der ärgerlichere, weil er still Daten zerstört hat: `slice(-60)` auf
einer nach Häufigkeit sortierten Liste schneidet die **Lieblingsrezepte** ab. Wer sechzig Gerichte
gekocht hatte, verlor beim einundsechzigsten genau das, was er am häufigsten macht. Eine
Speichergrenze, die das Gegenteil von dem tut, wofür die Sammlung da ist.

**Stand:** e2e **331 Checks**.
