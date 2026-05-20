# Ticket 037: Admin Layout, Navigation, and Auth Guard

## Status
Backlog

## Phase
Phase 6: Admin Review and Verification

## Priority
P0

## Feature Area
Admin / Auth

## Context
The admin panel is required before any admin workflow — listing review, claim processing, or user management — can be built. This ticket establishes the admin shell: the layout, sidebar navigation, auth guard, and the overview dashboard with platform stats. Without this foundation, Tickets 038–040 cannot be implemented. The admin panel must be completely inaccessible to non-admin users — a role check at the layout level is the first line of defense. Source: `docs/blacqlist/ux/mvp-screen-map.md` Admin Screens; `docs/blacqlist/data/database-schema-plan.md` `user_roles` table; `docs/blacqlist/architecture/server-actions-plan.md`; `docs/blacqlist/architecture/api-contract.md` Section 9.

## User Story
As a platform admin, I want a protected admin panel with navigation and a stats overview, so that I can access moderation tools and understand platform health at a glance without needing to query the database directly.

## Scope

**In scope:**
- `app/admin/layout.tsx` — Server Component; performs server-side role check (`user_roles.role IN ('admin', 'super_admin')`); redirects to `/` if check fails; renders admin sidebar + `{children}`
- `app/admin/page.tsx` — redirects to `/admin/overview` (empty route handler)
- `app/admin/overview/page.tsx` — Admin Overview: platform stats + action queue + recent activity feed
- Admin sidebar navigation (`app/admin/_components/AdminSidebar.tsx`):
  - Logo/wordmark with "Admin" badge in Amber Gold `#E2A428`
  - Nav items (MVP): Overview, Listings, Claims, Users, Collections, Categories
  - Active state: Amber Gold left border accent (`border-l-4 border-[#E2A428]`) + `text-[#E2A428]`
  - Inactive state: `text-[#FCFAF4]/70 hover:text-[#FCFAF4]`
  - Mobile: collapsible sidebar triggered by hamburger button in a top bar; drawer slides in from left; outside click or close button dismisses
- Platform stats on Overview page (server-side fetch, `Promise.all`):
  - Total listings (all statuses including deleted)
  - Pending review count (`status = 'pending'`)
  - Pending claims count (`status IN ('pending', 'under_review')`)
  - Total users
  - New listings this week (created in last 7 days)
- "Needs attention" action queue section: two rows with live counts — "Claims pending review: [N]" → `/admin/claims`, "Listings pending review: [N]" → `/admin/listings?status=pending`. If both counts are 0: "All caught up." with subtle Amber Gold checkmark text
- Recent activity feed: last 10 rows from `admin_audit_log` table in reverse chronological order; each row shows: action type (human-readable label), target entity name/id, timestamp. Skeleton loading while feed loads
- Each stat card: shadcn/ui `Card` with `CardHeader` (`CardDescription` label + `CardTitle` large number) + `CardContent` (contextual sub-text)
- Skeleton loading for all stat cards while data fetches (structure matches loaded card shape)

**Out of scope:**
- Admin Listings table (Ticket 038)
- Admin Listing Detail (Ticket 039)
- Admin Claims Queue (Ticket 040)
- Admin Collections, Admin Users, Admin Receipts pages (separate tickets)
- Super Admin-only features (role management, bulk destructive operations)

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 014 (user_roles table and RLS) | Blocking ticket | Role check queries `user_roles` table |
| Ticket 015 (auth middleware and session) | Blocking ticket | Session cookie required for `supabase.auth.getUser()` in layout |
| Ticket 012 (analytics + audit tables migration — `admin_audit_log`) | Blocking ticket | Recent activity feed reads `admin_audit_log` |
| Super Admin seed data | Data dependency | At least one `super_admin` role record must exist to access the panel during development |

## UX Notes

