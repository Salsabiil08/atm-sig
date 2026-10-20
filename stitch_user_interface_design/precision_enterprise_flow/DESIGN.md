---
name: Precision Enterprise Flow
colors:
  surface: '#fff8f7'
  surface-dim: '#f3d3cf'
  surface-bright: '#fff8f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0ee'
  surface-container: '#ffe9e6'
  surface-container-high: '#ffe2de'
  surface-container-highest: '#fbdbd7'
  on-surface: '#281715'
  on-surface-variant: '#5c403c'
  inverse-surface: '#3f2c29'
  inverse-on-surface: '#ffedea'
  outline: '#916f6b'
  outline-variant: '#e6bdb8'
  surface-tint: '#bf0715'
  primary: '#b70011'
  on-primary: '#ffffff'
  primary-container: '#dc2626'
  on-primary-container: '#fff6f5'
  inverse-primary: '#ffb4ab'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#004ed0'
  on-tertiary: '#ffffff'
  tertiary-container: '#2d68f0'
  on-tertiary-container: '#f8f7ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#93000b'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#fff8f7'
  on-background: '#281715'
  surface-variant: '#fbdbd7'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system embodies the rigor, operational velocity, and exactitude expected of enterprise accounting and compliance departments. Its personality is disciplined, authoritative, high-clarity, and trustworthy. Designed primarily for accountants, controllers, finance managers, and auditors, the interface eliminates cognitive clutter to accelerate high-stakes workflows, task delegation, and timeline reviews.

Drawing from modern enterprise minimalism and high-contrast corporate productivity interfaces, the aesthetic balances deep institutional red brand anchors with crisp, cool-slate neutrals and clear functional semantic signals. The experience evokes control, timeliness, and uncompromised structural reliability across desktop and mobile screens alike.

## Colors

The palette is engineered around instant legibility and distinct semantic state hierarchies.

- **Primary Brand Red (`#DC2626` / `#C81E1E`):** Serves as the primary operational anchor, signature top navigation, corporate headers, and destructive/overdue focal points.
- **Deep Neutral / Secondary Slate (`#1E293B` to `#0F172A`):** Powers typography, sidebar icons, primary authentication actions, and high-contrast baseline panels.
- **Functional Semantics:**
  - **Success / Completed (`#16A34A` / soft bg `#DCFCE7`):** Validated checkpoints, on-track status, and submitted reports.
  - **Warning / At Risk (`#D97706` / soft bg `#FEF3C7`):** Approaching checkpoints, pending review requirements, and delay notices.
  - **In Progress (`#2563EB` / soft bg `#EFF6FF`):** Active items under investigation, reconciliations underway, and mid-cycle tasks.
  - **Blocked / Critical (`#DC2626` / soft bg `#FEE2E2`):** Escalated blockers, overdue reconciliations, and failed validations.
- **Backgrounds & Surfaces:** Canvas uses `#F8FAFC`, while cards and panels rely on pure `#FFFFFF` bounded by structural hairline borders (`#E2E8F0`).

## Typography

Typography prioritizes tabular clarity, dense information hierarchy, and fatigue reduction during high-volume accounting work. Inter is utilized universally across display, body, and labels for optical neutrality, robust numeric rendering, and legible tiny metrics.

- **Uppercase tracking:** All `label-caps` and table column headers enforce a letter spacing of `0.05em` to cleanly distinguish metadata labels from accounting row data.
- **Numbers & Dates:** Monospaced figures (`tnum`) should be toggled on across all tables, progress percentages, counts, and currency metrics to ensure clean vertical column alignment.

## Layout & Spacing

The layout is built upon an adaptive 12-column responsive fluid grid designed for task management speed and dense data consumption:

- **Desktop (1024px+):** Fixed 240px vertical sidebar navigation, sticky full-width brand header, with the main workspace arranged into modular multi-column card grids with 24px gutters.
- **Tablet (768px - 1023px):** Collapsible compact sidebar with icon triggers, switching 4-card metric banks into 2x2 grids.
- **Mobile (< 768px):** Single-column vertical stack with 16px page margins, horizontal pill scrolling for filters, sticky floating bottom actions for primary workflows (e.g., "Submit Review"), and full-width list items with swipe gestures.

## Elevation & Depth

Visual hierarchy uses a refined hybrid of crisp borders and faint ambient shadows:

- **Base Surfaces (`Level 0`):** `#F8FAFC` page background with non-elevated neutral tone.
- **Card Surfaces (`Level 1`):** Pure `#FFFFFF` background with a subtle border (`1px solid #E2E8F0`) and an ultra-soft ambient shadow (`0 1px 3px rgba(15, 23, 42, 0.05)`).
- **Interactive Modals & Popovers (`Level 2`):** Elevated modals, select dropdowns, and context menus employ a pronounced shadow (`0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`) with a hairline border.
- **Notification Banners:** Flush, full-width alert cards utilizing soft tinted pastel fills (e.g., amber warning `#FEF3C7`) with matched boundary strokes (`1px solid #FCD34D`).

## Shapes

The design system maintains a balanced `Level 2` (Rounded) geometry:
- Standard container cards, dialogs, and panels feature `0.75rem` (12px) to `1rem` (16px) corners, delivering an approachable yet formal enterprise feel.
- Inputs, list items, and primary operational buttons use `0.5rem` (8px) corners for crisp tactile bounding.
- Status badges and metadata tags are styled as pill shapes (`9999px` radius) or soft rounded chips (`6px` radius) to immediately contrast with rectangular data tables.

## Components

### Buttons
- **Primary:** High-emphasis slate `#0F172A` (auth/save) or brand red `#DC2626` (escalate/resolve), white text, `8px` corner radius, `10px 16px` padding.
- **Secondary / Outline:** White surface, border `1px solid #E2E8F0`, dark text `#1E293B`, subtle hover background `#F8FAFC`.
- **Status Action:** Dynamic contextual variants (e.g., green solid button `#16A34A` for "Masih on track", red outline for "Butuh support").

### Status Tags & Chips
- Compact pills with `4px 10px` padding, uppercase or capitalized semibold text (`11px` / `12px`).
- **In Progress:** Pale blue background `#EFF6FF`, text `#2563EB`.
- **Blocked / Overdue:** Pale red background `#FEE2E2`, text `#DC2626`.
- **Review / On Track:** Pale violet/green backgrounds with matching dark text.

### Data Tables & Task Lists
- Compact table layouts with light gray header strips (`#F8FAFC`), subdued uppercase column labels, and `1px solid #F1F5F9` bottom divider rules.
- Checkbox tasks display interactive strike-through state and muted text color `#94A3B8` when marked complete.

### Metric Summary Cards
- White rounded cards highlighting large tabular bold figures (`32px`), a concise label (`13px #64748B`), and an optional semantic colored metric indicator.

### Input Fields
- Clear `1px solid #CBD5E1` border, `8px` corner radius, `#FFFFFF` background, standard height `40px` (or `48px` on mobile for touch accessibility).
- Focused state transitions border to `#DC2626` or `#2563EB` with a `2px` focus halo (`rgba(220, 38, 38, 0.15)`).

### Progress Bars
- Slim track (`6px` or `8px` height) with soft background `#E2E8F0` and pill-ended fill colored dynamically by health status: Red (`<50%` or behind schedule), Amber (`50-79%`), Green (`80-100%`).