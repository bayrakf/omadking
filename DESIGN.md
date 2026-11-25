# DESIGN.md — OMADCoach Precision Instrument System

Derived from top-starred GitHub UI/design-system architectures (`nextlevelbuilder/ui-ux-pro-max-skill`, `shadcn-ui/ui`, `VoltAgent/awesome-design-md` / `google-labs-code/design.md`, `founded-labs/react-native-reusables`) and adapted to OMADCoach's calibrated biometric telemetry domain.

---

## 1. Visual Theme & Aesthetic Direction

- **Identity**: Precision Metabolic Telemetry (Linear dark/light discipline + Oura calm hierarchy + Nike Running typographic authority).
- **Dual-Polarity Parity**: Full, first-class parity between **Obsidian Carbon (Dark)** and **Alabaster Paper (Light)** plus automatic **`system` OS tracking**.
  - **Strict Polarity Rule**: Never strand dark `#0F172A` cards, dark bottom bars, or `#FFFFFF` text on Light screens, and never leak bright un-calibrated fills into Dark screens. Every card, dial, chart, modal, and navigation surface adapts through semantic tokens in `src/constants/theme.ts`.
- **Anti-Slop Constraints**:
  - Zero emojis in chrome, cards, onboarding rows, or telemetry buttons. All iconography uses crisp 24px vector stroke/fill geometry (`src/components/icons.tsx`).
  - Zero fake placeholder health numbers (`CLAUDE.md` calculation integrity rule).
  - Zero `gap`, `rowGap`, or `columnGap` in React Native `StyleSheet` (`react-native-web` 0.21 safety).

---

## 2. Color Tokens & Surface Ladder (`src/constants/theme.ts`)

Every hex value enters screens strictly via `useTheme()` (`c.*`) or `washOf(c.*)`. Screens (`src/app/**/*.tsx`) must contain zero raw hex/rgba surface literals (`scripts/check-logic.mjs`).

### Dark Mode — *Obsidian Carbon*
| Role | Token | Value | Usage |
| :--- | :--- | :--- | :--- |
| Canvas | `bg` | `#090B0E` | App root background (never harsh `#000000`) |
| Card | `surface` | `#11141A` | Primary bento cards, modules |
| Elevated | `surfaceElevated` | `#171B23` | Active segments, interactive rows, nested cards |
| Recessed Well | `well` | `#0C0F14` | Input wells, gauge tracks, muted pills |
| Hero Surface | `heroFill` | `#131720` | Fasting instrument stage (subtle lift + `lineStrong`) |
| Primary Ink | `text` | `#F3F5F8` | Headlines, figures, primary actions |
| Secondary Ink | `textDim` | `#9CA5B4` | Descriptions, subtitles (>= 7:1 on `surface`) |
| Metadata Ink | `textFaint` | `#6E7889` | Uppercase mono labels, axes (>= 4.5:1 on `surface`) |
| Hairline Border | `line` | `#1F242E` | Default 1px structural boundaries |
| Strong Border | `lineStrong` | `#2E3544` | Active focus, hero framing, tactile buttons |
| Primary Accent | `accent` / `onAccent` | `#C9F233` / `#090B0E` | Fasting progress, active selection, primary CTA |
| Rationed Ember | `ember` / `onEmber` | `#FF642E` / `#090B0E` | **Strictly** eating window, meal due, surplus alerts |
| Semantic Data | `ok` / `warn` / `bad` | `#22C55E` / `#F59E0B` / `#EF4444` | Status states, carb/fat telemetry (`#38BDF8` / `#F59E0B`) |

### Light Mode — *Alabaster Paper*
| Role | Token | Value | Usage |
| :--- | :--- | :--- | :--- |
| Canvas | `bg` | `#F5F4EF` | Warm architectural paper canvas |
| Card | `surface` | `#FFFFFF` | Crisp white card sitting cleanly on alabaster canvas |
| Elevated | `surfaceElevated` | `#EDEBE3` | Active pills, secondary button wells, hover states |
| Recessed Well | `well` | `#E6E3DA` | Input wells, meter tracks, progress tracks |
| Hero Surface | `heroFill` | `#FFFFFF` | Clean alabaster instrument with `lineStrong` hairline |
| Primary Ink | `text` | `#111317` | Deep obsidian ink (16:1 contrast on `surface`) |
| Secondary Ink | `textDim` | `#4A5260` | Subtitles, body copy (>= 7:1 on `bg`) |
| Metadata Ink | `textFaint` | `#616B7A` | Eyebrows, axis labels, timestamps (>= 4.6:1 on `surface`) |
| Hairline Border | `line` | `#E3E0D6` | Crisp 1px card & divider hairlines |
| Strong Border | `lineStrong` | `#C7C2B4` | Interactive rims, active outlines |
| Primary Accent | `accent` / `onAccent` | `#157A3D` / `#FFFFFF` | Signal Forest Emerald (5.3:1 white ink contrast) |
| Rationed Ember | `ember` / `onEmber` | `#C2410C` / `#FFFFFF` | Burnt Ember (5.2:1 white ink contrast) — rationed use |
| Semantic Data | `ok` / `warn` / `bad` | `#15803D` / `#B45309` / `#DC2626` | Status states, carb/fat telemetry (`#0284C7` / `#B45309`) |