- **Screen:** Admin Overview — `docs/blacqlist/ux/mvp-screen-map.md` Admin Screens, Admin Overview row
- **Flow reference:** Admin users access via direct navigation to `/admin` — no specific user flow
- **Entry points:** Direct URL navigation to `/admin` or any `/admin/*` route
- **Exit points:** Nav links to each admin section; "Needs attention" links to specific queues
- **Mobile behavior (375px):**
  - Sidebar: hidden by default; triggered by hamburger icon button in a top bar (`fixed top-0 left-0 right-0 h-14 bg-[#000000] z-50`); sidebar slides in as a drawer from the left using shadcn/ui `Sheet`; backdrop overlay when open
  - Top bar shows: hamburger icon left, "BLACQList Admin" text center, no right-side action
  - Stat cards: single-column stack (`grid-cols-1`)
  - "Needs attention" rows: full-width stacked; count badge right-aligned
  - Recent activity: scrollable table or card list

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** shadcn/ui `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Skeleton`, `Sheet` (mobile sidebar drawer), `NavigationMenu` or plain `<nav>`
- **Admin color scheme:**
  - Sidebar background: `bg-[#000000]` (Brand Black), `w-64` fixed on desktop
  - Main content area: `bg-[#19191E]` (Deep Background) with `text-[#FCFAF4]` body text
  - Sidebar active link: `border-l-4 border-[#E2A428] bg-[#E2A428]/10 text-[#E2A428]`
  - Admin badge (next to wordmark): `text-xs bg-[#E2A428] text-[#000000] px-2 py-0.5 rounded font-bold uppercase`
  - Stat card: `bg-[#000000] border border-[#E2A428]/20 text-[#FCFAF4]`
  - Stat number: Glacial Indifference Bold `text-4xl text-[#FCFAF4]`
  - Stat label: Quicksand `text-sm text-[#FCFAF4]/70`
