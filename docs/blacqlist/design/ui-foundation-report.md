# UI Foundation Report — The BLACQList

**Date:** 2026-05-07
**Phase:** UI Foundation (pre-feature)
**Status:** Complete

---

## 1. Overview

This report documents the UI foundation layer built for The BLACQList before product feature development begins. It covers every component created, the design decisions behind them, the component boundary strategy, and verification results.

The foundation is intentionally minimal — no feature logic, no real data, no dashboards. It establishes the visual language, layout primitives, navigation shell, and reusable UI atoms that all subsequent feature tickets build on top of.

---

## 2. Design Direction

**Voice:** Polished, modern, warm, editorial, premium — but approachable. Not corporate or clinical. Not a generic SaaS product.

**Color application:**

- `#19191E` Deep Background — nav, hero sections, dark feature bands
- `#000000` Brand Black — editorial headings on light backgrounds, footer
- `#E2A428` Amber Gold — **primary CTAs only** (Sign Up, Claim Your Page, primary actions). Never decorative.
- `#FFD867` Light Gold — Amber Gold hover states only
- `#595758` Charcoal — secondary text, metadata, muted labels
- `#E9E9F7` Pale Lavender — subtle light section backgrounds
- `#FCFAF4` Cream — text on dark, warm section backgrounds

**Typography hierarchy:**

- Headlines: Glacial Indifference Bold (self-hosted) via `font-headline` — currently falling back to `sans-serif` until font file is placed at `public/fonts/glacial-indifference/GlacialIndifference-Bold.otf`
- Subheads / UI labels: Lato via `font-subhead` — loaded via `next/font/google`
- Body / tags: Quicksand via `font-body` — loaded via `next/font/google`

**Max content width:** 960px centered — editorial, narrower than typical SaaS to keep line lengths readable and the content feeling curated.

**Motion:** No animations added. Hover/focus transitions only (`transition-colors`). This is intentional — motion can be added per-feature when it serves a purpose.

---

## 3. Architecture Decisions

### Server vs. Client Components

| Component                  | Boundary       | Reason                                                               |
| -------------------------- | -------------- | -------------------------------------------------------------------- |
| `PublicHeader`             | Server         | Static nav structure; no state required                              |
| `MobileNav`                | `"use client"` | Sheet open/close state + `usePathname` for route-change close        |
| `PublicFooter`             | Server         | Static content only                                                  |
| `Container`                | Server         | Pure layout, no interactivity                                        |
| `Section`                  | Server         | Pure layout, no interactivity                                        |
| `PageHeader`               | Server         | Semantic heading, no interactivity                                   |
| `SectionHeading`           | Server         | Semantic heading, no interactivity                                   |
| `StatusBadge`              | Server         | Static trust tier display                                            |
| `CTAButtonGroup`           | Server         | `asChild` + `Link` — no browser state                                |
| `EmptyState`               | Server         | Static informational display                                         |
| `CardGrid`                 | Server         | Layout wrapper only                                                  |
| `LoadingState` (skeletons) | Server         | Static shimmer — `aria-hidden`                                       |
| `ErrorState`               | `"use client"` | `reset` callback must be passed; `role="alert"`                      |
| `SaveIconButton`           | `"use client"` | Optimistic toggle state + `event.stopPropagation()`                  |
| `EntityCard`               | Server         | `Link` wrapping — no state; SaveIconButton is a client island inside |

### Fixed Header Offset

The header is `fixed` at `z-50`. The root layout's `<main>` has `pt-14 md:pt-16` (56px mobile / 64px desktop) to push page content below the header. This avoids the content-behind-header problem without requiring `sticky` or scroll-compensation JS.

---

## 4. Components

### 4.1 Layout Primitives

#### `components/layout/container.tsx`

Constrains content to 960px centered. Accepts a polymorphic `as` prop (default `div`).

```
max-w-[960px] mx-auto w-full px-4 md:px-6 lg:px-8
```

