# Ticket 019: 404, Error Boundary, and Route-Level Loading Pages

## Status
Draft

## Phase
Phase 2: Public Marketing and Discovery Shell

## Priority
P1

## Feature Area
Frontend Shell

## Context
Every user-facing route in the Next.js App Router must handle three failure states explicitly: page not found (404), unexpected runtime errors (error boundaries), and in-flight data loading (Suspense fallbacks). Without these, users who hit a dead URL, a server error, or a slow data fetch see a blank white screen or a raw Next.js default error page — both of which are off-brand and disorienting. This ticket implements the complete set of fallback pages across all relevant route segments. Source: `docs/blacqlist/ux/empty-loading-error-success-states.md` (error and loading states), `docs/blacqlist/ux/mvp-screen-map.md` (route inventory).

## User Story
As a visitor, when I reach a page that does not exist, encounter an application error, or wait for a slow data load, I want to see a clear, branded response that tells me what happened and gives me a way to continue, so that I am never left confused or stranded on a blank screen.

## Scope
- `app/not-found.tsx` — Global branded 404 page with search bar and return-to-homepage CTA
- `app/error.tsx` — Root-level error boundary with `reset()` retry button and homepage link
- `app/loading.tsx` — Root-level route transition loading indicator (full-page)
- `app/[city-slug]/[entity-type]/[listing-slug]/not-found.tsx` — BLACQList Page-specific 404 for listing routes that do not resolve to a published listing
- `app/[city-slug]/[entity-type]/[listing-slug]/loading.tsx` — Full BLACQList Page skeleton matching the listing page layout (hero skeleton, content skeleton)
- `components/skeletons/ListingPageSkeleton.tsx` — Reusable BLACQList Page full-page skeleton component used by the listing route's `loading.tsx`

## Out of Scope
- Search results loading skeleton (covered by Ticket 018 in the search page ticket)
- Dashboard loading skeletons (covered in dashboard tickets)
- Auth route error pages (covered by Ticket 014)
- Admin section error boundaries (covered in admin tickets)
- Offline detection banner (post-MVP)

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 015 — App shell layout (nav and footer must exist for 404/error pages to render in context) | Blocking ticket | Done |
| Ticket 020 — BLACQList Page data layer (defines the listing page layout that `loading.tsx` must match) | Informs skeleton | Not started |

**Risk:** The BLACQList Page skeleton in `loading.tsx` must match the actual listing page layout from Ticket 020. If Ticket 020's layout changes after Ticket 019 is implemented, the skeleton must be updated. Coordinate with the Ticket 020 developer before finalizing `ListingPageSkeleton.tsx`.

## UX Notes
- **Screens:** 404 page (`/[any-unknown-route]`), error page (any route with an unhandled exception), loading overlays (any data-fetching route)
- **Routes affected:** All routes (global); `/[city-slug]/[entity-type]/[listing-slug]` (listing-specific 404 and loading)
- **Entry points for 404:** Mistyped URL, stale link from search engine, deleted or unpublished listing, link from social media to a listing that has been removed
- **Entry points for error:** Supabase outage, deployment error, unexpected server-side exception
- **Exit points:** 404 → Homepage, Search page, Discover page. Error → retry (same page), Homepage.

### Global 404 Page (`app/not-found.tsx`)
- Background: `bg-[#19191E]` (deep brand dark)
- Large "404" in Glacial Indifference, Amber Gold, centered
- Heading: "This page doesn't exist." in Glacial Indifference, white
- Subhead in Lato: "It may have moved, been removed, or the link may be wrong."
- Search bar: same `HeroSearchBar` component from Ticket 016 — lets user search from the 404 page
- Two link buttons below: "Back to Homepage" (Amber Gold, primary) + "Browse All Businesses →" (ghost white, links to `/discover`)
- Branded footer from app shell (Ticket 015) renders below

### BLACQList Page-Specific 404 (`app/[city-slug]/[entity-type]/[listing-slug]/not-found.tsx`)
- Dark background (`bg-[#19191E]`)
- Heading: "This business page isn't available." in Glacial Indifference, white
- Subhead in Lato: "The business may have moved, been unlisted, or this link may be outdated."
- Two buttons: "Search for this business" (Amber Gold, links to `/search`) + "Discover more businesses" (ghost white, links to `/discover`)