---

## 3. Typography System

- **Display / Numerals (`Font.display`, `'Archivo'`)**: ExtraBold / Bold for ring countdowns, weights, calorie targets, and screen headers with tight negative tracking (`-1.4px` display, `-0.7px` titles). Always `fontVariant: ['tabular-nums']` on ticking numbers.
- **UI Body (`Font.sans`, `'Hanken Grotesk'`)**: Weights `400/500/600/700`, `15px / 22px` line-height. Readable, warm, zero decorative letter-spacing on body text.
- **Telemetry / Mono (`Font.mono`, `'JetBrains Mono'`)**: `11px` uppercase eyebrows (`+1.2px` tracking), timestamps (`18:00–20:00`), unit pills, step counters (`01 / 05`).
- Web font preloading in `src/app/+html.tsx` must match `src/global.css` (`Archivo`, `Hanken Grotesk`, `JetBrains Mono`) and omit fixed dark `!important` overrides so dynamic dark/light hydration has zero flash or polarity clash.

---

## 4. Layout, Grid & Navigation Shell

- **Spacing Scale (`Space`)**: `xs: 6`, `sm: 10`, `md: 16`, `lg: 24`, `xl: 32`, `xxl: 48` (strict 4-pt/8-pt rhythm).
- **Border Radii (`Radius`)**: Tight architectural curves — `xs: 6`, `sm: 10`, `md: 14`, `lg: 18`, `full: 999`. Hairline strokes (`1px` default, `1.5px` active) define structure instead of heavy blur shadows.
- **Responsive Viewport Architecture**:
  - **Narrow / Mobile (`< 840px`)**: Single editorial column (`maxWidth: 560px`) with a theme-adaptive docked navigation capsule at the bottom (`bg` surface + `lineStrong` border, clear active indicator without overlapping `PRO` pills) and generous `TabBarClearance = 120px` so scrolling never leaves bottom buttons covered.
  - **Wide / Desktop (`>= 840px`)**: Expanded multi-column Bento Telemetry shell (`maxWidth: 1000px`) with a clean sticky top navigation bar (`Today | Plan | Progress | Shop | You`) rendered cleanly above content (zero floating dock occluding bottom interactive controls!) and balanced 2-column Bento rows (`Columns`) across `Today`, `Plan`, `Progress`, and `Profile`.
- **Single-Line Segmented Tabs & Clean Focus States**:
  - `SegmentedControl` keeps labels compact and legible with `numberOfLines={1}` / clean flex sizing on 390px viewports (`aria-selected` + `accessibilityState={{ selected }}`).
  - Eliminate jagged default rectangular browser outlines on rounded pill buttons/tabs in favor of intentional focus/selected borders.

---

## 5. Signature Interactions & Contracts

1. **Coaxial Fasting Instrument (`Today`)**: Central vector `FastingHaloDial` paired with metabolically accurate `fastingStage(hoursFasted)` label + `'approximate'` marker, interactive 24-hour `DayBand` strip (`Window opens` + training overlap check), shift-window trigger, and decisive break-fast / finish CTA.
2. **Telemetry Bento Row (`Today`)**: Hydration (`+250 ml`, `+500 ml` both preserved for accessibility/speed + electrolytes toggle) + Daily Steps (`+1.000`, `10k goal`) + Today's OMAD Plate + interactive `dayAgenda()` actionable checklist rows + calibration readiness tracker (`Until your maintenance can be measured`) + `ScaleJump` context card when triggered + 6-state evening check-in (`Ate the plan` ... `Well over double` + `"Change today's answer"`).
3. **Coach-Grade Meal Architect (`Plan`)**: Uncrowded macro donut ring (`156px`+ diameter with clear inner padding so kcal value never touches arc stroke), training/rest toggle, day/week/recipes subtabs (with single-action Plan generation CTA inside empty `Recipes` view), zero truncated `...` plan copy.
4. **Calibrated Biometrics (`Progress`)**: Consistent polarity cards across daily weigh-in, trend curve, week calorie budget bar, cheat-day allocator, measurement readiness, and history log — strictly respecting single upgrade gate (`progressCards()`).
5. **Language Consistency**: Respect active `Lang` (`de` / `en`) cleanly across all tabs, onboarding (`01/05`–`05/05` showing computed calorie/macro preview before completion), modals, and empty states while keeping E2E accessibility contracts intact.
