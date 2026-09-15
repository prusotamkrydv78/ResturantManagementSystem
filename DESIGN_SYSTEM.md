# Design System — Restaurant OS

Extracted from the existing codebase. Every value below is taken from the source; nothing here is proposed or invented.

**Stack:** Next.js 16 App Router · Tailwind CSS 4 · Radix primitives (dialog only) · `motion` v13 · Chart.js 4 + react-chartjs-2 · lucide-react

**Single source of truth:** [`frontend/app/globals.css`](frontend/app/globals.css). Every colour, size, radius and shadow in the product resolves through a token declared there. No component reaches for a raw palette value.

> **Areas.** §1–§14 describe the product's own palette, worn by manager, staff, auth and public screens. The Super Admin area overrides token *values* only; see **§15**.

---

## 1. Colour

### 1.1 How colour works here

Every token is written as `light-dark(<light>, <dark>)` on `:root`, so both halves of a decision live on one line. Theme switching is **one property on one element** — `color-scheme` — set by `:root[data-theme="light"]` / `:root[data-theme="dark"]`; the default `:root` is `color-scheme: light dark` (follows the OS).

Tokens are exposed to Tailwind through `@theme inline` as `--color-*`, giving utilities like `bg-surface`, `text-muted`, `border-border-strong`.

### 1.2 Base palette (the five + one)

| Role | Hex | Notes |
| --- | --- | --- |
| Rich black | `#1A1A1A` | dark ground; light-theme ink |
| Off-white | `#F0F0F0` | dark-theme ink; copy on filled colour |
| Forest green | `#3E5641` | the brand — every affirmative action and CTA |
| Dark teal | `#004D61` | affirmative state — paid, active, in stock |
| Deep ruby | `#822659` | destructive, and anything that has failed |
| Amber (addition) | `#8A5A12` / `#D9A441` | caution; warm and desaturated so it sits with the five |

### 1.3 Semantic tokens

| Token | Light | Dark |
| --- | --- | --- |
| `--canvas` | `#f5f4f2` | `#1a1a1a` |
| `--surface` | `#ffffff` | `#222222` |
| `--surface-2` | `#fafaf9` | `#262626` |
| `--surface-3` | `#efeeeb` | `#2e2e2e` |
| `--border` | `#e2e1dd` | `#333333` |
| `--border-strong` | `#918f8a` | `#767676` |
| `--text` | `#1a1a1a` | `#f0f0f0` |
| `--text-muted` | `#565452` | `#a8a8a8` |
| `--text-subtle` | `#86837e` | `#7a7a7a` |
| `--text-inverse` | `#f0f0f0` | `#1a1a1a` |
| `--primary` | `#3e5641` | `#7fa486` |
| `--primary-solid` | `#3e5641` | `#3e5641` |
| `--primary-hover` | `#344a37` | `#4a6650` |
| `--primary-active` | `#2a3d2d` | `#567359` |
| `--primary-fg` | `#f0f0f0` | `#f0f0f0` |
| `--primary-soft` | `#e9efe9` | `#212c22` |
| `--primary-border` | `#c2d3c5` | `#374a3a` |
| `--success` | `#004d61` | `#4fa8c4` |
| `--success-soft` | `#e1eff3` | `#16303a` |
| `--success-border` | `#a8cfdb` | `#234d5c` |
| `--warning` | `#8a5a12` | `#d9a441` |
| `--warning-soft` | `#fbf0dc` | `#33280f` |
| `--warning-border` | `#ead09b` | `#55431c` |
| `--danger` | `#822659` | `#d2778c` |
| `--danger-solid` | `#822659` | `#822659` |
| `--danger-hover` | `#6b1e49` | `#9a2f6a` |
| `--danger-soft` | `#fae8f0` | `#341a22` |
| `--danger-border` | `#e7bbd1` | `#56303c` |
| `--ring` | `#3e5641` | `#7fa486` |

### 1.4 The solid/type split — the one rule to understand

Two tokens carry the brand and they are **not** interchangeable:

- `--primary` — the brand as **type**: a link, an icon, an active label, a dot.
- `--primary-solid` — the brand as a **filled surface**, with `--primary-fg` printed on it.

In light they are the same green. On `#1a1a1a` forest green is only 2.2:1 and unreadable as type, so dark lifts a second step for type while the button keeps the specified colour. `--danger` splits identically.

> Call-site rule: a colour with `--primary-fg` printed on it is `-solid`; a colour that *is* the mark is not.

### 1.5 Contrast contract

Type tokens clear **4.5:1**. Meta and non-text marks clear **3:1**. `--primary-fg` clears 4.5:1 on its own solid. `--border-strong` clears 3:1 as a UI boundary (the palette it replaced sat at 1.6:1 and inputs read as edgeless).

### 1.6 Chart series (categorical only)

Separate from every token above, because a restaurant is not a warning.