Usage: wrap every Section's content. Never apply max-width directly to Section — Section bleeds full-width for background colors; Container constrains the content inside it.

#### `components/layout/section.tsx`

Full-bleed background wrapper with named variants. Outer div bleeds full-width; inner Container constrains content to 960px with `py-12 md:py-16` vertical padding.

| Variant           | Background |
| ----------------- | ---------- |
| `white` (default) | `#ffffff`  |
| `cream`           | `#FCFAF4`  |
| `deep-bg`         | `#19191E`  |
| `pale-lavender`   | `#E9E9F7`  |
| `brand-black`     | `#000000`  |

#### `components/layout/page-header.tsx`

Semantic `h1` with optional subtitle. Used at the top of authenticated or content pages.

- `h1`: `font-headline text-3xl md:text-4xl font-bold text-brand-black leading-tight`
- Subtitle: `font-subhead text-base md:text-lg text-charcoal mt-2`

---

### 4.2 Navigation

#### `components/nav/public-header.tsx`

Fixed top navigation. Height 56px mobile / 64px desktop. Background `bg-deep-bg`.

- Logo: `font-headline text-white` → links to `/`
- Desktop nav: Discover, Search, Cities, For Business — `text-cream hover:text-amber-gold`
- Desktop right: Search icon link, Sign In text link, Sign Up Amber Gold button
- Mobile: Search icon + `MobileNav` hamburger (no desktop nav links shown)
- Active page highlighting: deferred — requires a `"use client"` wrapper using `usePathname`; planned for Ticket 015 app shell

#### `components/nav/mobile-nav.tsx` — `"use client"`

Radix-based Sheet drawer. Opens from the right on mobile.

- Hamburger button: `aria-label="Open navigation menu"`, `aria-expanded={isOpen}`
- Sheet has a visually-hidden `SheetTitle` for Radix Dialog accessibility requirements
- Nav links: 48px tap targets, `text-cream hover:text-amber-gold`
- Below separator: Sign In ghost button, Sign Up Amber Gold button
- Auto-close on route change via `usePathname` effect

#### `components/nav/public-footer.tsx`

4-column footer grid. Background `bg-black`.

- Tagline "Find & Be Found." in `font-headline text-3xl text-cream`
- Social links: Instagram (inline SVG), X (Lucide), LinkedIn (inline SVG), TikTok (inline SVG) — `lucide-react` at the installed version doesn't include these platform icons
- 4 columns: Platform, For Businesses, Company, Community
- Active links: `text-gray-400 hover:text-white` as `<Link>`
- Coming-soon links: `text-charcoal pointer-events-none` as `<span aria-label="[name] (coming soon)">`
- Legal row: copyright + Privacy Policy, Terms of Service, Cookie Policy

---

### 4.3 UI Atoms

#### `components/ui/section-heading.tsx`

`h2` or `h3` heading with optional subtitle. Supports `onDark` mode for use inside dark sections.

- Heading: `font-headline text-[22px] md:text-[28px] font-bold leading-tight`
- Light: `text-brand-black`; Dark: `text-white`
- Subtitle: `font-subhead text-base md:text-lg` — `text-charcoal` (light) / `text-cream/80` (dark)

#### `components/ui/status-badge.tsx`

Trust tier status pills for business listings. Four tiers, two sizes.

| Tier        | Background   | Text          | Icon      |
| ----------- | ------------ | ------------- | --------- |
| `unclaimed` | `charcoal`   | white         | none      |
| `claimed`   | blue-600     | white         | checkmark |
| `verified`  | white border | `brand-black` | checkmark |
| `certified` | `amber-gold` | `brand-black` | star      |

- ARIA: `role="status"`, icon `aria-hidden="true"`, visible text label always present
- Sizes: `small` (h-[26px]) and `standard` (h-[32px])

#### `components/ui/cta-button-group.tsx`

Standardized primary + optional secondary CTA pair. Used in hero sections and empty states.