### Root Error Boundary (`app/error.tsx`)
- Background: `bg-[#FCFAF4]` (cream) — visually distinct from 404 (dark)
- Heading: "Something went wrong." in Glacial Indifference
- Subhead: "An unexpected error occurred. We've been notified and are looking into it." in Lato
- Primary button: "Try again" — calls `reset()` prop from Next.js error boundary
- Secondary link: "Return to homepage" (text link)
- Must use `"use client"` directive — Next.js requires error boundaries to be Client Components

### Root Loading Page (`app/loading.tsx`)
- Minimal full-page loading indicator — not a full skeleton
- Centered on screen: BLACQList logo (SVG wordmark) with a subtle fade-in pulse animation
- Background: `bg-[#19191E]`
- This is a brief transition state between route navigations, not a content skeleton

### BLACQList Page Loading Skeleton (`app/[city-slug]/[entity-type]/[listing-slug]/loading.tsx`)
- Uses `<ListingPageSkeleton />` component
- Skeleton must match the listing page layout structure from Ticket 020:
  - Hero block skeleton: full-bleed rectangle, 400px tall on desktop, 280px on mobile
  - Trust badge row skeleton: 3 small pill skeletons
  - Listing name skeleton: `h-8 w-64` block
  - Category + city row: two small pill skeletons
  - Content grid (desktop: 2/3 + 1/3 split): left column has about section (3 line skeletons), hours table (6 row skeletons); right column has contact/links card (4 row skeletons)
  - Services grid: 3 service card skeletons
- All skeleton elements use `bg-gray-200 animate-pulse rounded` classes

## Design Notes
- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **404 pages:**
  - Background: `bg-[#19191E]`
  - "404" number: `text-[#E2A428] font-headline text-8xl md:text-9xl font-bold text-center`
  - Headings: `text-white font-headline text-2xl md:text-3xl font-bold text-center`
  - Subhead: `text-gray-400 text-base text-center max-w-md mx-auto`
  - Primary CTA: `bg-[#E2A428] text-black font-bold px-6 py-3 rounded-full`
  - Ghost CTA: `border border-white text-white bg-transparent px-6 py-3 rounded-full hover:bg-white/10`
- **Error boundary:**
  - Background: `bg-[#FCFAF4]`
  - Heading: `font-headline text-3xl font-bold text-black text-center`
  - Subhead: `text-[#595758] text-base text-center max-w-md mx-auto mt-4`
  - "Try again" button: `bg-[#E2A428] text-black font-bold px-6 py-3 rounded-full`
  - "Return to homepage": `text-[#595758] underline text-sm mt-4`
- **Loading skeleton — all skeleton elements:**
  - `className="bg-gray-200 animate-pulse rounded"`
  - Container: `max-w-5xl mx-auto px-4`
  - Hero skeleton: `w-full h-[280px] md:h-[400px] rounded-none` (full-bleed)
  - Content grid: `grid grid-cols-1 md:grid-cols-3 gap-8 mt-8`
- **Components to use:** shadcn/ui `Skeleton` component (wraps the `animate-pulse` pattern); `Button` for CTAs on 404 and error pages
- **States:** These files ARE the error/loading states — no nested state handling required within them

## Data Notes
- **Tables read:** None — these are fallback and loading UI pages. No database queries.
- **Operations:** None
- **Migration required:** No

## API Notes
- No API calls on any of these pages.
- The `reset()` function on `app/error.tsx` re-triggers the failing Server Component render — it does not call an API.

## Implementation Notes

**Files to create:**
- `app/not-found.tsx` — Global 404 page; Server Component
- `app/error.tsx` — Root error boundary; **must have `"use client"` directive**
- `app/loading.tsx` — Root route loading indicator; Server Component
- `app/[city-slug]/[entity-type]/[listing-slug]/not-found.tsx` — Listing-level 404; Server Component
- `app/[city-slug]/[entity-type]/[listing-slug]/loading.tsx` — Listing page loading skeleton; Server Component
- `components/skeletons/ListingPageSkeleton.tsx` — Extracted skeleton component

**`app/error.tsx` pattern:**
```tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error monitoring service (Sentry) when available
    console.error(error)
  }, [error])

  return (
    <main id="main-content" className="min-h-screen bg-[#FCFAF4] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-headline text-3xl font-bold text-black">
        Something went wrong.
      </h1>
      <p className="text-[#595758] text-base mt-4 max-w-md">
        An unexpected error occurred. We've been notified and are looking into it.
      </p>
      <Button
        onClick={reset}
        className="mt-8 bg-[#E2A428] text-black font-bold px-6 py-3 rounded-full hover:bg-[#FFD867]"
      >
        Try again
      </Button>
      <Link
        href="/"
        className="mt-4 text-[#595758] underline text-sm"
      >
        Return to homepage
      </Link>
    </main>
  )
}
```