| Token | Light | Dark |
| --- | --- | --- |
| `--chart-1` | `#3e5641` | `#7fa486` |
| `--chart-2` | `#004d61` | `#4fa8c4` |
| `--chart-3` | `#8a5a12` | `#d9a441` |
| `--chart-4` | `#822659` | `#d2778c` |
| `--chart-5` | `#3f5a8a` | `#8aa6d9` |
| `--chart-6` | `#6b4f7a` | `#b393c7` |
| `--chart-rest` | `#b3b1ac` | `#5a5a5a` (the gathering grey, meant to recede) |

---

## 2. Typography

**Fonts** ([`app/layout.tsx`](frontend/app/layout.tsx)): **Inter** (`--font-inter`) for the interface — it holds up at 13–14px; **JetBrains Mono** (`--font-mono-face`) for `--font-mono`.

**Body defaults:** `font-size: var(--text-base)` (14px), `font-feature-settings: "cv05", "cv11", "ss01"`, `-webkit-font-smoothing: antialiased`.

**Headings:** `h1`–`h4` get `text-wrap: balance` and `letter-spacing: -0.011em`.

**Numerals:** `table, .tabular { font-variant-numeric: tabular-nums; }` — every figure that sits in a column carries `.tabular`.

### Scale (application)

| Utility | Size | Line height | Used for |
| --- | --- | --- | --- |
| `text-2xs` | 0.6875rem / 11px | 1rem | uppercase labels, table meta, timestamps |
| `text-xs` | 0.75rem / 12px | 1.0625rem | helper text, hints |
| `text-sm` | 0.8125rem / 13px | 1.25rem | dense UI, table cells, nav rows |
| `text-base` | 0.875rem / 14px | 1.375rem | body, inputs |
| `text-lg` | 1rem / 16px | 1.5rem | section / card titles (`SurfaceHeader`) |
| `text-xl` | 1.125rem / 18px | 1.625rem | card titles |
| `text-2xl` | 1.3125rem / 21px | 1.75rem | page titles (`PageHeader h1`) |
| `text-3xl` | 1.625rem / 26px | 2rem | auth headings |

### Scale (public landing / site templates only)

`text-4xl` 2rem (-0.02em) · `text-5xl` 2.5rem (-0.025em) · `text-6xl` 3.25rem (-0.03em) · `text-7xl` 4rem (-0.034em). Tracking tightens as size grows because Inter opens up at scale. **The application never uses these.**

### Weights in practice

`font-medium` (500) for labels, nav rows, buttons, emphasised cells · `font-semibold` (600) for headings, figures, uppercase table headers · regular for body. Nothing heavier is used.

### The label recipe

One string, repeated across every metric card in the product:

```
text-2xs font-semibold tracking-wider text-subtle uppercase
```

---

## 3. Spacing

Tailwind's default 0.25rem step. In practice the product uses a narrow, consistent band:

- **Gaps:** `gap-2` (172×), `gap-3` (165×), `gap-4` (121×), `gap-1` (87×), `gap-1.5` (70×), `gap-0.5` (52×). Larger gaps (`gap-5/6/8/12`) are rare and mostly nav or landing.
- **Padding:** `p-4` (83×) dominates, then `p-3`, `p-5`, `p-3.5`.
- **Page gutter:** one value at every width — `px-4 py-4` on `PageBody`, `px-4 py-3.5` on `PageHeader`. Deliberately *not* widened at `sm:` — see [`page-header.tsx`](frontend/components/layout/page-header.tsx): the extra 8px was "a trench between the sidebar and the work".
- **Panel padding:** `p-4` for a body, `px-4 py-3` for a header strip, `px-4 py-2.5` for a table cell.
- **Vertical rhythm between panels:** `gap-4` inside `PageBody`, `gap-3` for tight stat rows.

---

## 4. Border radius

Small and consistent. Nothing pill-shaped except badges and avatars.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | 0.25rem | focus outline, segmented-control cells |
| `--radius-md` | 0.375rem | **the default** — buttons, inputs, tooltips, nav rows, icon buttons |
| `--radius-lg` | 0.5rem | `Surface`, `Card`, dialog |
| `--radius-xl` | 0.625rem | toast card |

Frequency in source: `rounded-md` 104× · `rounded-full` 77× (badges, dots, avatars, chips) · `rounded-lg` 38× · `rounded-xl` 8×.

The scale is declared on `:root` as `--radius-*-base` and pointed at from `@theme inline`, so a utility paints through a variable and a scoped area can retune it (§15). Values above are the product default and are unchanged.

---

## 5. Shadows / elevation

Deliberately shallow — "a dense application, not a stack of floating cards". **Only three depths exist and nothing invents a fourth inline.**

Ink is tokenised per theme because a dark room needs a much heavier shadow to read as depth:

