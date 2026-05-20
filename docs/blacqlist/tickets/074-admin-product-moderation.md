# Ticket 074: Admin product moderation — /admin/products

---

## Status
Draft

## Phase
Phase 13: Marketplace Foundation

## Priority
P3 — Low

## Estimate
M (2–4h)

## Feature Area
Marketplace / Admin

---

## Context

Once vendors begin adding products to their catalogs (Ticket 073), platform admins need a way to review and moderate those products. This ticket adds an admin product moderation interface at `/admin/products`: a paginated table of all vendor products across the platform with filters for vendor, status, and flagged items, plus the ability to deactivate or reactivate individual products.

Admin product deactivation is distinct from vendor-initiated soft delete. An admin deactivation sets `products.status = 'inactive'` with a reason logged to `admin_audit_log`. The product is not deleted — it can be reactivated. Flagged products surface in the `moderation_queue` table.

No product creation from admin — vendors create and own their product catalogs. Admins can only moderate (activate, deactivate, flag).

Sources: `docs/blacqlist/architecture/server-actions-plan.md` § admin; `docs/blacqlist/data/database-schema-plan.md` § Admin; `docs/blacqlist/architecture/error-handling-standard.md`.

---

## User Story

As a platform admin, I want to review vendor products and deactivate any that violate platform policies, so that the marketplace remains trustworthy for visitors.

---

## Scope

**In scope:**
- `app/admin/products/page.tsx` — Server Component; admin-only auth guard; renders the product moderation table
- Product table columns: Product name, Vendor name (linked to the listing), Price, Status (Active / Inactive badge), Flagged indicator, Created at, Actions
- Filters: by vendor (text search), by status (`all` / `active` / `inactive`), by flagged (`flagged` / `all`)
- Pagination: 20 per page; server-side pagination
- `lib/actions/admin/deactivateProduct.ts` — Server Action; admin-only; sets `status = 'inactive'`, records `deactivation_reason`, writes to `admin_audit_log`, calls `revalidateTag(\`vendor-${listingId}\`)`
- `lib/actions/admin/reactivateProduct.ts` — Server Action; admin-only; sets `status = 'active'`, writes to `admin_audit_log`, calls `revalidateTag`
- `lib/actions/admin/flagProductForReview.ts` — Server Action; admin-only; inserts a row into `moderation_queue` with `entity_type = 'product'`, `entity_id = productId`; marks product as flagged
- Deactivate flow: clicking "Deactivate" opens an `AlertDialog` with a reason textarea (required, max 500 chars); on confirm, calls `deactivateProduct`
- Reactivate: single-click "Reactivate" button with confirmation; no reason required
- All admin mutations use `createServiceRoleClient()` (bypasses RLS)
- `insertAuditLog` is called for every mutation using the shared helper from `lib/admin/audit.ts`

**Out of scope:**
- Product creation from admin (vendors create their own products)
- Viewing or editing product content/images from admin — only status changes
- Bulk deactivation — deferred
- Automated AI moderation — deferred

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 073 — `createProduct` / product dashboard (products exist in DB) | Blocking ticket | Not started |
| Ticket 071 — `products` table migration | Blocking ticket | Not started |
| Ticket 037 — Admin layout, navigation, and auth guard | Blocking ticket | Not started |
| Ticket 012 — `admin_audit_log` and `moderation_queue` tables | Blocking ticket | Not started |
| `lib/admin/audit.ts` — `insertAuditLog` helper | Infrastructure | Not started |
| `lib/admin/serviceRoleClient.ts` — `createServiceRoleClient` | Infrastructure | Not started |

---

## UX Notes

- **Screen:** Admin Products — `/admin/products`
- **Route:** `/admin/products`
- **Layout:** Standard admin layout with left sidebar nav (Ticket 037); "Products" as active nav item under "Marketplace"
- **Entry points:** Admin sidebar nav "Marketplace → Products"; moderation queue links for product-type items
- **Exit points:** Vendor name link → admin listing detail (`/admin/listings/[id]`); deactivate → in-place row update; navigate back from AlertDialog via Cancel

**Filter bar layout:**
```
[Search vendor name...]  [Status: All ▾]  [Flagged: All ▾]
```
Filters apply immediately on change — no submit button. Active filters shown as chips below the bar.

**Table row states:**
- Normal row: white background
- Flagged row: amber left border or amber badge in the Flagged column
- Inactive row: slightly muted text color (`text-[#595758]`)

**Deactivate dialog:**
- Heading: "Deactivate product"
- Body: "This product will be removed from the vendor's storefront immediately."
- Reason textarea: required; placeholder "Reason for deactivation (required)"; max 500 chars
- Buttons: "Cancel" (ghost) + "Deactivate" (destructive variant)