- Primary: `bg-amber-gold text-brand-black hover:bg-light-gold rounded-full px-6 py-2.5 min-h-[44px]`
- Secondary (ghost): `border border-white/50 text-white hover:bg-white/10 rounded-full px-6 py-2.5 min-h-[44px]`
- Stacks vertically on mobile, row on `sm:` breakpoint
- Uses `Button asChild` + `Link` for proper Next.js navigation

#### `components/ui/empty-state.tsx`

Standard empty state with icon, heading, body, and optional CTA.

- Layout: `flex flex-col items-center text-center py-16 px-4 gap-4`
- Icon slot: 48px wrapper, accepts any React node
- Heading: `font-headline`, Body: `font-body text-charcoal`
- CTA: Amber Gold rounded-full button with optional `href`

#### `components/ui/card-grid.tsx`

Responsive grid wrapper. Uses a static column lookup table to prevent Tailwind purging dynamically-constructed class names.

- Columns 1–4 configurable at base, `sm:`, and `lg:` breakpoints
- Gap sizes: `sm` (gap-3), `md` (gap-4, default), `lg` (gap-6)

**Why static lookup:** Tailwind v4 (like v3) purges class strings that aren't statically analyzable. Template literals like `` `grid-cols-${n}` `` would be removed at build time. The `GRID_COLS_MAP` object lists all possible class combinations explicitly.

#### `components/ui/loading-state.tsx`

Named skeleton exports for each common UI structure. All wrapped in `aria-hidden="true"`.

| Export                       | Mirrors                                         |
| ---------------------------- | ----------------------------------------------- |
| `ListingCardSkeleton`        | `EntityCard` (image + content rows)             |
| `SectionSkeleton({ lines })` | Section with title + N text lines               |
| `HeroSkeleton`               | Profile hero (image + name + tagline)           |
| `StatCardSkeleton`           | Dashboard stat card (label + number + sublabel) |

#### `components/ui/error-state.tsx` — `"use client"`

Centered error display with `role="alert"` for screen reader announcement.

- Props: `heading`, `body`, optional `reset` callback, optional `homeHref`
- Primary action (if `reset` provided): Amber Gold "Try again" button
- Secondary: text link back to `homeHref` (default `/`)

#### `components/ui/save-icon-button.tsx` — `"use client"`

Bookmark toggle for saved business listings. Positioned `absolute top-2 right-2` inside `EntityCard`.

- Props: `entityId`, `name`, `initialIsSaved`
- Optimistic state toggle via `useState`; calls `event.stopPropagation()` to prevent card link navigation
- `aria-label` dynamically updates: "Save [name]" / "Remove [name] from saved"
- Contains `// TODO: Replace with real API call when Ticket 045 is ready`

#### `components/ui/entity-card.tsx`

Business / entity listing card. Server Component with an embedded `SaveIconButton` client island.

- Full card wrapped in `<Link>` to `/${citySlug}/${entityType ?? "business"}/${slug}`
- Cover image: `next/image` with `fill` + `object-cover`; fallback: `bg-charcoal` + uppercase initials
- Trust badge: `StatusBadge` at `absolute bottom-2 left-2`
- Save button: `SaveIconButton` at `absolute top-2 right-2`
- Featured badge: outlined Amber Gold pill at `absolute top-2 left-2` (shown when `featured={true}`)
- Name: `font-headline text-[15px] line-clamp-2`
- Category + city: `font-subhead text-[13px] text-charcoal`

---

### 4.4 shadcn/ui Base Components

Installed via `shadcn@4.7.0` (Tailwind v4 compatible):

| Component   | File                          | Used By                                           |
| ----------- | ----------------------------- | ------------------------------------------------- |
| `Button`    | `components/ui/button.tsx`    | CTAButtonGroup, MobileNav, ErrorState, EmptyState |
| `Badge`     | `components/ui/badge.tsx`     | Available for future use                          |
| `Skeleton`  | `components/ui/skeleton.tsx`  | LoadingState skeletons                            |
| `Sheet`     | `components/ui/sheet.tsx`     | MobileNav drawer                                  |
| `Separator` | `components/ui/separator.tsx` | MobileNav sheet interior                          |