**`app/not-found.tsx` pattern:**
```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HeroSearchBar } from '@/components/home/HeroSearchBar'

export default function NotFound() {
  return (
    <main id="main-content" className="min-h-screen bg-[#19191E] flex flex-col items-center justify-center px-4 text-center">
      <p className="font-headline text-8xl md:text-9xl font-bold text-[#E2A428]">
        404
      </p>
      <h1 className="font-headline text-2xl md:text-3xl font-bold text-white mt-4">
        This page doesn't exist.
      </h1>
      <p className="text-gray-400 text-base mt-4 max-w-md">
        It may have moved, been removed, or the link may be wrong.
      </p>
      <div className="mt-8 w-full max-w-lg">
        <HeroSearchBar variant="dark" />
      </div>
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <Button asChild className="bg-[#E2A428] text-black font-bold px-6 py-3 rounded-full">
          <Link href="/">Back to Homepage</Link>
        </Button>
        <Button asChild variant="outline" className="border-white text-white bg-transparent px-6 py-3 rounded-full hover:bg-white/10">
          <Link href="/discover">Browse All Businesses →</Link>
        </Button>
      </div>
    </main>
  )
}
```

**`ListingPageSkeleton.tsx` pattern:**
```tsx
import { Skeleton } from '@/components/ui/skeleton'

export function ListingPageSkeleton() {
  return (
    <div className="min-h-screen bg-white" aria-hidden="true" aria-busy="true">
      {/* Hero */}
      <Skeleton className="w-full h-[280px] md:h-[400px] rounded-none" />

      <div className="max-w-5xl mx-auto px-4 mt-8">
        {/* Trust badges + name */}
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-64 mb-2" />
        <div className="flex gap-2 mb-8">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="mt-8 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
```

**`HeroSearchBar` variant prop:**
The `HeroSearchBar` component (Ticket 016) must accept an optional `variant?: 'dark' | 'light'` prop so it can be rendered on the dark 404 page background without needing a separate component. If the Ticket 016 implementation did not include this prop, add it as part of this ticket.

**Key patterns:**
- `app/error.tsx` must have `"use client"` — this is a Next.js requirement for error boundaries
- `app/not-found.tsx` is a Server Component — no `"use client"` directive
- All loading.tsx files are Server Components — they export a default React component that renders synchronously
- Skeleton elements must use `aria-hidden="true"` on the container and `aria-busy="true"` on the outermost element so screen readers bypass the skeleton and wait for the real content
- The global `not-found.tsx` is invoked by `notFound()` from `next/navigation` in Server Components, and automatically by the Next.js router for unmatched routes

**Do not:**
- Put `"use client"` on `not-found.tsx`, `loading.tsx`, or `ListingPageSkeleton.tsx` — they do not need client-side state
- Hard-code the "404" number as text inside an `<h1>` — it is a decorative visual element; the actual `<h1>` is the descriptive heading ("This page doesn't exist.")
- Use the error boundary page as a redirect — always display it in place so the user does not lose their URL context

## Acceptance Criteria
- [ ] Navigating to an unknown route (e.g., `/this-does-not-exist`) renders the global 404 page with the 404 number in Amber Gold, the heading, subhead, `HeroSearchBar`, and two CTA buttons
- [ ] Navigating to a valid listing route where `notFound()` is called (e.g., unpublished listing slug) renders the listing-specific 404 page with the business-not-available message and two CTA buttons
- [ ] When a Server Component throws an unhandled error, the root error boundary renders with "Something went wrong." heading, "Try again" button, and "Return to homepage" link
- [ ] Clicking "Try again" on the error boundary calls `reset()` and re-renders the affected route
- [ ] The root `loading.tsx` renders a centered BLACQList logo with pulse animation on a `bg-[#19191E]` background during route transitions (visible when throttling network to Slow 3G)
- [ ] The listing route `loading.tsx` renders the `ListingPageSkeleton` with hero placeholder, name/badge rows, content grid, and services grid — all elements visible and using `animate-pulse`
- [ ] Skeleton container has `aria-hidden="true"` and `aria-busy="true"` — screen readers do not read skeleton text
- [ ] Both 404 pages render correctly at 375px — no horizontal overflow, CTAs stacked vertically or full-width
- [ ] Both 404 pages have exactly one `<h1>` with the descriptive heading (not the "404" number)

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| `HeroSearchBar` fails to render on 404 page | Client component import error | 404 page renders without search bar; heading and CTAs still visible | Fix the import; search bar is enhancement, not critical path |
| Error boundary itself throws an error | Nested error in `app/error.tsx` | Next.js default error page (unbranded) | This is an extreme edge case; keep the error boundary component as simple as possible |
| `ListingPageSkeleton` shape does not match listing page layout after Ticket 020 changes | Ticket 020 layout updates without updating skeleton | Jarring layout shift when real content loads (skeleton dimensions wrong) | Coordinate skeleton update with Ticket 020 developer; update skeleton before merge |
| `reset()` fails to recover (persistent error) | Root cause of error is not transient | User clicks "Try again" and sees the same error boundary again | Secondary "Return to homepage" link provides an exit; this is expected behavior for persistent errors |