```
--shadow-ink-1  rgb(26 26 26 / .05)  →  rgb(0 0 0 / .45)
--shadow-ink-2  rgb(26 26 26 / .07)  →  rgb(0 0 0 / .50)
--shadow-ink-3  rgb(26 26 26 / .10)  →  rgb(0 0 0 / .55)
--shadow-ink-4  rgb(26 26 26 / .18)  →  rgb(0 0 0 / .65)
```

| Token | Geometry | Use |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px 0 ink-1` | selected segmented cell, sidebar collapse handle |
| `--shadow-md` | `0 4px 6px -2px ink-2, 0 2px 4px -2px ink-2` | tooltip |
| `--shadow-lg` | `0 12px 28px -8px ink-4, 0 4px 10px -4px ink-3` | dialog, drawer, toast |

Panels in the page body carry **no shadow** — they are separated by `border-border` alone.

---

## 6. Layout & grid

### Application frame — [`components/layout/app-shell.tsx`](frontend/components/layout/app-shell.tsx)

```
<div class="flex min-h-svh bg-canvas">
  <Sidebar />                                  ← lg: sticky, h-svh
  <div class="flex min-w-0 flex-1 flex-col">
    [mobile header, lg:hidden]
    <main class="min-w-0 flex-1">
      <PageHeader />  ← border-b, bg-surface
      <PageBody />    ← flex flex-col gap-4 px-4 py-4
    </main>
  </div>