**Mobile behavior:** Admin is primarily a desktop interface. On mobile, the table scrolls horizontally; the filter bar stacks vertically. Minimum viable — no special mobile layout required.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `Badge`, `Button`, `AlertDialog`, `Textarea`, `Select`, `Input`, `Skeleton`
- **Status badge:** "Active" → green `Badge`; "Inactive" → gray `Badge` (same pattern as Ticket 073)
- **Flagged indicator:** Amber `Badge` variant with text "Flagged"
- **Deactivate button:** `variant="destructive"` (red); Reactivate: `variant="outline"` (green border)
- **Reason textarea:** Full-width in the `AlertDialog`; character counter below (`N / 500`)
- **States to implement:** Loading (table skeleton), Empty (no products), Error (fetch failure), Success (table renders with correct data)
- **Empty state:** "No products found." — with an option to clear filters if any are active

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `products`, `listings`, `moderation_queue`, `admin_audit_log`
- **Entities involved:** `products`, `listings` (for vendor name), `moderation_queue`, `admin_audit_log`
- **Operations:**
  - `deactivateProduct`: UPDATE `products SET status = 'inactive'` + INSERT `admin_audit_log`
  - `reactivateProduct`: UPDATE `products SET status = 'active'` + INSERT `admin_audit_log`
  - `flagProductForReview`: INSERT `moderation_queue` (if no existing open flag) + UPDATE `products` (set a `flagged` boolean or rely on `moderation_queue` join)
- **Admin audit log entry format (for deactivateProduct):**
  ```typescript
  {
    admin_user_id: user.id,
    action: 'PRODUCT_DEACTIVATED',
    entity_type: 'product',
    entity_id: productId,
    reason: input.reason,
    metadata: { listing_id: listing.id, product_name: product.name }
  }
  ```
- **Flagged products query:** `LEFT JOIN moderation_queue mq ON mq.entity_type = 'product' AND mq.entity_id = p.id AND mq.resolved_at IS NULL` — join in the list query to include `is_flagged: boolean`
- **RLS:** All admin mutations use `createServiceRoleClient()` — bypasses RLS. The admin auth guard in Ticket 037 protects the route at the middleware level.
- **Migration required:** No — all tables from prior tickets. No new columns needed on `products` for flagging — use the `moderation_queue` join.

---

## API Notes

- **Server Actions plan:** `docs/blacqlist/architecture/server-actions-plan.md` § admin

All three mutations are Server Actions (not Route Handlers) — they mutate data, write to `admin_audit_log`, and revalidate ISR cache.

**`deactivateProduct` input:**
```typescript
{ productId: string, reason: string }   // reason: 1–500 chars
```

**`reactivateProduct` input:**
```typescript
{ productId: string }
```

**`flagProductForReview` input:**
```typescript
{ productId: string, flagReason?: string }
```

**Error codes:**

| Code | Condition | User sees |
|---|---|---|
| `FORBIDDEN` | Caller is not admin | 403; middleware should have caught this |
| `NOT_FOUND` | Product does not exist | Toast: "Product not found." |
| `ALREADY_FLAGGED` | Product already has an open flag in `moderation_queue` | Toast: "This product is already flagged for review." |
| `VALIDATION_ERROR` | Deactivation reason missing or too long | Inline error in the dialog |
| `INTERNAL_ERROR` | Unexpected DB error | Toast: "Something went wrong." |

---

## Implementation Notes

**Files to create:**
- `app/admin/products/page.tsx` — admin product table; Server Component; admin-only
- `lib/actions/admin/deactivateProduct.ts`
- `lib/actions/admin/reactivateProduct.ts`
- `lib/actions/admin/flagProductForReview.ts`
- `components/admin/products/ProductModerationTable.tsx` — Client Component; receives `products` prop; handles deactivate/reactivate/flag actions inline
- `components/admin/products/DeactivateProductDialog.tsx` — `AlertDialog` with reason textarea

**Files to modify:**
- Admin sidebar nav component — add "Products" link under a "Marketplace" section group
- `lib/errors/codes.ts` — add `ALREADY_FLAGGED` if not present

**Key patterns:**
- Admin auth check at the top of every Server Action: query `user_roles` for `role IN ('admin', 'super_admin')` using `createServiceRoleClient()`; return `FORBIDDEN` if not admin
- Use `insertAuditLog` from `lib/admin/audit.ts` for every mutation — this is non-optional
- After each mutation, call `revalidateTag(\`vendor-${listingId}\`)` to invalidate the public storefront cache
- For the product list query, JOIN `listings` to get vendor name and `listing_id`, and LEFT JOIN `moderation_queue` to compute `is_flagged`
- Filter parameters: accept `status` (`'all'` | `'active'` | `'inactive'`), `vendorSearch` (text), `flagged` (`'all'` | `'flagged'`) as URL search params; persist in URL

**Do not:**
- Create products from admin — the table is read-only except for status changes
- Hard-delete products — use status changes only (`status = 'inactive'`)
- Skip `insertAuditLog` on any admin mutation
- Use the anon Supabase client — all admin mutations use `createServiceRoleClient()`

---

## Acceptance Criteria

