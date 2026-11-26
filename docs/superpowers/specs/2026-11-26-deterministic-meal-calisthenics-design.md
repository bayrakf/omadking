# Design: Geschlossener Regelkreis aus Energie-Tracking, deterministischer Rezept-Engine & Calisthenics (+ KI-Entfernung)

**Datum:** 2026-11-26  
**Scope:** Vollständige Verzahnung des bestehenden adaptiven Kalorien-/Energie-Systems (`src/lib/energy.ts`) mit der neuen deterministischen Standard-/Premium-Rezept-Engine (`src/lib/recipes.ts`), Calisthenics-/Eigengewicht-Workouts mit Satz-/Wiederholungs-Tracking (`src/lib/workouts.ts`) sowie restlose Entfernung von AI-Chat & LLM-Aufrufen.

---

## 1. Geprüfte Alternativen & Entscheidung

1. **Zufalls-Baustein-Generator (`Protein × Carb × Fett`):** Erzeugt geschmacklich unpassende Kombis und inkonsistente Einkaufslisten. **Verworfen.**
2. **Backend-Rezept-API (Supabase):** Unnötige Latenz und Ausfallrisiko für statische kuratierte Rezepte. **Verworfen.**
3. **Geschlossener 3-Säulen-Regelkreis on-device (Gewählt):**
   - **`energy.ts` (Kalorien- & Mess-Gehirn)** liefert den echten Verbrauch (`measuredMaintenance`), Plateau-/Diet-Break-Status, Wochenbudget-Saldo (`weekBudget`) und Protein-Adhärenz (`proteinAdherence`).
   - **`workouts.ts` (Training & Calisthenics)** speist absolvierte Trainingseinheiten + Satz-/Wiederholungsdaten (`workout_log`) exakt in Kalorienziel, Wasserziel, Makro-Verteilung und `recordIntake` zurück.
   - **`recipes.ts` (Kuratierte, skalierbare Rezepte)** wählt und skaliert Standard- vs. Premium-Rezepte exakt auf das errechnete Tagesziel + Energie-Kontext — **0 ms, 100 % offline, 0 LLM-Kosten**.

### Verbindliche Architekturentscheidungen
- **Paywall-Umstellung (ehrlich statt 3-Pläne-KI-Cap):** Unbegrenzte **Standard-Pläne** kostenlos (6–8 skalierbare Basisrezepte mit voller Energie-, Training- & Allergen-Anpassung). **Premium** schaltet die erweiterte **Performance-/Chef-Rezeptbibliothek** (20–24 Rezepte, `chef`-Komplexität, Anti-Wiederholungs-Rotation), echte `cycleWeek`-Periodisierung und die Mess-/Prognose-Analysen in `Progress` frei.
- **Unberührte Kernformeln:** `dailyTargets()` und bestehende Funktionen in `energy.ts` / `nutrition.ts` bleiben in ihrer Signatur und Rechenlogik stabil (sichert 100 % bestehende Pure-Logic- & E2E-Verträge); die intelligente Verknüpfung entsteht als kompositorische Schicht darüber.
- **KI-Bereinigung:** `chat.tsx`, `askCoach`, `CoachMemory`, `supabase/functions/chat/` und `supabase/functions/generate_meal_plan/` entfallen komplett; `offer.ts`, `legal.tsx`, `you/data.tsx`, `README.md`, `scripts/check-logic.mjs` und `e2e/` werden sauber mitgezogen.

---

## 2. Der geschlossene Regelkreis (End-to-End-Datenfluss)

```text
   [workout_log] (Calisthenics/Gym, Sätze × Wdh., MET)
         │                                     │
         ▼                                     ▼
  [today / corrections]                 [plannerTarget + Macro-Shift]
  genauer `questionKcal` &              ├─ Basis: dailyTargets(p, workout, measured)
  Wasserziel -> exakteres `intakeLog`   ├─ + readPlateau() / deficitSpell() (wenn aktiv)
         │                              ├─ + weekBudget().perDayLeft (Budget-Modus ≥ BMR)
         ▼                              └─ + proteinAdherence() (Sättigungs-Boost)
   [energy.ts Engine] ─────────────────────────┤
   measuredMaintenance · trend · plateau       ▼
         ▲                              [recipes.ts Engine]
         │                              Filter: Tier (Free/Pro) & profile.avoid
         └── Abend-Check-in & Waage     Score: Ziel · OMAD-Fenster · Energie-Zustand · Rotation
                                        Scale: Gramm-genau auf Ziel-kcal / P / C / F (5g)
```