</div>
```

`PageHeader` is **full width with padding, not a measure**. A 72rem cap was removed: half the screens had opted out of it one at a time, "which is the sign that a default is wrong rather than that those screens are special".

### Grids

- **Card lists** — [`components/ui/card-grid.tsx`](frontend/components/ui/card-grid.tsx): `grid gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`. The ladder is chosen so a card never falls below ~15rem.
- **Metric strips:** `grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4`.
- **Two-pane analysis:** `grid grid-cols-1 gap-4 xl:grid-cols-3` with a `xl:col-span-2` primary (10 occurrences) — or `xl:grid-cols-5` split 3/2.
- **Divided strips:** `grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0`.
- **Lists inside a panel:** `<ul class="flex flex-col divide-y divide-border">` rather than gaps between cards.

---

## 7. Sidebar, header, navigation

### Main sidebar — [`components/layout/sidebar.tsx`](frontend/components/layout/sidebar.tsx)

- `hidden … lg:sticky lg:top-0 lg:flex lg:h-svh`, `border-r border-border bg-surface`
- Width `w-60` expanded / `w-16` collapsed, `transition-[width] duration-200 ease-out`
- Collapsed shell gets `cursor-e-resize`; clicking empty space expands it
- **Nav row:** `relative flex items-center gap-2.5 rounded-md py-1.5 px-3 text-sm transition-colors`
  - active → `bg-primary-soft font-medium text-primary`
  - idle → `text-muted hover:bg-surface-3 hover:text-text`
  - collapsed + active also draws an edge marker: `absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary`
- **Brand:** `size-7 rounded-md bg-primary-solid text-primary-fg` holding a `size-4` icon
- **Collapse handle:** `absolute top-1/2 -right-3 size-6 rounded-full border border-border bg-surface shadow-sm`, straddling the seam; `hover:border-primary-border hover:bg-primary-soft hover:text-primary`
- **Avatar:** `size-7 rounded-full border border-border bg-surface-3 text-2xs font-semibold text-muted`
- **Planned items** render disabled with a `Soon` chip, never as working links
- Navigation is **data, not markup** — [`nav-config.ts`](frontend/components/layout/nav-config.ts), branched by `PlatformRole` and `StaffRole`

### Settings rail — [`app/(app)/settings/layout.tsx`](frontend/app/(app)/settings/layout.tsx)

Same treatment at a smaller scale: `w-56` / `w-14`, same sticky `lg:h-svh`, same active/idle/marker rules. Below `lg` it becomes a horizontal scroll strip: `flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 lg:hidden`. Its content is driven by [`settings-nav.ts`](frontend/components/layout/settings-nav.ts).

### Mobile

A real **drawer** (`w-72 max-w-[85vw]`, `border-r`, `shadow-lg`), not a narrowed sidebar, so the content column keeps full width. Same `SidebarNav` component — the two can never fall out of sync.

### Page header — [`page-header.tsx`](frontend/components/layout/page-header.tsx)

`border-b border-border bg-surface`, `px-4 py-3.5`. Breadcrumb → title (`text-2xl font-semibold`) → optional lede (`max-w-2xl text-sm text-muted`), with `actions` last in the DOM but right-aligned at desktop. Breadcrumbs are **derived from the route**, not passed in — see [`lib/navigation/breadcrumbs.ts`](frontend/lib/navigation/breadcrumbs.ts); a page supplies only `crumb` (the name of the record it shows).

---

## 8. Components

### Surface — [`components/ui/surface.tsx`](frontend/components/ui/surface.tsx)

**The one container in the product**, so panels cannot drift into a dozen card treatments.

```
rounded-lg border border-border bg-surface
```

`SurfaceHeader`: `flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3` — `h2.text-lg.font-semibold` + optional `p.text-xs.text-muted` + right-aligned actions.
`DetailRow`: label/value pairs for detail views.

### Card — [`card-grid.tsx`](frontend/components/ui/card-grid.tsx)

`flex flex-col overflow-hidden rounded-lg border border-border bg-surface-2` — note `surface-2`, one step back from `Surface`, because cards sit in a grid rather than framing a page section. `flex-col` so a caller can push a footer with `mt-auto` and buttons line up across a row.

### Button — [`components/ui/button.tsx`](frontend/components/ui/button.tsx)

Base: `inline-flex shrink-0 items-center justify-center rounded-md font-medium pressable transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50`

| Variant | Classes |
| --- | --- |
| `primary` | `bg-primary-solid text-primary-fg border border-primary-solid hover:bg-primary-hover active:bg-primary-active` |
| `secondary` | `bg-surface text-text border border-border-strong hover:bg-surface-3 active:bg-surface-3` |
| `ghost` | `bg-transparent text-muted border border-transparent hover:bg-surface-3 hover:text-text` |
| `danger` | `bg-danger-solid text-white border border-danger-solid hover:bg-danger-hover active:bg-danger-hover` |

| Size | Classes |
| --- | --- |
| `sm` | `h-8 px-2.5 text-sm gap-1.5` |
| `md` | `h-9 px-3.5 text-base gap-2` |

`buttonClasses()` is exported so `LinkButton` (renders an `<a>`) matches exactly — a link inside a button is invalid and breaks keyboard and middle-click.

### Inputs — [`components/ui/input.tsx`](frontend/components/ui/input.tsx)

One shared `controlClasses` so input, textarea and the custom dropdown cannot drift:

```
w-full rounded-md border bg-surface px-2.5 text-base text-text
border-border-strong placeholder:text-subtle
transition-colors duration-100
hover:border-border-strong
disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted
aria-[invalid=true]:border-danger
```

`Input` adds `h-9`; `Textarea` adds `resize-y py-2` (`rows=3`).
**There is no native `<select>`** — [`select.tsx`](frontend/components/ui/select.tsx) is a custom listbox, because the OS-drawn popup was a white strip on a dark page that no CSS could reach.
`Field` ([`field.tsx`](frontend/components/ui/field.tsx)): `flex flex-col gap-1.5`, label `text-sm font-medium text-text`, required marker `text-danger`, error `text-xs text-danger`, hint `text-xs text-muted`.

### Table — [`components/ui/table.tsx`](frontend/components/ui/table.tsx)

- `TableWrap`: `w-full overflow-x-auto` — a wide table never makes the page scroll sideways
- `Table`: `w-full min-w-[38rem] border-collapse text-left`
- `Th`: `border-b border-border bg-surface-2 px-4 py-2 text-2xs font-semibold tracking-wide text-muted uppercase`
- `Td`: `border-b border-border px-4 py-2.5 align-middle text-sm`
- `Tr`: `transition-colors hover:bg-surface-2`
- **Hairlines, not zebra striping** — stays legible as column counts grow

### Badge — [`components/ui/badge.tsx`](frontend/components/ui/badge.tsx)

`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap` plus a tone:

| Tone | Classes |
| --- | --- |
| `neutral` | `bg-surface-3 text-muted border-border` |
| `primary` | `bg-primary-soft text-primary border-primary-border` |
| `success` | `bg-success-soft text-success border-success-border` |
| `warning` | `bg-warning-soft text-warning border-warning-border` |
| `danger` | `bg-danger-soft text-danger border-danger-border` |

Optional `dot` (`size-1.5 rounded-full bg-current`) so **state is never conveyed by colour alone**.

### Filter chip — [`components/ui/filter-chip.tsx`](frontend/components/ui/filter-chip.tsx)

A bucket that is also a control and also shows its size. `rounded-full border px-2.5 py-1 text-xs font-medium`; active → `border-primary-border bg-primary-soft text-primary`, idle → `border-border text-muted hover:bg-surface-2 hover:text-text`. The count is tinted by **meaning, not size** (`neutral`/`warning`/`danger`) and goes `text-subtle` at zero so an empty bucket recedes.

### Segmented control — [`components/ui/choice.tsx`](frontend/components/ui/choice.tsx)

Track: `flex flex-wrap gap-1 rounded-md border border-border-strong bg-surface-2 p-1`. Cell: `rounded px-3 py-1.5 text-sm`; selected → `bg-surface font-medium text-text shadow-sm` with a `size-3.5` check in `text-primary` (`text-transparent` when not selected, so nothing shifts). One tab stop for the group; arrow keys move within.

### Dialog — [`components/ui/dialog.tsx`](frontend/components/ui/dialog.tsx)

Overlay `fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]`. Content `z-50 w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100vh-3rem)] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg`. Header `border-b border-border px-4 py-3`; footer `border-t border-border bg-surface-2 px-4 py-3` with actions right-aligned.

### Tooltip — [`components/ui/tooltip.tsx`](frontend/components/ui/tooltip.tsx)

`fixed z-50 rounded-md border border-border bg-surface-3 px-2 py-1 text-xs font-medium text-text shadow-md`, portalled, with a 45°-rotated `size-2` cone carrying two of the panel's own border edges.

### Toast — [`components/ui/toast.tsx`](frontend/components/ui/toast.tsx)

`w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border bg-surface p-3 shadow-lg`, stacked bottom-centre on mobile and bottom-right at `sm:`. Carries a `size-8 rounded-full` tone badge and a draining progress bar (`.toast-drain`) that pauses with the dismiss timer, "the honest way to show that a notification is about to leave".

---

## 9. Icons & charts

### Icons

**lucide-react**, exclusively. Sizes: `size-3` (inline meta), `size-3.5` (dense controls), `size-4` (**the default** — nav, buttons, badges), `size-4.5` / `size-5` (brand, mobile menu). Always `aria-hidden="true"` when a text label is present; a collapsed nav row states `aria-label` instead, because "a description is not a name".

### Charts — [`features/analytics/charts.tsx`](frontend/features/analytics/charts.tsx), [`chart-theme.ts`](frontend/features/analytics/chart-theme.ts)

- **Chart.js 4** with controllers registered explicitly (`ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, LineController, LineElement, LinearScale, PointElement, Tooltip`) — react-chartjs-2's typed components are `/* #__PURE__ */` and only register their own controller.
- Tokens are **resolved to real colours in JS**, because a canvas takes `rgb(62 86 65)` not `var(--primary)`. Reading the custom property directly returns the literal `light-dark(...)` text, so a throwaway element's computed `color` is read instead. Re-resolved on `data-theme` mutation *and* on `prefers-color-scheme` change.
- Conventions: `maintainAspectRatio: false` (height is CSS's job, via `ChartFrame`), `borderWidth: 2.5`–`3` on lines, `tension: 0.3`–`0.35`, `pointRadius: 0`, `borderRadius: 3`–`4` on bars, tooltip `titleFont {size:12, weight:600}` / `bodyFont {size:12}` / `footerFont {size:11}`, tick `font {size:11}`, animation `duration: 420`.
- **Entrance is a left-to-right wipe**, not a fade: `clip-path: inset(0% 100% 0% 0%)` → `inset(0% 0% 0% 0%)` over `0.85s` with `ease [0.33, 0, 0.15, 1]`. Staggering points inside Chart.js makes a line *rise* rather than *extend*; wiping the plot area cannot be defeated by whatever a dataset does.
- Exported cards: `RecentDaysCard`, `HourCard`, `TenderCard`, `LeaderboardCard`, `ReportRangeCard`, `WeekdayCard` — each wrapped in `ChartFrame` (`px-4 pt-2 pb-3`, min-height per chart, skeleton until the palette resolves).

---

## 10. Interaction states

| State | Treatment |
| --- | --- |
| **Hover (row/ghost)** | `hover:bg-surface-3 hover:text-text`; table rows `hover:bg-surface-2` |
| **Hover (chip/secondary)** | `hover:bg-surface-2` / `hover:bg-surface-3` |
| **Active (nav)** | `bg-primary-soft text-primary font-medium` + edge marker when collapsed; `aria-current="page"` |
| **Active (press)** | `.pressable` → `transform: scale(0.96)` over `120ms cubic-bezier(.4,0,.2,1)`; suppressed on `:disabled` and `[aria-disabled="true"]` |
| **Focus** | **One treatment for the whole product**: `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; border-radius: var(--radius-sm) }`. Components add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` where a ring reads better than an outline. |
| **Disabled** | buttons `disabled:pointer-events-none disabled:opacity-50`; inputs `disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted` |
| **Invalid** | `aria-[invalid=true]:border-danger` on the control + `text-xs text-danger` message |
| **Selection** | `::selection { background: var(--primary-soft); color: var(--text) }` |

