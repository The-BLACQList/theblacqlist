# Ticket 069: Personal impact API (GET /api/flow/personal-impact, authenticated)

## Status

Draft

## Phase

Phase 12: Flow Map Data and MVP Visualization

## Priority

P3

## Estimate

S (1–2h)

## Feature Area

Flow Map

---

## Context

While the community spend widget (Ticket 068) surfaces aggregate platform-wide stats, authenticated supporters should see their own personal contribution: how much they personally have spent at Black-owned businesses, how many businesses they have supported, and how many cities their spend has reached. This data is surfaced on the supporter dashboard (`/account`).

The personal impact data is derived from `receipt_uploads` (the supporter's own submissions) joined with `spend_events` for approved records. It is NOT sourced from `spend_events` alone — `spend_events` does not store `user_id` (by design — see Ticket 067's anonymization rule). The correct join path is: `receipt_uploads WHERE user_id = auth.uid() AND status = 'approved'` → join to `spend_events` on `receipt_upload_id`.

The endpoint is cached per-user with `unstable_cache` tagged with `personal-impact-${userId}` and revalidated with a 1-hour TTL. The cache can also be on-demand invalidated when a receipt is approved (by calling `revalidateTag` inside the `approveReceipt` SA from Ticket 065 — add this to that SA's cache invalidation step).

Sources: `docs/blacqlist/data/database-schema-plan.md` § receipt_uploads, spend_events; `docs/blacqlist/architecture/api-contract.md` § Flow Map.

---

## User Story

As an authenticated supporter, I want to see my personal spend impact — total dollars spent, businesses supported, and cities reached — so that I can feel the tangible effect of my participation in the platform.

---

## Scope

**In scope:**

- `app/api/flow/personal-impact/route.ts` — GET Route Handler; `authenticated` role required; queries `receipt_uploads` and `spend_events` for the current user; cached per-user with `unstable_cache`
- A `PersonalImpactCard` component — used on the supporter account dashboard (`/account` or added to `/account/receipts` page header); shows the personal stats returned by the API
- Adding `PersonalImpactCard` to `/account/receipts` page header (Ticket 066's page — as a summary above the receipt list)
- Cache tag: `personal-impact-${userId}` — used for on-demand invalidation
- The `approveReceipt` SA (Ticket 065) should call `revalidateTag(`personal-impact-${receipt.user_id}`)` after a successful approval — this is a modification to Ticket 065's SA, which can be done as part of this ticket or a PR comment in Ticket 065

**Out of scope:**

- A dedicated personal impact page or visualization (V3 — `/account/impact` or `/flow-map`)
- Top categories breakdown beyond the top 3 (keep response lean at MVP)
- Comparison to other users' spend (V3 — social/community features)
- Export or download of personal impact data
- Real-time updates (V3)

---

## Dependencies

| Dependency                                                                                                               | Type                                              | Status      |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ----------- |
| Ticket 014 — Auth flows                                                                                                  | Blocking ticket                                   | Not started |
| Ticket 067 — `spend_events` table                                                                                        | Blocking ticket                                   | Not started |
| Ticket 063 — Receipt upload API (produces `receipt_uploads` rows)                                                        | Blocking ticket                                   | Not started |
| Ticket 065 — Admin receipts queue (sets `status = 'approved'` on receipts; should add `revalidateTag` for this endpoint) | Soft dependency                                   | Not started |
| Ticket 066 — Supporter receipts history page (location where `PersonalImpactCard` is rendered)                           | Soft dependency (card can be built independently) | Not started |

---

## UX Notes

- **Screen:** `/account/receipts` page header area (Ticket 066); also potentially on the main `/account` dashboard
- **`PersonalImpactCard` design:** A compact horizontal stats row (or 2×2 grid on mobile) showing:
  - Total amount: "**$450** spent" (Glacial Indifference, Amber Gold amount)
  - Businesses: "**8** businesses supported" (Lato)
  - Cities: "**3** cities reached" (Lato)
  - Transactions: "**12** receipts" (Lato)
- **Empty state (no approved receipts):** Show zeroed stats without hiding the card: "$0 spent · 0 businesses · 0 cities". Include a subtle CTA: "Upload a receipt to start tracking →" (text link to `/account/receipts/new`)
- **Loading state:** Skeleton version of the stats row — three `Skeleton` blocks in a row
- **Placement:** On `/account/receipts` (Ticket 066), the card appears in a banner area at the top of the page, above the receipt list and below the "My Receipts" heading. It is a compact supplementary element, not the primary focus of the page.
- **Mobile:** Stats stack vertically or wrap into a 2×2 grid. No horizontal overflow.

---

## Design Notes

- **Components:** Minimal — `Skeleton` for loading, Tailwind grid for layout; no special shadcn/ui components needed
- **Amount formatting:** `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(total / 100)`
- **"Beta" badge:** Add a small `Badge` variant="outline" labeled "Beta" next to the section heading when rendering this card — the personal impact feature is in Beta
- **States to implement:** Loading (skeleton), Zero (zeroed values + CTA), Populated (real data), Error (card hidden / null on error)

---

## Data Notes

- **Tables:** `receipt_uploads`, `spend_events`, `listings`, `cities`
- **Query:**

  ```sql
  -- Personal impact for auth.uid()
  SELECT
    COALESCE(SUM(se.amount_cents), 0) AS total_amount_cents,
    COUNT(se.id) AS transaction_count,
    COUNT(DISTINCT se.listing_id) FILTER (WHERE se.listing_id IS NOT NULL) AS unique_businesses_count,
    COUNT(DISTINCT se.city_id) FILTER (WHERE se.city_id IS NOT NULL) AS unique_cities_count
  FROM receipt_uploads ru
  LEFT JOIN spend_events se ON se.receipt_upload_id = ru.id
  WHERE ru.user_id = :user_id
    AND ru.status = 'approved';

  -- Top 3 categories by spend
  SELECT c.name AS category_name, c.slug AS category_slug,
         COALESCE(SUM(se.amount_cents), 0) AS category_total_cents
  FROM receipt_uploads ru
  JOIN spend_events se ON se.receipt_upload_id = ru.id
  JOIN listings l ON l.id = se.listing_id
  JOIN categories c ON c.id = l.category_id
  WHERE ru.user_id = :user_id
    AND ru.status = 'approved'
    AND se.listing_id IS NOT NULL
  GROUP BY c.id, c.name, c.slug
  ORDER BY category_total_cents DESC
  LIMIT 3;
  ```

- **Caching strategy:**
  - `unstable_cache(() => queryPersonalImpact(userId), ['personal-impact', userId], { revalidate: 3600, tags: [\`personal-impact-${userId}\`] })`
  - Tag-based invalidation: `revalidateTag(\`personal-impact-${userId}\`)`in`approveReceipt`SA when a receipt belonging to`userId` is approved
- **RLS:** `receipt_uploads` SELECT — `authenticated` users can only SELECT rows where `user_id = auth.uid()`. The Route Handler must get the authenticated user's ID via `supabase.auth.getUser()` and pass it to the cached query function.
- **Migration required:** No — uses existing tables

---

## API Notes

### GET /api/flow/personal-impact

**Type:** Route Handler
**Auth:** `authenticated` (supporter or above)
**Caching:** `unstable_cache` per-user, `revalidate: 3600`, tag: `personal-impact-${userId}`

**Request:** No query params — uses auth session to determine `user_id`

**Response:**

```typescript
interface PersonalImpactData {
  total_amount_cents: number // All-time approved spend
  transaction_count: number // Count of approved receipt_uploads
  unique_businesses_count: number // Distinct listings supported
  unique_cities_count: number // Distinct cities reached
  top_categories: Array<{
    category_name: string
    category_slug: string
    total_amount_cents: number
  }> // Top 3 categories by spend; empty array if no data
}
// Envelope: { data: PersonalImpactData }
```

**Errors:**

| Code               | HTTP | When             |
| ------------------ | ---- | ---------------- |
| `AUTH_REQUIRED`    | 401  | No valid session |
| `OPERATION_FAILED` | 500  | DB query fails   |

---

## Implementation Notes

**Files to create:**

- `app/api/flow/personal-impact/route.ts` — GET Route Handler
- `components/spend/PersonalImpactCard.tsx` — stats display component (Server Component, or Client Component that fetches from the Route Handler)

**Files to modify:**

- `app/account/receipts/page.tsx` (Ticket 066) — add `<PersonalImpactCard>` above the receipt list
- `lib/actions/admin/approveReceipt.ts` (Ticket 065) — add `revalidateTag(\`personal-impact-${receipt.user_id}\`)` in Step 6 of the SA after successful approval

**Key patterns:**

- `unstable_cache` requires the cached function to be defined outside the Route Handler component, with the user ID passed as a parameter (not captured from closure) — this is essential for per-user cache isolation:
  ```typescript
  const getCachedPersonalImpact = unstable_cache(
    async (userId: string) => queryPersonalImpact(userId),
    ['personal-impact'],
    { revalidate: 3600, tags: [`personal-impact-${userId}`] } // NOTE: tags can reference the param
  )
  ```
  Note: `unstable_cache` with dynamic tags requires Next.js 14.1+. Verify the project's Next.js version; if < 14.1, use static tag `'personal-impact'` and accept that invalidation is global (less precise but correct).
- `PersonalImpactCard` should call `GET /api/flow/personal-impact` via `fetch` in a Server Component using `next: { revalidate: 3600 }` — this avoids a client-side fetch and keeps the data server-rendered
- The Route Handler must call `supabase.auth.getUser()` (not `getSession()`) to get the authenticated user — the cached query function receives the `userId` as a parameter, not the Supabase client
- If the supporter has no approved receipts, all fields return `0` / `[]` — this is correct, not an error

**Do not:**

- Query `spend_events` for `user_id` — `spend_events` does not have a `user_id` column (Ticket 067 anonymization rule); join through `receipt_uploads` instead
- Use `getSession()` — use `getUser()`
- Return a 404 when the user has no impact data — return zeroed stats with 200

---

## Acceptance Criteria

- [ ] Given an unauthenticated request is made to `GET /api/flow/personal-impact`, then 401 is returned with `code: 'AUTH_REQUIRED'`
- [ ] Given a supporter with no approved receipts calls the endpoint, then the response is 200 with all numeric fields = 0 and `top_categories = []`
- [ ] Given a supporter has 3 approved receipts totaling $150 at 2 businesses in 1 city, then the response returns `total_amount_cents: 15000`, `transaction_count: 3`, `unique_businesses_count: 2`, `unique_cities_count: 1`
- [ ] Given `top_categories` query has data, then up to 3 categories are returned ordered by spend descending
- [ ] Given the cache is live and a receipt is approved, then calling `revalidateTag(\`personal-impact-${userId}\`)`in the`approveReceipt` SA causes the next request to return fresh data
- [ ] `PersonalImpactCard` renders on `/account/receipts` above the receipt list with correct stats
- [ ] Empty state: given no approved receipts, `PersonalImpactCard` shows zeroed values and a "Upload a receipt to start tracking →" link
- [ ] Mobile at 375px: stats display wraps to 2×2 grid or single-column; no horizontal overflow

---

## Failure States

| Failure                                      | User-visible behavior                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Route Handler DB query fails                 | 500 `OPERATION_FAILED`; `PersonalImpactCard` error boundary renders null — page renders without the card |
| `revalidateTag` fails in `approveReceipt` SA | The approval still succeeds; the card shows stale data until the 1-hour TTL expires — acceptable         |

---

## Edge Cases

- Supporter has approved receipts with `listing_id = NULL` (no business matched): `unique_businesses_count` excludes these rows (FILTER WHERE listing_id IS NOT NULL); `total_amount_cents` still includes them
- Supporter has approved receipts with `amount_cents = 0`: included in `transaction_count`; contributes $0 to `total_amount_cents`
- `top_categories` returns fewer than 3 categories (e.g., all spend is in one category): return fewer than 3 — do not pad with empty entries
- User ID changes between cache warm-up and next request: not possible — Supabase Auth UUIDs are stable for a user's lifetime

---

## Accessibility Notes

- [ ] Stat numbers are wrapped in `<strong>` for semantic emphasis
- [ ] The "Upload a receipt to start tracking" link has descriptive text (not "click here")
- [ ] `PersonalImpactCard` loading skeleton has `aria-busy="true"` and `aria-label="Loading personal impact stats"`

---

## QA Test Cases

| #    | Scenario                            | Role            | Steps                                                                   | Expected result                                                                 |
| ---- | ----------------------------------- | --------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| QA-1 | Unauthenticated request             | anonymous       | GET /api/flow/personal-impact without session                           | 401 response with `code: 'AUTH_REQUIRED'`                                       |
| QA-2 | No approved receipts                | supporter (new) | GET /api/flow/personal-impact                                           | All fields = 0; `top_categories = []`                                           |
| QA-3 | With approved receipts              | supporter       | Approve 3 receipts for the user; GET /api/flow/personal-impact          | Correct totals: `transaction_count: 3`, `total_amount_cents` = sum              |
| QA-4 | Cache invalidation on approval      | supporter       | Call endpoint (cache warms); approve a new receipt; call endpoint again | Second call returns updated data (cache was invalidated by `approveReceipt` SA) |
| QA-5 | PersonalImpactCard on receipts page | supporter       | Navigate to `/account/receipts` with approved receipts                  | Card renders above the list with correct amounts; "Beta" badge visible          |

---

## Security Notes

- Auth required: `supabase.auth.getUser()` in the Route Handler; 401 if no session
- The query uses the authenticated `user_id` as a filter — the `receipt_uploads` RLS policy provides defense-in-depth: even if the Route Handler has a bug, RLS prevents reading another user's receipts
- `spend_events` does not expose `user_id` — personal impact attribution stays inside the `receipt_uploads` table
- Cache keys include `userId` — one user's cached result cannot be served to another user

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, zero data, error → null card, populated)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