Additional packages installed:

- `class-variance-authority@0.7.1` — required by Button and Badge CVA variants
- `lucide-react@1.14.0` — icons (Search, Bookmark, BookmarkCheck, Star, CheckCircle, X, etc.)
- `@radix-ui/react-slot` — Button `asChild` prop
- `@radix-ui/react-dialog` — Sheet (via shadcn)
- `@radix-ui/react-separator` — Separator (via shadcn)

---

## 5. App Shell Integration

`app/layout.tsx` now renders:

```
<html>
  <body className="min-h-full bg-white text-foreground flex flex-col">
    <PublicHeader />           ← fixed, z-50
    <main className="flex-1 pt-14 md:pt-16">
      {children}               ← page content
    </main>
    <PublicFooter />           ← sticks to bottom via flex-col + flex-1
  </body>
</html>
```

`app/page.tsx` (placeholder) uses `Container` and a `min-h-[calc(100svh-...)]` section to fill the viewport below the header.

---

## 6. What Is Deferred

These are intentionally not in scope for the UI foundation:

| Deferred item                     | Reason                                                       | Ticket    |
| --------------------------------- | ------------------------------------------------------------ | --------- |
| Active nav link highlight         | Requires `usePathname` client wrapper — feature-page concern | 015       |
| Glacial Indifference font         | Requires manual download (not on Google Fonts)               | 001 notes |
| AuthenticatedLayout (sidebar nav) | Not needed until dashboard features begin                    | 020+      |
| Real API calls in SaveIconButton  | Backend not ready                                            | 045       |
| Modal dialogs, toasts, alerts     | Per-feature — built as needed                                | 015+      |
| Dark mode                         | Not in product brief                                         | Later     |

---

## 7. Verification

| Check                                    | Result                              |
| ---------------------------------------- | ----------------------------------- |
| `pnpm tsc --noEmit`                      | ✓ Zero errors                       |
| `pnpm lint`                              | ✓ Zero errors                       |
| App shell (header + footer + main) wired | ✓ `app/layout.tsx` updated          |
| Placeholder homepage uses Container      | ✓ `app/page.tsx` updated            |
| All 15 requested components created      | ✓ See Section 4                     |
| No product features implemented          | ✓                                   |
| No real API calls                        | ✓ (SaveIconButton has TODO comment) |
| Amber Gold used only for CTAs            | ✓                                   |
| shadcn/ui components as base             | ✓                                   |
| TypeScript: no `any`, all props typed    | ✓                                   |
| Server Components by default             | ✓ (3 client components only)        |
| Mobile tap targets ≥ 44px                | ✓                                   |

---

## 8. Files Created

**Layout:**

- `components/layout/container.tsx`
- `components/layout/section.tsx`
- `components/layout/page-header.tsx`

**Navigation:**

- `components/nav/public-header.tsx`
- `components/nav/mobile-nav.tsx`
- `components/nav/public-footer.tsx`

**UI atoms (custom):**

- `components/ui/section-heading.tsx`
- `components/ui/status-badge.tsx`
- `components/ui/cta-button-group.tsx`
- `components/ui/empty-state.tsx`
- `components/ui/card-grid.tsx`
- `components/ui/loading-state.tsx`
- `components/ui/error-state.tsx`
- `components/ui/save-icon-button.tsx`
- `components/ui/entity-card.tsx`

**shadcn/ui base:**

- `components/ui/button.tsx`
- `components/ui/badge.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/sheet.tsx`
- `components/ui/separator.tsx`

**App shell:**

- `app/layout.tsx` — updated with PublicHeader + PublicFooter
- `app/page.tsx` — updated to use Container

---

## 9. Next Step

**Ticket 015:** App shell build-out — authenticated layout, public homepage sections, and first feature pages. The UI foundation components are now available as the building blocks for all subsequent tickets.