### Loading — [`components/ui/states.tsx`](frontend/components/ui/states.tsx)

- `Skeleton`: `animate-pulse rounded-md bg-surface-3`, `aria-hidden`
- `TableSkeleton` / `CardGridSkeleton`: **shaped like what they replace**, so the layout does not jump when data lands. `CardGridSkeleton` takes `hasMedia` because "a grey rectangle where no picture is coming would be a promise the real card does not keep".
- `Spinner`: `Loader2 size-4 animate-spin` + `text-sm text-muted` label, `role="status"`

### Empty

`EmptyState`: centred `px-6 py-12`, optional icon in a `size-9 rounded-lg border border-border bg-surface-2` tile, `text-base font-medium` title, `max-w-sm text-sm text-muted` description, optional action. **Always says what the thing is and offers the action that would fill it.**

### Error

- `ErrorState`: `role="alert"`, a `size-8 rounded-md border-danger-border bg-danger-soft text-danger` icon tile, title + message, and a **Try again** button. Explains what did not work rather than apologising.
- `FormError` / `FormSuccess`: `rounded-md border px-2.5 py-2 text-sm` in the matching `-soft` / `-border` / text tone, with a `size-3.5` icon.

### Motion

`MotionConfig reducedMotion="user"` at the page level, and a blanket CSS clamp:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

