# Frontend Architecture — The BLACQList

**Last updated:** 2026-05-07
**Status:** Approved planning document
**Owner:** Frontend Architecture
**Audience:** frontend-builder, QA, dev-ticket-writer

---

## Stack Confirmation

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router | `app/` directory; Server Components by default |
| Language | TypeScript strict + `noUncheckedIndexedAccess` | All files `.ts` / `.tsx` |
| Styling | Tailwind CSS v4 | `@theme` block in CSS; no `tailwind.config.ts` |
| Components | shadcn/ui | NOT yet installed — see init plan below |
| Utilities | `clsx` + `tailwind-merge` | `cn()` exists at `lib/utils.ts` |
| Package manager | pnpm | All install commands use `pnpm` |

---

## shadcn/ui Init Plan

### Tailwind v4 Compatibility

shadcn/ui CLI assumes Tailwind v3 by default. Tailwind v4 requires a manual setup path.

**Do not run `npx shadcn@latest init` with default options.** It will create a `tailwind.config.ts` that conflicts with the existing v4 `@theme` setup.

**Correct approach:**

```
pnpm dlx shadcn@canary init
```

When prompted for Tailwind config style, select **"I'll configure Tailwind manually"** or the CSS variables option. This generates the CSS variable block only — no `tailwind.config.ts`.