- **Stat cards grid:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4`
- **Skeleton cards:** match loaded card shape — `Skeleton` for label (`h-4 w-32`) and number (`h-10 w-20`)
- **States to implement:** Loading (stat card skeletons), Loaded, All-caught-up (empty action queue)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `user_roles`, `listings`, `claims`, `admin_audit_log`
- **Entities involved:** `user_roles` (auth check), `listings` (aggregate counts), `claims` (aggregate counts), `admin_audit_log` (recent feed)
- **Operations (all SELECT, server-side):**
  - Role check: `SELECT id FROM user_roles WHERE user_id = $uid AND role IN ('admin', 'super_admin') LIMIT 1`
  - Stats: `Promise.all([...])` of 5 Supabase count queries using service_role client
  - Recent feed: `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 10` using service_role
- **RLS policies:** All stats queries use the service_role client (bypasses RLS — intended; the service layer enforces the admin role check before calling). Role check uses the authenticated client
- **Migration required:** No — depends on existing tables

## API Notes

- No Route Handlers called from this page — all data is fetched server-side in Server Components using the Supabase service_role client
- The layout's role check does NOT use a Route Handler — it queries `user_roles` directly in the Server Component via the authenticated client

## Implementation Notes

**Files to create:**
- `app/admin/layout.tsx` — Server Component auth guard + sidebar layout wrapper
- `app/admin/page.tsx` — redirect to `/admin/overview`
- `app/admin/overview/page.tsx` — stats + queue + feed (Server Component with Suspense boundaries per section)
- `app/admin/_components/AdminSidebar.tsx` — sidebar nav (both desktop static and mobile Sheet)
- `app/admin/_components/StatCard.tsx` — reusable stat card (takes `label`, `value`, `subtext` props)
- `app/admin/_components/StatCardSkeleton.tsx` — matching skeleton
- `app/admin/_components/ActionQueueSection.tsx` — "Needs attention" section
- `app/admin/_components/RecentActivityFeed.tsx` — audit log feed
- `lib/admin/serviceRoleClient.ts` — `createServiceRoleClient()` factory function (if not already created)

**Files to modify:**
- None — new route segment

**Key patterns:**

Admin layout auth guard (Server Component):
```typescript
// app/admin/layout.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }) {
  const cookieStore = cookies()
  const supabase = createServerClient(/* anon client for auth */)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: role } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .in('role', ['admin', 'super_admin'])
    .single()

  if (!role) redirect('/')

  return (
    <div className="flex h-screen bg-[#19191E]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

Stats fetching pattern (overview page):
```typescript
// app/admin/overview/page.tsx
const serviceClient = createServiceRoleClient()
const [totalListings, pendingClaims, ...] = await Promise.all([
  serviceClient.from('listings').select('*', { count: 'exact', head: true }),
  serviceClient.from('claims').select('*', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
  // ...
])
```

- Wrap each section of the overview page in a separate `<Suspense fallback={<StatCardSkeleton />}>` boundary so stats and feed load independently
- Mobile sidebar uses shadcn/ui `Sheet` with `side="left"` — the open state is managed in a Client Component wrapper (`AdminSidebarWrapper.tsx`) that wraps the static Server Component sidebar content
- Nav active state: use Next.js `usePathname()` in a Client Component to determine the active link

**Do not:**
- Use JWT claims for the admin check — always query `user_roles` table
- Expose service_role key in any Route Handler — `createServiceRoleClient()` is used only in Server Components and Server Actions
- Redirect to `/admin/login` — redirect to `/` (the public homepage); this prevents leaking the existence of the admin panel to non-admins
- Use `getSession()` in the layout — use `getUser()` for server-side validation

## Acceptance Criteria

- [ ] Given an unauthenticated user navigates to any `/admin/*` route, they are redirected to `/`
- [ ] Given an authenticated Supporter (non-admin) navigates to `/admin`, they are redirected to `/`
- [ ] Given an authenticated admin navigates to `/admin`, they are redirected to `/admin/overview` and the overview page renders
- [ ] Given the overview page loads, stat cards render with counts for total listings, pending claims, pending reviews, total users, and new listings this week
- [ ] Given stat cards are loading, matching skeleton cards render — not blank areas or spinners
- [ ] Given both pending claims and pending reviews are 0, the "Needs attention" section shows "All caught up." without count rows
- [ ] Given there are pending claims, "Claims pending review: [N]" is a clickable link to `/admin/claims`
- [ ] On mobile at 375px, the sidebar is hidden; a hamburger button in the top bar opens it as a drawer; clicking outside or the close button dismisses it
- [ ] The active nav item has the Amber Gold left border accent and text color

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Stats fetch failure | One of the `Promise.all` queries fails | The failed stat card shows "--" as the value with a subtle "Refresh" link | User refreshes the page |
| Recent activity feed fails | `admin_audit_log` query fails | Feed section shows "Activity unavailable. Refresh to retry." — stats section unaffected (separate Suspense boundary) | User refreshes |
| Role check DB error | `user_roles` query fails unexpectedly | Redirect to `/` — fail safe; do not expose admin panel on error | User navigates to sign-in and tries again |
| Session expires during admin session | `supabase.auth.getUser()` returns no user on layout re-render | Redirect to `/` | User signs in again; `next` param not preserved for admin (intentional) |

## Edge Cases

- User has both `admin` and `supporter` roles: the `IN ('admin', 'super_admin')` query returns a result; admin access is granted — this is correct
- Admin panel access during a deploy: if the `user_roles` table is being migrated, the query may fail — the fail-safe redirect to `/` prevents partial rendering
- Mobile device rotated from portrait to landscape: sidebar transitions from drawer to static sidebar at `lg:` breakpoint without layout shift — use `useMediaQuery` or Tailwind `lg:` display classes

## Accessibility Notes

- [ ] Sidebar navigation uses `<nav aria-label="Admin navigation">` wrapping the `<ul>` of links
- [ ] Active nav link has `aria-current="page"` attribute
- [ ] Mobile hamburger button has `aria-label="Open admin menu"` and `aria-expanded` state
- [ ] Mobile sidebar drawer (Sheet) traps focus when open; Escape key closes it; focus returns to hamburger button on close
- [ ] Stat cards are `<article>` elements or have `aria-label="[Label]: [value]"` for screen reader clarity
- [ ] The "All caught up" message in the action queue section is visible text (not icon-only)

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Admin access | Sign in as admin user → navigate to `/admin` | Redirected to `/admin/overview`; stats render; sidebar shows nav items |
| QA-2 | Non-admin blocked | Sign in as Supporter → navigate to `/admin` | Redirected to `/` immediately |
| QA-3 | Unauthenticated blocked | Open incognito → navigate to `/admin/claims` | Redirected to `/` |
| QA-4 | Stats load | Admin navigates to `/admin/overview` | All 5 stat cards render with numbers; skeletons appear briefly before data loads |
| QA-5 | Mobile sidebar | Admin on mobile at 375px → tap hamburger | Sidebar drawer slides in; nav items visible; tap outside closes drawer |

## Security Notes

- The admin check in `layout.tsx` is the authoritative gate for all `/admin/*` routes — middleware is also applied but the Server Component check is the primary enforcement (middleware can be bypassed via direct fetch)
- Service_role client is used ONLY server-side in Server Components and Server Actions — it is never imported in Client Components or Route Handlers accessible to the client
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` must NOT exist — the service_role key must be a server-only env var (`SUPABASE_SERVICE_ROLE_KEY`) without the `NEXT_PUBLIC_` prefix
- The admin panel redirect goes to `/` not to a login page — this prevents an attacker from determining whether the admin panel exists by probing redirect behavior
- `admin_audit_log` is readable only via the service_role client — no RLS policy grants read access to authenticated users

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Admin access tested with admin user seed data
- [ ] Non-admin redirect tested
- [ ] Unauthenticated redirect tested
- [ ] All 5 stats verified against DB state
- [ ] Mobile sidebar open/close tested at 375px
- [ ] Keyboard nav through sidebar links tested
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed server-only (no `NEXT_PUBLIC_` prefix)
