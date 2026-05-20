# BLACQList Page Template Implementation Report

**Product:** The BLACQList
**Date:** 2026-05-11
**Status:** Complete — TypeScript zero errors, lint zero errors

---

## What Was Built

The entity page template for The BLACQList — the per-entity micro-website that makes every "View Page" card CTA live. Accessible at `/[citySlug]/business/[listingSlug]`. The route is fully rendered server-side with ISR-ready architecture and client components isolated to interactive subsections only.

Demonstrated with **Peach & Rye Kitchen** (premium tier, certified trust, Atlanta, GA) — navigable at `/atlanta/business/peach-and-rye-kitchen`.

---

## Route Choice

**Route:** `app/[citySlug]/business/[listingSlug]/page.tsx`

Per `route-map.md`: "This route map supersedes [ADR-010] with the more SEO-optimal city-contextualized pattern: `/[city-slug]/business/[listing-slug]`." The city-scoped pattern surfaces city context in the URL, improving local search ranking and shareability.

---

## Files Created

| File                                                   | What it is                                                                                                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/mock-entity-page.ts`                             | Types (`EntityPageData`, `BusinessDetails`, `ServiceItem`, `WeeklyHours`, `CTAType`) + 17 CTA labels + Peach & Rye Kitchen mock record + `getEntityPageBySlug()` + `getCtaLabel()` |
| `components/entity-page/EntityPageHero.tsx`            | Cover area with gradient overlay, tier-based heights, trust/featured badges, CTA button (`id="hero-cta"`), save/share placeholders                                                 |
| `components/entity-page/EntityQuickActionBar.tsx`      | Sticky bar that appears when hero CTA scrolls out of view; slide-up mobile / fade-in desktop                                                                                       |
| `components/entity-page/EntityAtAGlance.tsx`           | Category, location, hours (with live open/closed status), phone/email/website, social links                                                                                        |
| `components/entity-page/EntityStorySection.tsx`        | Description with amber-border lead paragraph; expand/collapse "Read more" toggle                                                                                                   |
| `components/entity-page/EntityOfferingsSection.tsx`    | Services list with price column; "Show all N services" expand toggle                                                                                                               |
| `components/entity-page/EntityMediaGallery.tsx`        | Gallery grid + keyboard-accessible lightbox; hidden entirely when no images                                                                                                        |
| `components/entity-page/EntityTrustSection.tsx`        | StatusBadge + tier description + unclaimed claim prompt + reviews stub                                                                                                             |
| `components/entity-page/EntityCommunityConnection.tsx` | Reviews placeholder + "Suggest a correction" community link                                                                                                                        |
| `components/entity-page/EntityPlatformActivity.tsx`    | Save count display; hidden entirely if save_count is 0                                                                                                                             |
| `components/entity-page/EntityRelatedDiscovery.tsx`    | EntityCard grid (desktop 3-col / mobile horizontal scroll); hidden if < 3 related                                                                                                  |
| `app/[citySlug]/business/[listingSlug]/page.tsx`       | Server Component route: `generateMetadata`, `notFound()` guard, all 10 sections in background-rhythm order                                                                         |

---

## Section Background Rhythm

| Section              | Background                       |
| -------------------- | -------------------------------- |
| Hero                 | `bg-deep-bg` (contained wrapper) |
| At a Glance          | `bg-white`                       |
| Our Story            | `bg-cream`                       |
| Services & Offerings | `bg-white`                       |
| Gallery              | `bg-deep-bg`                     |
| Trust & Verification | `bg-pale-lavender`               |
| Community            | `bg-white`                       |
| On The BLACQList     | `bg-cream`                       |
| You Might Also Like  | `bg-pale-lavender`               |

---

## Component Architecture

| Component                   | Type   | Why                                                              |
| --------------------------- | ------ | ---------------------------------------------------------------- |
| `EntityPageHero`            | Server | No interactivity; pure display                                   |
| `EntityQuickActionBar`      | Client | IntersectionObserver + visibility state                          |
| `EntityAtAGlance`           | Client | `suppressHydrationWarning` for live open/closed time computation |
| `EntityStorySection`        | Client | Expand/collapse toggle state                                     |
| `EntityOfferingsSection`    | Client | Expand/collapse toggle state                                     |
| `EntityMediaGallery`        | Client | Lightbox open/close state, keyboard handling                     |
| `EntityTrustSection`        | Server | Pure display                                                     |
| `EntityCommunityConnection` | Server | Pure display                                                     |
| `EntityPlatformActivity`    | Server | Pure display                                                     |
| `EntityRelatedDiscovery`    | Server | Reuses `EntityCard`                                              |

---

## Key Implementation Notes

### Open/Closed Status

Computed directly during render using `suppressHydrationWarning` on the indicator elements. This is the correct pattern for time-based UI that differs between server and client renders — the server renders a value based on render time; the client hydrates with its own computed value and `suppressHydrationWarning` suppresses the mismatch warning.

### IntersectionObserver Target

`EntityPageHero` renders its CTA button with `id="hero-cta"`. `EntityQuickActionBar` observes this element on mount — when it scrolls out of the viewport, the bar becomes visible. `tabIndex` on all bar elements is toggled to `-1` when hidden to keep keyboard order clean.

### Tier-Based Hero

- Free: 360px desktop, contained, rounded top corners
- Standard: 400px desktop, contained, rounded top corners
- Premium: 560px desktop, full-bleed via negative margins breaking out of the 960px container

### Social Links

Lucide React in this project's version does not include brand icons (Instagram, Facebook, etc.). Social links are rendered as text links with an `ExternalLink` icon — functional and accessible. When brand icons become available (via package update or custom icon set), they can be dropped in with no structural changes.

### Mock Entity

Peach & Rye Kitchen demonstrates: premium tier, certified trust, physical location, full hours (Mon closed, Tue–Sun open), full social links, 7 services (triggers "Show all" toggle), multi-paragraph description (triggers "Read more" toggle), 3 related entities (enables Related Discovery section), 892 saves (enables Platform Activity section).

---

## Data Source

**Mock data** — `data/mock-entity-page.ts`

When Supabase listings are seeded, `getEntityPageBySlug()` can be replaced with a Supabase query against `listings JOIN listing_details_business` with no changes to the route page or section components. The `EntityPageData` type mirrors the joined shape.

---

## What Was NOT Built

| Item                                 | Reason                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner editing (claim, edit listing)  | Scoped out — requires auth (ticket 014)                                                                                                                                                      |
| Admin moderation                     | Scoped out — requires admin dashboard (future ticket)                                                                                                                                        |
| Marketplace checkout                 | Scoped out — out of MVP                                                                                                                                                                      |
| Real media gallery images            | No Supabase Storage items; gallery hidden with `images={undefined}`                                                                                                                          |
| Professional / Creative entity types | Architecture is ready; `entity_type` is typed; only `business` template implemented. Add `listing_details_professional` / `listing_details_creative` data types when those tables are seeded |
| `generateStaticParams`               | Not yet — requires real DB data; add when listings are seeded for build-time pre-rendering                                                                                                   |
| ISR `revalidate`                     | Not set — add `export const revalidate = 3600` when connected to Supabase                                                                                                                    |

---

## Components Reused

| Component     | File                                 |
| ------------- | ------------------------------------ |
| `StatusBadge` | `components/ui/status-badge.tsx`     |
| `Badge`       | `components/ui/badge.tsx`            |
| `EntityCard`  | `components/entities/EntityCard.tsx` |

---

## Verification

```bash
pnpm tsc --noEmit  # ✅ zero errors
pnpm lint          # ✅ zero errors
```

### Manual verification checklist

- [ ] `pnpm dev` — dev server starts without errors
- [ ] `/atlanta/business/peach-and-rye-kitchen` — page renders all sections
- [ ] Hero: "Peach & Rye Kitchen" h1, amber "Order Now" CTA, certified trust badge, "Featured" badge
- [ ] Hero: premium full-bleed treatment (no side margins visible)
- [ ] QuickActionBar hidden on page load; appears after scrolling past hero CTA
- [ ] Mobile QuickActionBar slides up from bottom; desktop bar fades in below nav
- [ ] At a Glance: hours table renders Mon as "Closed", Tue–Sun with times
- [ ] Open/closed indicator shows current status relative to actual local time
- [ ] At a Glance: phone/email/website links all render; social links visible
- [ ] Our Story: first paragraph in amber left-border; "Read more" shows remaining paragraphs
- [ ] Services: 6 services visible; "Show all 7 services" button present; click reveals 7th
- [ ] Media Gallery: **not rendered** (no images passed)
- [ ] Trust: certified StatusBadge; no claim prompt shown (entity is certified)
- [ ] Trust: rating 4.8 / 214 reviews shown in stub card
- [ ] Platform Activity: "892 people have saved this listing" visible
- [ ] Related Discovery: 3 entity cards in grid (desktop); horizontal scroll (mobile 375px)
- [ ] Page: no layout shift from QuickActionBar (uses `position: fixed`, does not affect flow)
- [ ] Keyboard: Tab reaches all CTAs, save/share buttons, social links, read-more toggles
- [ ] Mobile 375px: hero text readable, CTA button full-width reachable in thumb zone

---

## Known Limitations

- **"Suggest a correction" link** goes to `/corrections` — route not yet built.
- **"Claim this listing" link** goes to `/claim` — route not yet built.
- **"Learn how The BLACQList verifies businesses" link** goes to `/about/trust` — not yet built.
- **Reviews section is a placeholder** — community review system is a future ticket.
- **Collections appearance** is a stub — requires collections feature.
- **Save/share buttons are visual only** — functional save requires auth (ticket 014).
- **Media gallery is hidden** — will render when Supabase Storage images are present.
- **Social brand icons** use `ExternalLink` fallback — replace when brand icons are added.

---

## Next Tickets to Build

| Priority | Ticket  | Description                                                                    |
| -------- | ------- | ------------------------------------------------------------------------------ |
| P1       | 014     | Auth flows — unlocks save button and owner dashboard                           |
| P1       | 025–026 | Search API + real DB reads — replaces mock data; enables entity page real data |
| P1       | 032–033 | Add Business form — lets owners create listings                                |
| P2       | 027–028 | City landing pages — city-level discovery                                      |
| P2       | 029     | Full Discover page — pagination, sort, mobile filters                          |
| P2       | 040     | Claim listing flow — lets owners claim unclaimed pages                         |
| P3       | 050     | Community reviews — review submission and display                              |