The shadcn CLI will add CSS variables to `globals.css` in the form:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84.3% 4.1%;
    /* ... */
  }
}
```

These use HSL channels (no `hsl()` wrapper) — shadcn's convention.

**Required globals.css changes after init:**
1. shadcn adds `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, etc. as HSL channel variables inside `@layer base { :root { } }`.
2. The existing BLACQList `@theme` block uses hex values for brand tokens (`--color-amber-gold: #E2A428;`, etc.).
3. These two systems do NOT conflict — they occupy different namespaces (`--color-*` vs shadcn's bare names).
4. Do NOT remap shadcn's `--primary` to Amber Gold globally. Amber Gold is a CTA color, not a semantic "primary" for components. Use `className` overrides per usage site.
5. The `--radius` variable from shadcn: set to `0.5rem` (8px) to match the brand's 8px corner radius.

**Components to install immediately (required for UI foundation):**
```
pnpm dlx shadcn@canary add button input label form select textarea badge skeleton card dialog sheet dropdown-menu separator toast sonner
```

**Components to install when screens require them:**
```
pnpm dlx shadcn@canary add table checkbox radio-group switch progress alert-dialog command popover scroll-area tabs avatar
```

---

## globals.css Required Changes

After shadcn init, `globals.css` must contain — in this order:

```css
/* 1. Tailwind v4 directives */
@import "tailwindcss";

/* 2. BLACQList brand tokens — in @theme block */
@theme {
  --color-brand-black: #000000;
  --color-deep-bg: #19191E;
  --color-charcoal: #595758;
  --color-amber-gold: #E2A428;
  --color-light-gold: #FFD867;
  --color-pale-lavender: #E9E9F7;
  --color-cream: #FCFAF4;

  --font-headline: var(--font-glacial), sans-serif;
  --font-subhead: var(--font-lato), sans-serif;
  --font-body: var(--font-quicksand), sans-serif;
}

/* 3. shadcn CSS variable block — added by CLI */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84.3% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84.3% 4.1%;
    --radius: 0.5rem;
    /* ... rest of shadcn vars ... */
  }
  .dark { /* ... */ }
}

/* 4. Font-face declarations for Glacial Indifference */
@font-face {
  font-family: 'GlacialIndifference';
  src: url('/fonts/GlacialIndifference-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

/* 5. Global base styles */
@layer base {
  body {
    font-family: var(--font-body);
  }
}
```

**Rule:** Brand token names (`brand-black`, `deep-bg`, etc.) are used in all custom components. shadcn component overrides use `className` props with `cn()`.

---

## Root Layout Changes (`app/layout.tsx`)

The root layout is a Server Component. It:

1. Loads all three fonts via `next/font`
2. Applies font CSS variables to `<html>`
3. Fetches auth session server-side via Supabase
4. Passes `user` and `roles` as props to `PublicHeader`
5. Renders `PublicHeader`, `<main id="main-content">`, `PublicFooter`
6. Wraps everything in a `<Toaster />` for notifications

```
app/layout.tsx (Server Component)
  ├── SkipToContent       ← first child in <body>
  ├── PublicHeader        ← receives user + roles props
  ├── <main id="main-content">
  │     {children}
  └── PublicFooter
  └── <Toaster />         ← sonner, client-side
```

**Font loading pattern:**
```typescript
// app/layout.tsx
import localFont from 'next/font/local'
import { Lato, Quicksand } from 'next/font/google'

const glacial = localFont({
  src: '../public/fonts/GlacialIndifference-Bold.woff2',
  variable: '--font-glacial',
  display: 'swap',
})
const lato = Lato({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-lato' })
const quicksand = Quicksand({ subsets: ['latin'], weight: ['700'], variable: '--font-quicksand' })
```

Apply all three variables to `<html className={cn(glacial.variable, lato.variable, quicksand.variable)}>`.

**Auth pattern in layout:**
```typescript
// app/layout.tsx
const supabase = createServerClient(...)
const { data: { user } } = await supabase.auth.getUser()
let roles: string[] = []
if (user) {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  roles = data?.map(r => r.role) ?? []
}
// Pass user + roles to PublicHeader — do NOT fetch in nav Client Components
```

**Dashboard and Admin layouts override the root layout** via their own `layout.tsx` files at `app/dashboard/layout.tsx` and `app/admin/layout.tsx`. These do not render `PublicHeader` or `PublicFooter`.

---

## MobileNav Architecture

`PublicMobileNav` uses the shadcn `Sheet` primitive (side="right").

**State management:** Sheet open/close state lives in a single `"use client"` component: `components/nav/public-mobile-nav.tsx`.

**Escape key + focus trap:** Handled by Radix UI Dialog (underneath Sheet). No custom implementation needed.

**Close on route change:** Add a `useEffect` that watches `usePathname()` and calls `setOpen(false)` when the path changes.

**Focus return:** Radix Sheet returns focus to the trigger (hamburger button) on close automatically.

**Drawer close on viewport resize:** Add a `useEffect` that listens to `window.matchMedia('(min-width: 768px)')` change events. If it fires true (desktop breakpoint reached), call `setOpen(false)`.

```
PublicMobileNav ("use client")
  State: isOpen (useState)
  ├── <button aria-label="Open navigation" aria-expanded={isOpen}> ← hamburger
  └── <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent side="right" className="bg-deep-bg w-72">
          ├── Logo
          ├── NavLinks (stacked)
          └── AuthNav (Sign In / Sign Up buttons)
```

---

## Client vs. Server Component Boundary Summary

| Component | Type | Reason |
|---|---|---|
| `app/layout.tsx` | Server | Fetches session; no browser APIs |
| `components/layout/container.tsx` | Server | Pure layout wrapper |
| `components/layout/section.tsx` | Server | Pure layout + variant prop |
| `components/layout/page-header.tsx` | Server | Static render; receives props |
| `components/nav/public-header.tsx` | Server | Composes nav; passes props down |
| `components/nav/public-header-client.tsx` | Client | Scroll detection for transparent→solid transition |
| `components/nav/nav-links.tsx` | Client | `usePathname()` for active state |
| `components/nav/auth-nav.tsx` | Client | DropdownMenu requires event handlers |
| `components/nav/public-mobile-nav.tsx` | Client | Sheet open/close state |
| `components/nav/public-footer.tsx` | Server | Static content |
| `components/ui/section-heading.tsx` | Server | Pure display |
| `components/ui/status-badge.tsx` | Server | Pure display; receives tier prop |
| `components/ui/cta-button-group.tsx` | Server | Renders shadcn Buttons; no state |
| `components/ui/empty-state.tsx` | Server | Pure display |
| `components/ui/loading-state.tsx` | Server | Skeleton shimmer is CSS-only |
| `components/ui/error-state.tsx` | Client | `reset()` retry requires event handler |
| `components/ui/card-grid.tsx` | Server | CSS Grid wrapper; no state |
| `components/ui/entity-card.tsx` | Server | Display only; save button extracted separately |

---

## Component Architecture Specs

### 1. `components/layout/container.tsx`

**Type:** Server Component

**Purpose:** Enforces the 960px max-width editorial constraint across all pages.

**Props:**
```typescript
interface ContainerProps {
  children: React.ReactNode
  className?: string
  as?: React.ElementType  // defaults to 'div'; allows 'section', 'article', 'main'
}
```

**Key Tailwind:** `mx-auto w-full max-w-[960px] px-4 md:px-6 lg:px-8`

**shadcn deps:** None

**States:** N/A — structural only

**A11y:** Transparent wrapper; semantics come from `as` prop or children

---

### 2. `components/layout/section.tsx`

**Type:** Server Component

**Purpose:** Consistent vertical padding + background color per design system section rhythm. Every page section wraps its content in this component.

**Props:**
```typescript
type SectionVariant = 'white' | 'cream' | 'deep-bg' | 'pale-lavender' | 'brand-black'

interface SectionProps {
  children: React.ReactNode
  variant?: SectionVariant       // defaults to 'white'
  className?: string
  id?: string                    // for anchor links (page editor sections)
  as?: 'section' | 'div' | 'article'  // defaults to 'section'
}
```

**Key Tailwind:**
- Outer: full-width div with background color class
- Inner: `py-12 md:py-16` vertical padding
- Background map:
  - `white` → `bg-white`
  - `cream` → `bg-[#FCFAF4]`
  - `deep-bg` → `bg-[#19191E]`
  - `pale-lavender` → `bg-[#E9E9F7]`
  - `brand-black` → `bg-black`

**shadcn deps:** None

**States:** N/A

**A11y:** Semantic `<section>` by default; `id` prop enables skip-link targets

---

### 3. `components/layout/page-header.tsx`

**Type:** Server Component

**Purpose:** Page-level h1 + optional subtitle for constrained content pages (About, Collections, Account pages, static pages). Not used on BLACQList Pages (which have their own hero h1) or full-bleed hero pages.

**Props:**
```typescript
interface PageHeaderProps {
  title: string
  subtitle?: string
  className?: string
  align?: 'left' | 'center'   // defaults to 'left'
}
```

**Key Tailwind:**
- Title: `font-headline text-3xl md:text-4xl font-bold text-brand-black`
- Subtitle: `font-subhead text-base md:text-lg text-charcoal mt-2`
- Wrapper: `mb-8`

**shadcn deps:** None

**States:** N/A — receives pre-fetched data as string props

**A11y:** Renders semantic `<h1>`. Only one per page. Pages using this component must not have another `<h1>` in their content.

---

### 4. `components/nav/public-header.tsx`

**Type:** Server Component (shell)

**Purpose:** Desktop nav bar. Fetches nothing itself — receives `user` and `roles` from `app/layout.tsx` as props. Composes `NavLinks`, `AuthNav`, and `PublicMobileNav`.

**Props:**
```typescript
interface PublicHeaderProps {
  user: User | null
  roles: string[]
}
```

**Structure:**
```
PublicHeader (Server)
  └── PublicHeaderClient ("use client")
        ├── NavLinks ("use client") — active link state
        ├── NavSearchExpand ("use client") — inline search expand/collapse
        ├── AuthNav ("use client") — sign-in/up or avatar dropdown
        └── PublicMobileNav ("use client") — hamburger + drawer
```

**Key Tailwind:** `h-16 sticky top-0 z-50 w-full` — `bg-deep-bg` always except homepage transparent state (managed by `PublicHeaderClient`).

**Transparent-on-homepage behavior:** `PublicHeaderClient` receives `isHomepage: boolean` (derived from `usePathname() === '/'`) and `isScrolled` state (from `useEffect` scroll listener with `{ passive: true }`). When `isHomepage && !isScrolled`: `bg-transparent`. Otherwise: `bg-[#19191E]`.

**shadcn deps:** `DropdownMenu` (for avatar), `Sheet` (for mobile drawer, via `PublicMobileNav`)

**States:**
- Default (anonymous): Sign In text link + Sign Up Amber Gold button
- Authenticated supporter: Avatar circular button + dropdown (Saved, Settings, Sign Out)
- Authenticated owner: Avatar circular button + dropdown (My Dashboard, My Page, divider, Saved, Settings, Sign Out)
- Transparent (homepage pre-scroll): `bg-transparent`
- Solid (all other): `bg-[#19191E]`

**A11y:**
- `<nav aria-label="Main navigation">` wrapper
- Skip-to-content link is the first focusable element in `<body>` (see `SkipToContent` component — separate from PublicHeader)
- Active nav link: `aria-current="page"` on the matching link
- Hamburger: `aria-label="Open navigation"` + `aria-expanded={isOpen}`

---

### 5. `components/nav/public-mobile-nav.tsx`

**Type:** Client Component (`"use client"`)

**Purpose:** Hamburger trigger + full-screen drawer for mobile nav.

**Props:**
```typescript
interface PublicMobileNavProps {
  user: User | null
  roles: string[]
}
```

**State:** `isOpen: boolean` via `useState`

**Key Tailwind (drawer):** `bg-[#19191E] text-white w-full max-w-[320px] sm:max-w-[320px]` (full width below 480px via SheetContent className)

**shadcn deps:** `Sheet`, `SheetContent`, `SheetHeader` — Radix Dialog underneath handles focus trap and Escape key.

**Close triggers:**
- `SheetContent` close button (×)
- Tap outside (Radix default)
- Route change: `useEffect(() => setOpen(false), [pathname])`
- Viewport resize to desktop: `useEffect` on `matchMedia` change

**Drawer content order:**
1. Logo (links to `/`)
2. Nav links: Discover, Search, Cities (→ `/city/atlanta`), For Business — each 48px tap target
3. Divider (`<Separator />` from shadcn)
4. Sign In — full-width ghost button OR authenticated user name + links
5. Sign Up — full-width Amber Gold button (anonymous only)

**A11y:**
- Hamburger button: `aria-label="Open navigation"` + `aria-expanded={isOpen}`
- Focus trap: Radix Dialog handles this automatically
- Focus return: Radix returns focus to trigger on close automatically
- Escape key: handled by Radix

---

### 6. `components/nav/public-footer.tsx`

**Type:** Server Component

**Purpose:** Full platform footer — four-column grid + tagline + social icons + legal row.

**Props:**
```typescript
interface PublicFooterProps {
  className?: string
}
// No dynamic data props — all content is static/hardcoded
```

**Key Tailwind:**
- Outer: `bg-black text-white`
- Column grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8`
- Column headings: `font-subhead font-bold text-[#E2A428] text-sm uppercase tracking-wide mb-3`
- Links: `text-[#9CA3AF] hover:text-white text-sm transition-colors`
- V1+ items (dimmed): `text-charcoal cursor-default pointer-events-none`

**shadcn deps:** `Separator` (for legal row divider)

**States:** Static — no loading/empty/error states needed

**Phase handling:** V1+ footer links render with `text-charcoal` and no hover effect. They link to a `/coming-soon` holding page or a `#` placeholder. They are not hidden — they communicate roadmap intent.

**A11y:**
- `<footer aria-label="Site footer">`
- All links are `<a>` elements with descriptive text
- Column headings use `<h3>` (within footer context, below page `<h1>` and `<h2>`)
- Social icon links: `aria-label="The BLACQList on [Platform]"`

---

### 7. `components/ui/section-heading.tsx`

**Type:** Server Component

**Purpose:** Standardizes h2/h3 section headings across all page sections. Handles color for dark vs. light backgrounds.

**Props:**
```typescript
interface SectionHeadingProps {
  children: React.ReactNode
  level?: 2 | 3               // defaults to 2; renders h2 or h3
  onDark?: boolean            // true = white text; false = brand-black text (default)
  subtitle?: string           // optional Lato Regular subtitle below
  className?: string
  align?: 'left' | 'center'  // defaults to 'left'
}
```

**Key Tailwind:**
- h2: `font-headline text-2xl md:text-[28px] font-bold leading-tight`
- h3: `font-headline text-lg md:text-xl font-bold leading-tight`
- Light bg: `text-brand-black`
- Dark bg: `text-white`
- Subtitle: `font-subhead text-base text-charcoal mt-1` (always charcoal — only used on light backgrounds)

**shadcn deps:** None

**States:** N/A

**A11y:** Renders semantic heading. Heading level must match page hierarchy — caller is responsible for correct level selection. Never skip heading levels.

---

### 8. `components/ui/status-badge.tsx`

**Type:** Server Component

**Purpose:** Trust tier pill badge. Used on listing cards, BLACQList Page heroes, and Trust sections.

**Props:**
```typescript
type TrustTier = 'unclaimed' | 'claimed' | 'verified' | 'certified'
type BadgeSize = 'small' | 'standard'

interface StatusBadgeProps {
  tier: TrustTier
  size?: BadgeSize            // defaults to 'small'
  className?: string
}
```

**Visual specs (from design system):**

| Tier | Background | Text color | Icon | Text |
|---|---|---|---|---|
| `unclaimed` | `#595758` | white | none | "Unclaimed" |
| `claimed` | `#3B82F6` | white | checkmark | "Claimed" |
| `verified` | `#D4A017` | `#000000` | checkmark | "Verified" |
| `certified` | `#E2A428` | `#000000` | star | "BLACQList Certified" |

**Size specs:**
- `small`: `h-[26px] px-2 text-xs` — hero overlay + listing cards
- `standard`: `h-[32px] px-3 text-sm` — Trust section

**shadcn deps:** `Badge` (use as base; override colors via `className`)

**A11y:**
- `role="status"` on the badge container
- Icon within badge: `aria-hidden="true"` (icon is decorative; text is the accessible label)
- Color contrast: all tier combinations pass WCAG AA (see design-brief.md Section 16.5)

---

### 9. `components/ui/cta-button-group.tsx`

**Type:** Server Component

**Purpose:** Standardizes the primary + optional secondary CTA button pair pattern used across marketing and BLACQList pages.

**Props:**
```typescript
interface CtaButtonGroupProps {
  primary: {
    label: string
    href: string
    onClick?: never          // href-based only in this component
  }
  secondary?: {
    label: string
    href: string
    variant?: 'ghost' | 'outline'  // defaults to 'outline'
  }
  align?: 'left' | 'center' | 'right'  // defaults to 'left'
  className?: string
  stackOnMobile?: boolean   // defaults to true — stacks vertically below md
}
```

**Key Tailwind:**
- Wrapper: `flex gap-3` + conditional `flex-col md:flex-row` if `stackOnMobile`
- Primary button: `bg-[#E2A428] text-black font-body font-bold hover:bg-[#FFD867] rounded-full px-6 py-2`
- Secondary (outline): `border border-white text-white hover:bg-white/10 rounded-full px-6 py-2`

**shadcn deps:** `Button` (both buttons use shadcn Button with className overrides)

**States:**
- Default: renders both or primary-only
- Loading: not applicable — navigation buttons, not form submit buttons
- This component does NOT handle form submit loading states. Use `FormSubmitButton` (separate) for that.

**A11y:** Both buttons render as `<a>` (since `href` is provided) — shadcn Button with `asChild` + Next.js `Link`. Descriptive label text required by caller.

---

### 10. `components/ui/empty-state.tsx`

**Type:** Server Component

**Purpose:** Consistent empty state display across all data-dependent views (search, saved, tables, admin queues).

**Props:**
```typescript
interface EmptyStateProps {
  heading: string
  body?: string
  action?: {
    label: string
    href: string
  }
  secondaryAction?: {
    label: string
    href: string
  }
  icon?: React.ReactNode     // optional illustrative icon
  className?: string
}
```

**Key Tailwind:**
- Container: `flex flex-col items-center text-center py-16 px-4 gap-4`
- Heading: `font-headline text-xl font-bold text-brand-black`
- Body: `font-subhead text-charcoal text-sm max-w-[360px]`
- Action button: Amber Gold (`bg-[#E2A428] text-black`)
- Secondary: text link in Amber Gold

**shadcn deps:** `Button`

**States:** This IS a state component — it IS the empty state. No internal states.

**A11y:** `role="status"` or `aria-live="polite"` if it appears after a data fetch attempt. Heading is `<p>` or `<h2>` depending on context — caller decides via semantic HTML in the content.

---

### 11. `components/ui/loading-state.tsx`

**Type:** Server Component

**Purpose:** Skeleton shimmer for known-shape content regions. Exported as a set of named skeleton variants, not one generic component.

**Exports:**
```typescript
// Named skeleton variants — not a single generic component
export function ListingCardSkeleton(): JSX.Element   // matches EntityCard shape
export function StatCardSkeleton(): JSX.Element      // matches dashboard stat card
export function TableRowSkeleton({ cols }: { cols: number }): JSX.Element
export function SectionSkeleton(): JSX.Element       // full-section shimmer block
export function HeroSkeleton(): JSX.Element          // full-bleed hero placeholder
```

**Key Tailwind:** All skeletons use shadcn `Skeleton` component. Each matches the spatial dimensions of the loaded content — height, width, border-radius, and spacing must mirror the actual component.

**shadcn deps:** `Skeleton`

**States:** N/A — these ARE the loading states

**A11y:** `aria-hidden="true"` on skeleton containers — they are visual only. The `<Suspense>` boundary wrapping the actual content provides the accessible loading context via `aria-busy` on the container (handled by Suspense).

---

### 12. `components/ui/error-state.tsx`

**Type:** Client Component (`"use client"`)

**Purpose:** Error display with retry action. Used in `error.tsx` boundaries and inline within data-fetching components that fail.

**Props:**
```typescript
interface ErrorStateProps {
  heading?: string            // defaults to "Something went wrong."
  body?: string               // defaults to generic message
  reset?: () => void          // from Next.js error.tsx boundary
  homeHref?: string           // defaults to '/'
  className?: string
}
```

**Must be Client Component** because the `reset()` function from Next.js error boundaries requires a click handler.

**Key Tailwind:**
- Container: `flex flex-col items-center text-center py-16 px-4 gap-4`
- Heading: `font-headline text-xl text-brand-black`
- Body: `font-subhead text-charcoal text-sm`
- Retry button: Amber Gold
- Home link: ghost/outline

**shadcn deps:** `Button`

**States:** This IS the error state. No internal loading states.

**A11y:** `role="alert"` on the container — error messages should be announced by screen readers.

---

### 13. `components/ui/card-grid.tsx`

**Type:** Server Component

**Purpose:** Responsive CSS grid wrapper used for listing cards, product cards, category tiles, and any uniformly-sized card collection.

**Props:**
```typescript
type GridColumns = 1 | 2 | 3 | 4

interface CardGridProps {
  children: React.ReactNode
  cols?: {
    base?: GridColumns     // default 1
    sm?: GridColumns       // default 2
    lg?: GridColumns       // default 3
  }
  gap?: 'sm' | 'md' | 'lg'  // sm=gap-3, md=gap-4, lg=gap-6 — default 'md'
  className?: string
}
```

**Key Tailwind:** `grid` + dynamic col classes. The component maps the `cols` prop to Tailwind grid-cols classes. Uses `cn()` for conditional class application.

**Common presets:**
- Listing cards: `{ base: 1, sm: 2, lg: 3 }` — the standard card grid
- Dashboard stats: `{ base: 1, sm: 2, lg: 4 }`
- Category tiles: `{ base: 2, sm: 3, lg: 5 }`

**shadcn deps:** None

**States:** N/A — structural only. Empty and loading states live in the parent that decides whether to render `CardGrid` at all.

**A11y:** Transparent wrapper. Semantic meaning comes from children. If rendering a list of links/cards, wrap children in `<ul>/<li>` or use `as="ul"` via an `as` prop addition if needed.

---

### 14. `components/ui/entity-card.tsx`

**Type:** Server Component

**Purpose:** The primary listing card used across search results, discovery, city pages, collection pages, and related discovery rows. This is the most-rendered component in the product.

**Props:**
```typescript
interface EntityCardProps {
  id: string
  name: string
  slug: string
  citySlug: string
  entityType: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
  coverImageUrl: string | null
  category: string
  city: string
  trustTier: TrustTier
  isSaved?: boolean           // undefined = unauthenticated (show save icon, auth-gate on click)
  isFeatured?: boolean        // shows Featured badge (outline Amber Gold pill)
  isSponsored?: boolean       // shows Sponsored badge
  className?: string
}
```

**Structure:**
```
EntityCard (Server)
  ├── Card image area (relative)
  │     ├── Next.js Image (cover, object-cover, 16:9)
  │     ├── StatusBadge (trust tier) — lower-left
  │     ├── FeaturedBadge (if isFeatured) — upper-right
  │     └── SaveIconButton ("use client") — upper-right
  └── Card content area
        ├── Name (font-headline, 15px, brand-black)
        ├── Category (font-subhead, 13px, charcoal)
        └── City (font-subhead, 13px, charcoal)
```

**Important:** `SaveIconButton` is a nested Client Component. The card itself stays Server. The save icon is extracted into its own file (`components/ui/save-icon-button.tsx`) with `"use client"`. The Server Component passes it the `id` and `isSaved` props.

**Route:** The full card is wrapped in `<Link href={`/${citySlug}/business/${slug}`}>` (or the appropriate route by entity type). The save button uses `event.stopPropagation()` to prevent card navigation on save tap.

**Key Tailwind:**
- Card: `rounded-lg border border-[#E9E9F7] overflow-hidden hover:shadow-md transition-shadow cursor-pointer`
- Image wrapper: `relative aspect-video w-full bg-charcoal`
- Content: `p-3`
- Name: `font-headline text-[15px] font-bold text-brand-black line-clamp-2`
- Meta: `font-subhead text-[13px] text-charcoal mt-1`

**shadcn deps:** `Card`, `CardContent` (used as base; overridden via className)

**States:**

| State | Implementation |
|---|---|
| Loading | `ListingCardSkeleton` — use instead of this component |
| No cover image | Placeholder div with charcoal background + centered text initials of business name |
| Error | Does not apply — card receives pre-fetched data; if data fetch fails, parent handles it |
| Saved | `SaveIconButton` shows filled icon; fires optimistic update |
| Unsaved | `SaveIconButton` shows outline icon |
| Unauthenticated save attempt | `SaveIconButton` opens sign-in modal via `useSignInModal()` hook |

**A11y:**
- Card link: `aria-label={`View ${name} listing`}` on the wrapper `<Link>`
- Cover image: `alt={`${name} — cover photo`}`
- Save button (in `SaveIconButton`): dynamic `aria-label` — "Save [Name]" when unsaved, "Remove [Name] from saved" when saved
- Trust badge: `role="status"` + text visible (never color-only)
- `SaveIconButton` icon: `aria-hidden="true"` — label on the button itself provides the accessible meaning

---

## State Management Summary

| State type | Location | Tool |
|---|---|---|
| Server data (listings, collections, session) | Server Components | Supabase + `async/await` in page Server Components |
| URL-driven filters (search, discover, admin tables) | URL search params | `useSearchParams` + `useRouter` in Client Components |
| Form state | Client Components | `react-hook-form` + `zod` |
| Optimistic UI (save toggle, service reorder) | Client Components | `useOptimistic` (React 19) |
| Local UI state (modals, drawers, open/close) | Client Components | `useState` |
| Draft persistence (add-business form) | localStorage | `useEffect` + `localStorage` |
| Auth state | Server → props | Fetched in `app/layout.tsx`, passed as props |
| Toast notifications | Global | Sonner via `<Toaster />` in root layout |

---

## Loading, Empty, Error, Success — by Component

| Component | Loading | Empty | Error | Success |
|---|---|---|---|---|
| `EntityCard` | `ListingCardSkeleton` | N/A (parent handles) | N/A (parent handles) | Card renders |
| `CardGrid` of listings | N/A — wrap in `<Suspense fallback={<CardGridSkeleton />}>` | `<EmptyState>` from parent | `error.tsx` boundary | Grid renders |
| `PublicHeader` | No loading state — session fetch is fast; SSR | N/A | Falls back to anonymous state | Renders with correct auth state |
| `PublicFooter` | N/A | N/A | N/A | Static |
| `StatusBadge` | N/A | N/A | N/A | Badge renders |
| `EmptyState` | N/A | This IS the empty state | N/A | N/A |
| `LoadingState` (skeletons) | This IS the loading state | N/A | N/A | N/A |
| `ErrorState` | N/A | N/A | This IS the error state | N/A |

---

## Accessibility Summary

| Component | Key requirement |
|---|---|
| All forms (future) | Every input has `<FormLabel>`; errors use `aria-describedby`; required fields marked |
| `PublicHeader` | `<nav aria-label="Main navigation">`; active link `aria-current="page"` |
| `PublicMobileNav` | Hamburger: `aria-label` + `aria-expanded`; focus trap via Radix; focus returns to trigger |
| `PublicFooter` | `<footer aria-label="Site footer">`; social links have `aria-label` |
| `EntityCard` | Card link `aria-label`; image `alt`; save button dynamic `aria-label`; badge `role="status"` |
| `StatusBadge` | `role="status"`; icon `aria-hidden`; text always present |
| `ErrorState` | `role="alert"` |
| `EmptyState` | `role="status"` if dynamically appearing post-fetch |
| `SectionHeading` | Correct `<h2>` or `<h3>` — never skip levels |
| Icon-only buttons | `aria-label` required on every instance |
| Color as status | Never color-only — text label always accompanies color signal |

---

## Responsive Behavior

| Component | Mobile (base) | Tablet (`md:`) | Desktop (`lg:`) |
|---|---|---|---|
| `Container` | Full width, 16px padding | Full width, 24px padding | 960px max-w, 32px padding |
| `Section` | `py-12` | `py-14` | `py-16` |
| `PublicHeader` | 56px, hamburger + logo | 56px, hamburger | 64px, full nav links |
| `PublicMobileNav` | Full-screen drawer | Drawer (320px wide) | Hidden |
| `PublicFooter` | Single column | 2-column grid | 4-column grid |
| `CardGrid` (listings) | 1 col | 2 col | 3 col |
| `EntityCard` | Full width | Card in 2-col | Card in 3-col |
| `PageHeader` | `text-2xl` | `text-3xl` | `text-4xl` |

---

## Implementation Order

1. **Init:** Install shadcn/ui via canary CLI. Add CSS variables to `globals.css`. Confirm `cn()` works with Tailwind v4. Verify font loading in `app/layout.tsx`.
2. **Container + Section:** These are prerequisites for every other component. Build and verify the 960px constraint and section backgrounds.
3. **SkipToContent:** First focusable element in `<body>`. One-liner but must be in place before any a11y review.
4. **PublicHeader shell:** Server Component only, no auth state yet. Static logo + placeholder nav links.
5. **NavLinks:** Active state via `usePathname()`.
6. **PublicMobileNav:** Sheet + focus trap. Test Escape, close on route change, viewport resize.
7. **AuthNav:** DropdownMenu with anonymous and authenticated states. Requires Supabase auth integration.
8. **PublicFooter:** Static content. Four columns. Phase-dimmed links.
9. **StatusBadge:** Used in EntityCard — must exist before card.
10. **EntityCard:** Highest-frequency component. Build with placeholder save button first; wire save behavior later.
11. **CardGrid:** Structural wrapper. Simple after Container exists.
12. **Section + SectionHeading:** Section rhythm established; headings styled.
13. **PageHeader:** For inner pages. After shell exists.
14. **EmptyState, LoadingState, ErrorState:** Build as a set — these come as a trio for every data-dependent view.
15. **CtaButtonGroup:** Used on marketing pages — needed before homepage.