---

## 3. Komponenten im Detail

### A. Energie-Tracking <-> Planner & Today (`src/lib/nutrition.ts`, `src/app/(tabs)/index.tsx`, `src/app/week/corrections.tsx`, `src/app/(tabs)/planner.tsx`)
1. **Ein gemeinsamer Tagesziel-Helper (`targetForDate`):**
   - Bisher nutzte `Today` für gestern (`question.date !== today`) und `week/corrections.tsx` pauschal `dailyTargets(p, null)` ohne Training und ohne gemessenen Verbrauch; `waterTarget` nahm fest `sport: 'session', intensity: 'medium'`.
   - Neu: Ein kleiner gemeinsamer Helper liest das am Datum tatsächlich geloggte Training aus `workout_log` (Fallback: `planHistory` des Tages) + `effectiveMaintenance` -> **exaktere `questionKcal`**, saubereres `measuredMaintenance` und echtes schweißabhängiges `hydrationTargetMl`.
2. **Adaptive Budget-Modi im Meal Planner (`planner.tsx`):**
   - **Normal / Gemessen:** Zeigt sichtbar an, ob die Kalorien aus der **gemessenen Maintenance** (Premium) oder der Formel stammen, inkl. aktuellem Workout-Bonus.
   - **Plateau / Diet-Break Integration (`readPlateau` + `deficitSpell`):** Stagniert/steigt das Gewicht ≥ 14 Tage (`stall.stalled`) oder läuft ein Defizit ≥ 8 Wochen (`spell.breakDue`), bietet der Planner oben einen ruhigen One-Tap-Switch („Plateau-Anpassung: X kcal“ bzw. „Erhaltungswoche: Y kcal“) direkt auf das Mahlzeitenziel an (opt-in, kein plötzliches Überschreiben ohne Info).
   - **Wochenbudget-Ausgleich (`weekBudget`):** Wurde unter der Woche mehr gegessen (`perDayLeft < dailyTarget`), zeigt der Planner den noch verfügbaren Tageswert (`>= bmrFloor`) als direkt aktivierbares Ziel („Wochenbudget halten: X kcal“), sodass das gewählte Rezept exakt auf die verbleibenden Wochenkalorien skaliert.
   - **Protein-Schutz (`proteinAdherence`):** Zeigt das Protokoll wiederholt zu wenig Protein an OMAD-Tagen (`hit / days < 0.8`), hebt das Rezept-Scoring automatisch protein-effizientere Mahlzeiten nach vorn.
3. **Echter 7-Tage Wochenplan (`planner.tsx` Tab „Woche“):**
   - Ersetzt den alten Dummy-Faktor `preview.kcal * 0.85` (und den alten KI-Text) durch echtes `cycleWeek(weeklyKcal, trainingDays, bmr(p))` (oder Fallback auf Workout-/Ruhetag-Berechnung) und verknüpft die Wochentage mit den Rezept-Rotationen + 1-Tap Wocheneinkauf (`grocery.ts`).

### B. Deterministische Rezept-Engine (`src/lib/recipes.ts`, `src/lib/ai.ts`)
- **Datenmodell `RecipeTemplate`:**
  - `id`, `tier: 'standard' | 'premium'`, `complexity: 'quick' | 'balanced' | 'chef'`, `title: { de, en }`
  - `tags: DietaryTag[]` (`meat`, `poultry`, `fish`, `dairy`, `eggs`, `nuts`, `gluten`, `soy`, `spicy`) gegen `profile.avoid`
  - `volume: 'compact' | 'normal' | 'high_volume'` (`omad_window_hours <= 2` bevorzugt `compact`; aktives Kaloriendefizit / `weight_loss` bei >= 3h bevorzugt `high_volume` Sättigung)
  - `fitGoals: Goal[]`, `carbFocus: 'high' | 'moderate' | 'low'`
  - **Skalierung (`scaleRecipe`):** Proteinquelle auf `targets.protein_g`, Carb-Quelle auf `targets.carbs_g`, Fett-Quelle auf restliche `targets.fat_g` (realistisches Min/Max-Clamping, 5 g Rundung), voll lokalisierte Schritte + Reheat-Anleitung + `grocery.ts`-konforme Zutatenzeilen.
