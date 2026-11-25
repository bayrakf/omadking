# DESIGN.md — OMADCoach Mobile-First System

Redesigned using `frontend-design`, `no-slop-ui`, `mobile-native`, `apple-design`, `animate-expo`, and `web-design-guidelines`.

---

## 1. Visual Philosophy (Anti-Slop Native Mobile)

- **Quiet Native Utility**: Designed for `390x844` phones first (`MaxContentWidth: 500`, single focused vertical rhythm, comfortable `560px–680px` centered reading width on larger screens).
- **Zero AI Clichés**:
  - Eliminated neon lime (`#C9F233`) + warm cream (`#F5F4EF`) + floating SaaS bento cards + tracked-out ALL-CAPS monospace eyebrow headers + square tinted icon boxes + entrance stagger animations.
  - Replaced with iOS System Grouped surfaces (`#F2F2F7` / `#FFFFFF` Light, `#0E0F12` / `#1C1C1E` Charcoal Studio Dark), native system sans typography (`-apple-system, BlinkMacSystemFont, 'Inter'`), tight `8–12px` corners, hairline separators, and natural sentence-case hierarchy.
- **Mobile Platform Layer (`mobile-native` & `animate-expo`)**:
  - Docked edge-to-edge native bottom tab bar (`animation: 'none'`, sits in normal flex layout so zero cards are occluded).
  - Safe areas (`viewport-fit=cover`, `interactive-widget=resizes-content`, `insets.top` / `insets.bottom`).
  - Zero `300ms` tap delay (`touch-action: manipulation`), zero webkit tap highlight flash, `16px` input floor (prevents iOS Safari auto-zoom), `user-select: none` on controls only, `@media (pointer: fine)` overscroll guard, dual `<meta name="theme-color">` synchronized with light/dark theme switching.
  - Press targets >= 44pt (`hitSlop` + `pressRetentionOffset` + instant `scale(0.97)` feedback).

---

## 2. Color Tokens (`src/constants/theme.ts`)

| Token | Light (`#F2F2F7` Grouped) | Dark (`#0E0F12` Charcoal) | Role |
| :--- | :--- | :--- | :--- |
| `bg` | `#F2F2F7` | `#0E0F12` | Root grouped canvas |
| `surface` | `#FFFFFF` | `#1C1C1E` | Grouped cards, tab bar, sheets |
| `surfaceElevated` | `#E9E9EE` | `#2C2C2E` | Secondary controls, active segments |
| `well` | `#E5E5EA` | `#242426` | Tracks, input wells, inline action pills |
| `text` / `textDim` | `#1C1C1E` / `#52525B` | `#F5F5F7` / `#AEAEB2` | Primary & secondary prose |
| `textFaint` | `#6C6C70` | `#8E8E93` | Subtle timestamps & hints (>= 4.5:1) |
| `accent` / `onAccent` | `#0066CC` / `#FFFFFF` | `#0A84FF` / `#FFFFFF` | Fasting progress, active tab, primary CTA |
| `ember` / `onEmber` | `#C2410C` / `#FFFFFF` | `#FF6B35` / `#0E0F12` | Rationed: open eating window, surplus, streak |
| `plan` / `hydro` / `body` | `#15803D` / `#0284C7` / `#5E5CE6` | `#30D158` / `#38BDF8` / `#818CF8` | Meal macros, hydration, weight biometrics |