Every keyframe uses `both` fill so it arrives **complete and instant** rather than never arriving. Named animations live in `globals.css`: `.rise`, `.step-land`, `.step-halo`, `.rail-fill`, `.step-say`, `.toast-drain`, `.toast-badge`, `.star-pick`, `.settle-in`, `.wisp`, `.tap-pulse`, `.moment-in/out`, `.ring-bell`, `.stage-pulse`, `.sent-ring/pop/draw/rise`.

**Motion policy:** a confirmation staff see forty times a shift is a line of green text. The only flourish is the guest sending an order — a drawn tick, because "a stroke that completes reads as a decision being made".

---

## 11. Responsive behaviour

Breakpoint usage in source: `sm:` 302× · `lg:` 144× · `xl:` 58× · `md:` 16× · `2xl:` 4×. **`sm` and `lg` carry the design; `md` is incidental.**

- **`lg` is the frame breakpoint.** Below it: sidebar → drawer, settings rail → horizontal scroll strip, `PageHeader` actions stack under the title.
- **`sm` is the content breakpoint.** One column below, two above; `ErrorState` goes row-wise; toasts move to the bottom-right.
- **`xl`** is where analysis layouts split (3-up, 4-up, 5-col spans).
- **Gutters do not change with width** — `px-4` everywhere, on purpose.
- Tables never widen the page: `overflow-x-auto` + `min-w-[38rem]`.
- `min-w-0` is applied on every flex child that contains truncatable text; `truncate` on the text itself.
- Heights use `min-h-svh` / `lg:h-svh`, not `vh`.
- Print: only the receipt reaches paper; the frame is `print:hidden` and `@media print` forces `color-scheme: light`, retoning the whole page in one property.

---

## 12. Reusable patterns

| Pattern | Where |
| --- | --- |
| **Page skeleton** | `<PageHeader>` + `<PageBody>` on every screen without exception |
| **Panel** | `Surface` + `SurfaceHeader` + body, or `Surface` + `TableWrap`/`Table` |
| **Metric strip** | 3–5 `Surface` cells: uppercase `text-2xs` label → `tabular` figure → `text-xs text-muted` hint |
| **Filter chips + count** | `FilterChip` row in a `border-b border-border px-4 py-3` strip above a list — used on restaurants, managers, floor, reservations, reviews |
| **List inside a panel** | `<ul class="flex flex-col divide-y divide-border">`, not spaced cards |
| **Truncation note** | `text-center text-2xs text-subtle` — "the N most recent of M", so a list never silently lies about its scope |
| **Null vs zero** | A missing average renders "Not rated yet", never `0.0`. Consistent across reviews, reports, dashboard. |
| **Relative time + exact on hover** | `sinceLabel()` from [`lib/time/since.ts`](frontend/lib/time/since.ts) with the absolute value in `title` |
| **Derived breadcrumbs** | [`lib/navigation/breadcrumbs.ts`](frontend/lib/navigation/breadcrumbs.ts) — one route table, no page states its own trail |
| **Navigation as data** | [`nav-config.ts`](frontend/components/layout/nav-config.ts), [`settings-nav.ts`](frontend/components/layout/settings-nav.ts) — read by sidebar, drawer *and* landing page, so they cannot disagree |
| **Tone by meaning** | `success` = paid/active/in stock; `warning` = needs attention; `danger` = failed/destructive; `primary` = brand/selected. A count is tinted by what it means, not how large it is. |

---

## 13. Known inconsistencies & duplication

Reported as found, not fixed.