- **Katalog & Scoring (`pickRecipe`):**
  - **Standard (Free):** 6–8 skalierbare Rezepte (`quick` & `balanced`), decken Omnivor, Fisch, Vegetarisch, Abnehmen & Muskelaufbau komplett ohne Quota ab.
  - **Premium:** 20–24 weitere Performance-/Chef-Rezepte (*Post-Calisthenics Glycogen Reload*, *Strict-1h-OMAD Dense Bowl*, *High-Satiety Cut Plate*, *Rest-Day Low-Carb*).
  - **Bewertung:** Ziel + Fenster-Volumen + Energie-Kontext (Plateau/Defizit-Sättigung vs. Training-Carbs) + Komplexität + starker Anti-Dopplungs-Malus über `plan_history` + `excludeId` für „Anderes Rezept“-Swap ohne Limit.

### C. Calisthenics, Eigengewicht & Satz-/Wiederholungs-Tracking (`src/lib/workouts.ts`, `src/app/workout.tsx`, `src/lib/store.ts`)
- **`nutrition.ts`:** Ergänzt `MET` und `SPORT_IDS` um **`calisthenics` (6.0 MET)** und **`hiit` (8.5 MET)**.
- **Trainingsbibliothek (`src/lib/workouts.ts`):**
  - Kategorien: `Calisthenics`, `Kraft / Gym`, `HIIT`, `Ausdauer`, `Mobility`.
  - Jede Calisthenics-/Eigengewicht-Einheit (Push & Core, Pull & Rücken, Beine/Pistols, Ganzkörper-Zirkel) passt ihre Übungen an `profile.fitness_level` (`beginner` / `intermediate` / `advanced`) an, inkl. Ziel-Sätzen und Wdh.-Spanne.
- **Satz- & Wiederholungs-Log (`store.ts` `KEYS.workoutLog` + Backup/Sync/Delete):**
  - Speichert abgeschlossene Sessions (`date`, `workoutId`, `sport`, `durationMin`, `intensity`, `exercises: [{ id, name, sets: [{ reps, loadKg? }] }]`).
  - Mobile UI in `workout.tsx`: pro Satz `+`/`-` bzw. `16px` Zahlenfeld, **„Letztes Mal: 3×8 / 8 / 7“** direkt daneben, ruhiger Progressions-Hinweis bei Erreichen der oberen Ziel-Wdh. sowie defensiver Hinweis bei aktivem Langzeit-Defizit (`deficitSpell.breakDue`).
  - **Einbindung:** Direkte Einstiege von `Today` & `Plan`, Sport-Chip `Calisthenics` im Planner und automatische Übernahme der heute geloggten Einheit in Planner + Abend-Kalorien (`Today`).

### D. Entfernung von Chat & KI-Infrastruktur
- **Löschen:** `src/app/chat.tsx`, `supabase/functions/chat/`, `supabase/functions/generate_meal_plan/`, `askCoach`/`CoachMemory`/`chatLog` in `ai.ts`/`store.ts`/`sync-merge.ts`, Coach-Icon in `(tabs)/index.tsx`, Route `chat` in `_layout.tsx` (inkl. Prüfung ob `markdown.ts`/`Md` anderweitig gebraucht werden).
- **Anpassen:** `offer.ts` (`chat_context` & `plan_quota` -> `premium_recipes` in `planner.tsx`), `legal.tsx` (kein Gemini/Google-Empfänger mehr), `you/data.tsx`, `README.md` (`delete_account`), `scripts/check-logic.mjs` (statischer Check auf deterministische Rezept-Filter/Allergene/Tier-Trennung statt Edge-Function-Prompt), `e2e/smoke.mjs` & `e2e/interact.mjs`.

---

## 4. Verifizierungsplan nach Go
1. `npm run check` (Pure-Logic-Checks inkl. neuer `recipes.ts` & `workouts.ts` Selbsttests + Static Checks).
2. `npx tsc --noEmit` (0 Fehler).
3. `npm run e2e -- --build` (angepasste Smoke- & Interact-Tests für Rezept-Skalierung, Allergen-Filter, Budget-/Plateau-Anbindung, Premium-Rezept-Gate, Calisthenics + Rep-Tracking-Persistenz).
4. `agent-browser` Visual Audit (`390×844` Dark/Light auf `Today`, `Plan`, `/workout`).