- [ ] Given an admin navigates to `/admin/products`, the table renders all products across the platform (active and inactive), paginated at 20 per page
- [ ] Vendor name column links to the admin listing detail page for that listing
- [ ] Status filter works: selecting "Active" shows only `status = 'active'` products; "Inactive" shows only inactive; "All" shows both
- [ ] Flagged filter works: selecting "Flagged" shows only products with an open entry in `moderation_queue`
- [ ] Vendor search filters the table to products from listings whose name matches the search text
- [ ] Given admin clicks "Deactivate" on an active product, the deactivate dialog opens with a required reason textarea
- [ ] Given admin submits the deactivate dialog without a reason, an inline validation error is shown
- [ ] Given admin deactivates a product with a reason, the product `status` is set to `inactive`, an `admin_audit_log` entry is created with the reason, the row in the table shows the "Inactive" badge, and `revalidateTag` is called
- [ ] Given admin clicks "Reactivate" on an inactive product and confirms, the product `status` is set to `active`, an audit log entry is created
- [ ] Given admin clicks "Flag for review" on a product, a `moderation_queue` row is created; the product shows the "Flagged" badge; clicking "Flag" again returns `ALREADY_FLAGGED` error
- [ ] Non-admin users attempting to call any of the three Server Actions directly receive `FORBIDDEN`
- [ ] Loading state: table skeleton renders while data fetches

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Product not found | Product deleted between table load and action | Toast: "Product not found." | Table refreshes on next navigation |
| Already flagged | Product already has an open moderation flag | Toast: "This product is already flagged for review." | No duplicate flag created |
| Validation error (deactivate) | Reason is empty or > 500 chars | Inline error in dialog | User corrects and resubmits |
| Server error | Unexpected DB error | Toast: "Something went wrong. Please try again." | Retry |
| Page fetch fails | Admin products table fails to load | Error boundary with "Couldn't load products." + retry | Retry re-fetches |

---

## Edge Cases

- Product table is empty (no vendors have created products yet) — empty state renders: "No products found."
- Admin deactivates a product that was already inactive — the action still succeeds (idempotent); audit log still written
- Vendor owner and admin both try to delete/deactivate the same product simultaneously — last write wins; both produce audit log entries; no data corruption
- A vendor is suspended (from Ticket 042) but their products are still visible in the admin products table — no change; admin must deactivate products separately
- `moderation_queue` already has a resolved flag for this product (`resolved_at IS NOT NULL`) — `flagProductForReview` creates a NEW open flag; this is correct behavior (multiple flags over time are expected)
- Filter URL state: admin navigates to `/admin/products?status=inactive&flagged=flagged` and shares the URL — the same filtered view should render for any admin opening that URL

---

## Accessibility Notes

- [ ] Table `<th>` elements have `scope="col"` and meaningful label text
- [ ] Deactivate `AlertDialog` traps focus; "Cancel" button focused on open; focus returns to the triggering "Deactivate" button on close
- [ ] Reason textarea has an associated `<Label>`; character counter is announced via `aria-live="polite"` on change
- [ ] Status badges use text labels — not color alone ("Active", "Inactive", "Flagged")
- [ ] Filter selects have associated `<label>` elements

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Table renders | Admin | Navigate to `/admin/products` | All products listed; vendor names, prices, status badges correct |
| QA-2 | Deactivate with reason | Admin | Click "Deactivate" on active product; enter reason "Policy violation"; confirm | Product status → Inactive; badge updated; audit log entry created with reason |
| QA-3 | Deactivate without reason | Admin | Click "Deactivate"; leave reason blank; click confirm | Inline validation error; product NOT deactivated |
| QA-4 | Reactivate | Admin | Click "Reactivate" on inactive product; confirm | Product status → Active; audit log entry created |
| QA-5 | Flag for review | Admin | Click "Flag for review" | `moderation_queue` row created; "Flagged" badge appears on product row |
| QA-6 | Duplicate flag | Admin | Click "Flag for review" on already-flagged product | Toast: "This product is already flagged for review." — no duplicate created |
| QA-7 | Status filter | Admin | Set Status filter to "Inactive" | Only inactive products shown in table |
| QA-8 | Non-admin access | Supporter | Call `deactivateProduct` SA directly | Returns `FORBIDDEN` |

---

## Security Notes

- All three Server Actions verify admin role using `createServiceRoleClient()` query against `user_roles` — do not trust JWT claims
- `deactivationReason` is stored in `admin_audit_log.reason` — sanitize for XSS before rendering (admin-facing display only, but good practice)
- All admin mutations bypass RLS via service role — ensure service role key is never exposed to the client

---

## Completion Checklist

- [ ] `app/admin/products/page.tsx` created with admin auth guard
- [ ] Product table renders with correct columns and data
- [ ] Status, vendor search, and flagged filters implemented and persist in URL
- [ ] `deactivateProduct` SA implemented with reason + audit log + revalidateTag
- [ ] `reactivateProduct` SA implemented with audit log + revalidateTag
- [ ] `flagProductForReview` SA implemented with `moderation_queue` insert + duplicate check
- [ ] `DeactivateProductDialog` component implemented with reason textarea + validation
- [ ] Admin sidebar nav updated with "Products" link
- [ ] All acceptance criteria verified
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