1. **`cn()` is a plain join** — [`lib/utils/cn.ts`](frontend/lib/utils/cn.ts) has **no tailwind-merge**. Conflicting utilities do not resolve by specificity; overriding a base class requires Tailwind's important modifier (**trailing** `!` in Tailwind 4). This is the single most load-bearing quirk for anyone writing new components here.
2. **Four near-identical metric-card components**, none shared: `Stat` in [`dashboard/page.tsx:1218`](frontend/app/(app)/dashboard/page.tsx#L1218), `Stat` in [`admin/reports/page.tsx:792`](frontend/app/(app)/admin/reports/page.tsx#L792), `Figure` in [`reports/page.tsx:387`](frontend/app/(app)/reports/page.tsx#L387), `Stat` in [`settings/inventory/[id]/page.tsx:586`](frontend/app/(app)/settings/inventory/[id]/page.tsx#L586). All use the same label/figure/hint recipe; they differ only in whether the value is a number or a string, and which tones they accept.
3. **Two delta indicators**: `Delta` in [`admin/reports/page.tsx:836`](frontend/app/(app)/admin/reports/page.tsx#L836) shows percentage change; `Movement` in [`reviews/page.tsx`](frontend/app/(app)/reviews/page.tsx) shows tenths of a star. The divergence is *deliberate* (a rating is not a quantity) but the two share no code.
4. **Local time formatters** — several pages carry their own `formatWhen` / `formatTime` alongside the shared `lib/time/since.ts`.
5. **Ad-hoc figure size** — `text-[1.75rem] leading-9` appears in at least two stat components; 28px is not on the type scale.
6. **The public site templates are a separate visual register.** [`features/site/templates/*`](frontend/features/site/templates/) (`aurora`, `terrace`, `press`, `slate`) use raw Tailwind palette values (`bg-stone-200`, `shadow-stone-900/10`), `rounded-2xl`/`rounded-3xl`, `shadow-xl`, `hover:scale-105` and the `text-4xl`–`text-7xl` display sizes. This is by design — they are the guest-facing restaurant website a manager publishes, not the application — but **none of their values are application tokens** and they should not be read as the system.
7. **22 raw hex literals** in TSX, confined to those templates plus [`qr-code.tsx`](frontend/components/ui/qr-code.tsx) and the website settings screen.
8. **Inline `template` strings instead of `cn()`** in a few stat components (e.g. dashboard `Stat` uses a backtick template for its tone class).

---

## 14. Design DNA

What makes every screen read as the same product:

**1. One container, one border, one radius.** Almost everything is `Surface` — `rounded-lg border border-border bg-surface` — with a `px-4 py-3` header strip and a `p-4` body. There is no second card treatment. Depth is expressed by *surface step* (`canvas → surface → surface-2 → surface-3`), not by shadow.

**2. Hairlines, not shadows.** Three shadow depths exist and only float things: dialog, drawer, toast, tooltip. Everything in the page body is separated by a 1px border. The result is flat, dense and calm.

**3. Colour means something.** Six semantic families, each with a `-soft` fill, a `-border` and a text step. A tone is chosen by what a thing *is* (paid, low, cancelled, selected), never by what would look nice, and a colour is never the only signal — badges carry dots, active nav rows carry weight and a marker.

**4. Small type, tabular figures.** The body is 14px, tables are 13px, meta is 11px uppercase. Every number that sits in a column is `tabular`. The scale is tuned for an application, and the display sizes are quarantined to the public site.

**5. Muted, earthy, slightly warm.** Forest green, dark teal, deep ruby, warm amber on a `#f5f4f2` paper or a `#1a1a1a` ground. Even the chart series were hand-paired per theme from the same family rather than taken from a default palette — "a hue that reads as calm on paper-white goes muddy on a dark ground".

**6. Two themes as one decision.** Every colour is a `light-dark()` pair on one line; the theme is one property on one element. Nothing is styled twice, and the two halves cannot drift.

**7. Configuration is data, in one place.** Navigation, settings sections, breadcrumb labels and chart tokens are each declared once and read by everything that needs them, so the sidebar, the drawer, the landing page and the trail can never disagree.

**8. States are first-class, not afterthoughts.** Loading skeletons are shaped like the content they replace. Empty states name the thing and offer the action. Errors explain and retry. Nothing renders zero where it means "unknown".

**9. Motion is feedback, never decoration.** One press scale, one left-to-right chart wipe, a draining toast bar — and a blanket reduced-motion clamp so every animation arrives complete and instant. The one flourish in the product is reserved for the one action a guest performs once.

**10. Honesty on screen.** Lists say how much of the whole they are showing. Counts say what they are counted over. A trail never links to a page that does not exist. Disabled features are labelled rather than hidden or faked.

---

## 15. The Super Admin area

A **scoped palette, not a second design system**. Everything below overrides token *values*; no component, utility or layout rule knows the area exists. Declared in [`app/globals.css`](frontend/app/globals.css) under `:root[data-area="admin"]`, switched on by [`lib/theme/area.ts`](frontend/lib/theme/area.ts) from [`app-shell.tsx`](frontend/components/layout/app-shell.tsx) when the signed-in role is `SuperAdmin`.

Keyed to the **role**, not the URL: the platform overview lives at `/dashboard`, the same route a manager lands on, and it is the account that decides which screen renders. The attribute goes on `<html>`, so portalled overlays — dialog, drawer, tooltip, toast — are inside the scope.

### Palette (light / dark)

| Token | Light | Dark |
| --- | --- | --- |
| `--canvas` | `#ffffff` | `#171314` |
| `--surface` | `#ffffff` | `#201b1c` |
| `--surface-2` | `#faf8f8` | `#241f20` |
| `--surface-3` | `#f4eeee` | `#2c2627` |
| `--border` | `#e4dadb` | `#332c2d` |
| `--border-strong` | `#cfc2c3` | `#6f6465` |
| `--text` | `#171717` | `#f5f0f0` |
| `--text-muted` | `#626262` | `#a9a1a2` |
| `--text-subtle` | `#8a8585` | `#7d7576` |
| `--primary` (type) | `#d13a3a` | `#f08a8a` |
| `--primary-solid` (fill) | `#ef4b4b` | `#ef4b4b` |
| `--primary-hover` | `#d94141` | `#d94141` |
| `--primary-soft` | `#fbe3e4` | `#32201f` |
| `--success` | `#1f7a55` | `#5cc79a` |
| `--warning` | `#8f6414` | `#e0b055` |
| `--danger` | `#b83d50` | `#e08a9c` |

**A white ground, not the blush.** Canvas and surface are both `#ffffff`, so a card *is* its outline — which is why `--border` sits a step darker here (`#e4dadb`) than elsewhere. The warm greys stay on `--surface-2` and `--surface-3`, where a toolbar strip and a table header still need to sit back from the panel containing them.

**Why two of these are not the supplied brand value.** The supplied palette is a brand palette; the tokens are a usage set. `#ef4b4b` is 3.6:1 on white — it clears the 3:1 this product asks of a mark and misses the 4.5:1 it asks of type, and `text-primary` is a breadcrumb, a table link and rows of 11px labels. So the coral splits exactly as the base theme's green does: `#ef4b4b` fills, `#d13a3a` (4.8:1) is type. Success splits the same way — `#38a878` is 3.0:1 and is kept as the chart and dot colour, `#1f7a55` is the type step. Every supplied colour appears, at the step where it is legible.

### Shape

- Radius is **two steps up**: `--radius-lg-base: 0.75rem` against the product's 0.5rem. The scale is declared in `:root` and pointed at from `@theme inline`, so `rounded-lg` paints through `var(--radius-lg-base)` and a scope can retune it.
- Shadows lighten (`--shadow-ink-*` at 0.05–0.14). Panels in the page body carry none; only a dialog, the drawer and a toast float.
- Series: `--chart-1` coral, `--chart-2` charcoal — the two-colour bar language of the references — with the semantic hues behind them for charts that plot more than two things.

### Two area-aware component tokens

| Token | Product | Admin |
| --- | --- | --- |
| `--table-head` | `var(--surface-2)` | `#fcf6f6` (faint brand tint) |
| `--chip-active` / `--chip-active-fg` | `primary-soft` / `primary` | `#2b2526` / `#ffffff` (charcoal pill) |

Consumed by `Th` (`bg-table-head`) and `FilterChip` (`bg-chip-active`), so neither component learns that an area exists. The charcoal selected chip is deliberate: coral is spent on the primary action and on the data, so a filter that also went coral would be a third thing competing at the same volume.

### Admin components

- [`features/platform/kpi.tsx`](frontend/features/platform/kpi.tsx) — `KpiCard`, `KpiRow`, `Delta`. Three-step hierarchy: tinted glyph and quiet label say *what*; the figure at `text-[1.75rem]` tabular is the answer; the movement chip and one line of context say whether the answer is good. `KpiRow` is `sm:grid-cols-2 xl:grid-cols-4`, never 3 — a KPI row is read as a shape and an orphan on the second line breaks it.
- [`features/platform/toolbar.tsx`](frontend/features/platform/toolbar.tsx) — `SearchField` (pill, on `surface-2`, leading glyph) and `Toolbar` (search and controls on one row, filter chips underneath).

These replaced the duplicated `Stat`/`Delta` on the platform overview and the platform report — two of the four near-identical metric cards listed in §13. The manager-side `Stat` and `Figure` are untouched and remain duplicated until that area is redesigned.

### Admin page anatomy

Every Super Admin screen is now: `PageHeader` (title, derived breadcrumb, primary CTA) → `KpiRow` → `Surface` holding `Toolbar` → `Table`, or → chart cards. The platform overview, the restaurants list, the managers list, the platform report and the restaurant detail page all open the same way.

### Untouched by this phase

Manager, waiter, chef, auth and public screens keep the base palette exactly. `Surface`, `Button`, `Badge`, `Input`, `Select`, `Dialog`, `Card`, the state components and the charts were not restyled — they look different inside the admin area only because their tokens resolve differently there.

---

*Source of truth: `frontend/app/globals.css` for tokens, `frontend/components/ui/` for primitives, `frontend/components/layout/` for the frame.*
