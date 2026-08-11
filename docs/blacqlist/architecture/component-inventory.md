# Component Inventory — The BLACQList UI Foundation

**Last updated:** 2026-05-07
**Status:** Planning
**Owner:** Frontend Architecture

---

## Foundation Components (14)

| #   | Component                | File                                   | Type           | shadcn deps         | Tailwind pattern                                       |
| --- | ------------------------ | -------------------------------------- | -------------- | ------------------- | ------------------------------------------------------ |
| 1   | Container                | `components/layout/container.tsx`      | Server         | none                | `mx-auto w-full max-w-[960px] px-4 md:px-6 lg:px-8`    |
| 2   | Section                  | `components/layout/section.tsx`        | Server         | none                | `py-12 md:py-16` + background variant                  |
| 3   | PageHeader               | `components/layout/page-header.tsx`    | Server         | none                | `font-headline text-3xl md:text-4xl font-bold`         |
| 4   | PublicHeader             | `components/nav/public-header.tsx`     | Server (shell) | DropdownMenu, Sheet | `h-16 sticky top-0 z-50 w-full`                        |
| 5   | PublicMobileNav          | `components/nav/public-mobile-nav.tsx` | Client         | Sheet               | `bg-[#19191E] w-full max-w-[320px]`                    |
| 6   | PublicFooter             | `components/nav/public-footer.tsx`     | Server         | Separator           | `bg-black text-white` + 4-col grid                     |
| 7   | SectionHeading           | `components/ui/section-heading.tsx`    | Server         | none                | `font-headline text-2xl md:text-[28px] font-bold`      |
| 8   | StatusBadge              | `components/ui/status-badge.tsx`       | Server         | Badge               | Tier-specific bg + text colors                         |
| 9   | CtaButtonGroup           | `components/ui/cta-button-group.tsx`   | Server         | Button              | `flex gap-3` + Amber Gold primary                      |
| 10  | EmptyState               | `components/ui/empty-state.tsx`        | Server         | Button              | `flex flex-col items-center text-center py-16`         |
| 11  | LoadingState (skeletons) | `components/ui/loading-state.tsx`      | Server         | Skeleton            | Matches loaded content dimensions                      |
| 12  | ErrorState               | `components/ui/error-state.tsx`        | Client         | Button              | `flex flex-col items-center text-center py-16`         |
| 13  | CardGrid                 | `components/ui/card-grid.tsx`          | Server         | none                | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` |
| 14  | EntityCard               | `components/entities/EntityCard.tsx`   | Server         | Card                | `rounded-lg border overflow-hidden hover:shadow-md`    |

---

## Sub-Components Implied by the Above

| Component          | File                                      | Type   | Purpose                                          |
| ------------------ | ----------------------------------------- | ------ | ------------------------------------------------ |
| SkipToContent      | `components/nav/skip-to-content.tsx`      | Server | `<a href="#main-content">` sr-only/focus-visible |
| NavLinks           | `components/nav/nav-links.tsx`            | Client | `usePathname()` active state                     |
| NavSearchExpand    | `components/nav/nav-search-expand.tsx`    | Client | Inline search expand in desktop nav              |
| AuthNav            | `components/nav/auth-nav.tsx`             | Client | DropdownMenu with anonymous/auth states          |
| PublicHeaderClient | `components/nav/public-header-client.tsx` | Client | Transparent→solid scroll transition              |
| SaveIconButton     | `components/ui/save-icon-button.tsx`      | Client | Optimistic save toggle inside EntityCard         |

---

## Skeleton Export Reference

Exported from `components/ui/loading-state.tsx`:

| Export                | Matches                        |
| --------------------- | ------------------------------ |
| `ListingCardSkeleton` | EntityCard (cover, name, meta) |
| `StatCardSkeleton`    | Dashboard stat cards           |
| `TableRowSkeleton`    | Admin/owner data table rows    |
| `SectionSkeleton`     | Generic full-section shimmer   |
| `HeroSkeleton`        | Full-bleed hero placeholder    |

---

## shadcn Components Required at Init

Install with: `pnpm dlx shadcn@canary add [component]`

**Batch 1 — required for foundation (install now):**

```
button input label form select textarea badge skeleton card dialog sheet dropdown-menu separator toast sonner
```

**Batch 2 — install when screens require them:**

```
table checkbox radio-group switch progress alert-dialog command popover scroll-area tabs avatar
```

---

## Client Component Decision Log

| Component            | Why Client                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `PublicHeaderClient` | `useEffect` scroll listener + `useState` for `isScrolled`         |
| `NavLinks`           | `usePathname()` hook                                              |
| `NavSearchExpand`    | `useState` for expanded/collapsed + keyboard handler              |
| `AuthNav`            | DropdownMenu requires pointer/keyboard event handlers             |
| `PublicMobileNav`    | Sheet open/close state + route-change effect                      |
| `ErrorState`         | `reset()` prop from Next.js error boundary requires click handler |
| `SaveIconButton`     | Optimistic UI mutation + `useOptimistic`                          |