## Edge Cases
- User bookmarks `/[city-slug]/[entity-type]/[listing-slug]` for a listing that is later soft-deleted — they arrive at a valid-looking URL that calls `notFound()` in the Server Component; the listing-specific 404 renders, not the global one
- User has JavaScript disabled — `app/error.tsx` is a Client Component; the "Try again" button requires JavaScript. Without JS, the button renders but does not work. Add `<noscript>` fallback or note this limitation.
- Direct navigation to a listing route during a Supabase outage — the Server Component fetch fails; the root error boundary catches this before `notFound()` can be called; user sees the error boundary, not the 404
- Route segment `[city-slug]` exists but `[listing-slug]` does not resolve — the segment match succeeds (dynamic routes always match), so the `notFound()` call in the page component determines the 404 — not the router

## Accessibility Notes
- [ ] Global 404 `<h1>` is "This page doesn't exist." — the "404" number is a decorative `<p>` element, not the h1
- [ ] Listing-specific 404 `<h1>` is "This business page isn't available."
- [ ] Error boundary `<h1>` is "Something went wrong."
- [ ] All CTA buttons on 404 and error pages have descriptive labels ("Back to Homepage", "Browse All Businesses", "Try again")
- [ ] Skeleton container uses `aria-hidden="true"` so screen readers skip to the real content once it loads
- [ ] Focus is not trapped on loading states — screen readers naturally skip `aria-hidden` regions

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Global 404 renders | Anonymous | Navigate to `/this-route-does-not-exist` | 404 number in Amber Gold, "This page doesn't exist." heading, HeroSearchBar, two CTA buttons visible on dark background |
| QA-2 | Listing-specific 404 renders | Anonymous | Navigate to `/atlanta/restaurant/fake-slug-that-does-not-exist` | "This business page isn't available." heading visible; two CTA buttons visible |
| QA-3 | Error boundary renders and resets | Anonymous | Trigger a server error (add a deliberate throw in a test component); load the affected route | Error boundary renders "Something went wrong."; click "Try again" re-renders the route |
| QA-4 | Listing loading skeleton | Anonymous | Throttle network to Slow 3G; navigate to a valid listing URL | `ListingPageSkeleton` renders — hero placeholder, content grid skeletons, services skeletons all visible with animate-pulse |
| QA-5 | 404 at 375px | Anonymous | Set viewport to 375px; navigate to `/nonexistent` | No horizontal overflow; CTAs stacked vertically or full-width; all text readable |

## Security Notes
- 404 and error pages must not expose internal error details, stack traces, or server paths to the user
- `app/error.tsx` logs the error to console (or Sentry when configured) server-side — the error object must never be rendered into the HTML sent to the browser
- The `digest` field on the error object (Next.js error identifier) is safe to log internally but must not be displayed in the UI

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] Global 404 tested — unknown route renders branded 404 page
- [ ] Listing-specific 404 tested — `notFound()` call renders the correct 404 variant
- [ ] Error boundary tested — unhandled server error renders the error page; reset() re-renders successfully
- [ ] Loading skeleton tested at Slow 3G throttle — ListingPageSkeleton visible during data load
- [ ] Mobile tested at 375px — 404 and error pages
- [ ] Keyboard navigation tested — CTAs on 404 and error pages reachable via Tab, Enter activates
- [ ] Accessibility: h1 is the descriptive heading (not "404"), skeleton aria-hidden verified
- [ ] Coordinate `ListingPageSkeleton` shape with Ticket 020 developer before final merge
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
