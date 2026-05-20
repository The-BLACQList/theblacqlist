# Ticket 073: Product create/update/delete Server Actions — vendor owner dashboard (/dashboard/products)

---

## Status

Draft

## Phase

Phase 13: Marketplace Foundation

## Priority

P3 — Low

## Estimate

L (4–8h)

## Feature Area

Marketplace

---

## Context

Vendor owners manage their product catalog from the owner dashboard. This ticket implements the four Server Actions that power product lifecycle management (`createProduct`, `updateProduct`, `deleteProduct`, `reorderProducts`) and the minimal dashboard UI at `/dashboard/products`.

The dashboard UI is a product management table: a list of all the vendor's products (including inactive ones), an "Add product" button, inline edit links, and drag-to-reorder capability. This is not a polished storefront — it is a functional management interface for the vendor owner.

Ownership enforcement is the critical security constraint: every Server Action must verify that `listings.owner_user_id = auth.uid()` for the target listing before any mutation. A vendor owner cannot create, edit, delete, or reorder products for a listing they do not own.

All mutations call `revalidateTag(\`vendor-${listingId}\`)` to invalidate the ISR-cached storefront page (Ticket 072).

Sources: `docs/blacqlist/architecture/server-actions-plan.md` § marketplace; `docs/blacqlist/data/database-schema-plan.md` § Commerce; `docs/blacqlist/architecture/error-handling-standard.md`.

---

## User Story

As a vendor owner, I want to add, edit, and remove products from my catalog in my dashboard, so that my storefront on The BLACQList stays current without needing to contact support.

---

## Scope

**In scope:**

- `lib/actions/marketplace/createProduct.ts` — Server Action; validates owner, validates input, INSERTs into `products`, handles image upload (calls `POST /api/upload`), enforces 100-product limit, revalidates tag
- `lib/actions/marketplace/updateProduct.ts` — Server Action; owner-only check; UPDATEs `products`; replaces images if changed; revalidates tag
- `lib/actions/marketplace/deleteProduct.ts` — Server Action; owner-only check; soft delete: sets `deleted_at = now()` (effectively removes from public catalog); revalidates tag
- `lib/actions/marketplace/reorderProducts.ts` — Server Action; owner-only check; accepts `[{ id: string, display_order: number }]` array; bulk UPDATEs `products.display_order`; revalidates tag
- `app/dashboard/products/page.tsx` — Server Component; authenticated Owner-only; renders the product management table
- `app/dashboard/products/new/page.tsx` — product create form page
- `app/dashboard/products/[id]/edit/page.tsx` — product edit form page
- Product management table columns: name, price (formatted), status (Active / Inactive badge), display_order, last updated, Actions (Edit link, Delete button)
- Add product button at top of the table: navigates to `/dashboard/products/new`
- Drag-to-reorder: uses `reorderProducts` Server Action; fires on drag end; optimistic update on the client
- Zod validation schemas: `createProductSchema`, `updateProductSchema` — stored in `lib/validations/marketplace.ts`
- Max 100 products per vendor: enforced in `createProduct` with a COUNT query before INSERT; returns `PRODUCT_LIMIT_EXCEEDED` if count >= 100
- Image upload: product images use the existing `POST /api/upload` Route Handler (Ticket 030) with `bucket: 'listing-media'`; up to 6 images per product
- `ActionResult<T>` return type on all Server Actions (standard pattern from `lib/errors/types.ts`)

**Out of scope:**

- Admin product moderation (Ticket 074)
- Vendor storefront page rendering (Ticket 072)
- Products table migration (Ticket 071)
- Bulk import of products — deferred
- Product variants (size, color) — deferred

---

## Dependencies

| Dependency                                           | Type            | Status                                         |
| ---------------------------------------------------- | --------------- | ---------------------------------------------- |
| Ticket 071 — `products` table migration and API      | Blocking ticket | Not started                                    |
| Ticket 030 — Media upload Route Handler              | Blocking ticket | Not started                                    |
| Ticket 014 — Auth flows                              | Blocking ticket | Not started                                    |
| Ticket 050 — Owner dashboard home (dashboard layout) | Blocking ticket | Not started                                    |
| `lib/errors/types.ts` — `ActionResult<T>` type       | Infrastructure  | Not started (from Ticket 050 scope or earlier) |

---

## UX Notes

- **Screen:** `/dashboard/products` — product management table
- **Route:** `/dashboard/products`, `/dashboard/products/new`, `/dashboard/products/[id]/edit`
- **Entry points:** Dashboard sidebar nav "Products" link; "Add product" button; Edit link in the table
- **Exit points:** Save → back to `/dashboard/products`; Cancel → back to `/dashboard/products`; Delete → confirmed and removed from table inline

**Product management table layout:**

```
[Add product] button (top right)
┌──────────┬────────┬──────────┬─────────────┬───────────┐
│ Name     │ Price  │ Status   │ Order        │ Actions   │
├──────────┼────────┼──────────┼─────────────┼───────────┤
│ Item A   │ $25.00 │ Active   │ ⠿ (drag)    │ Edit | ✕  │
│ Item B   │ $10.00 │ Inactive │ ⠿ (drag)    │ Edit | ✕  │
└──────────┴────────┴──────────┴─────────────┴───────────┘
```

**Create/Edit form fields:**

- Name (required)
- Price (required; number input `inputMode="decimal"`)
- Category (text; optional)
- Description (textarea; optional)
- Status toggle (Active / Inactive)
- Stock count (number; optional; label "Leave blank for unlimited")
- Images (up to 6; file input with preview)

**Delete flow:** Inline confirmation — clicking the ✕ button shows a shadcn/ui `AlertDialog` ("Are you sure? This product will be removed from your storefront."); on confirm, calls `deleteProduct`; on success, removes the row from the table optimistically.

**Drag-to-reorder:** Use `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop. Fire `reorderProducts` on drag end. Optimistic update: move the item in local state immediately; roll back if the action returns an error.

**Mobile behavior:**

- Product table: truncate name and price columns; hide display_order drag handle column; retain Edit and Delete actions
- Create/edit form: single column, full-width; submit button fixed at bottom of viewport

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `Badge`, `Button`, `AlertDialog`, `Form`, `Input`, `Textarea`, `Switch`, `Label`
- **Status badge:** "Active" → green `Badge`; "Inactive" → gray `Badge`
- **Add product button:** Amber Gold `#E2A428`, primary variant, positioned top-right above table
- **Drag handle:** `⠿` icon (GripVertical from `lucide-react`); visible on hover/focus
- **Form layout:** Two columns on desktop (name + price side by side); single column on mobile
- **Image upload:** `components/ui/ImageUploadField.tsx` (shared component from Ticket 030 or create here); shows thumbnails of uploaded images with a remove button per image
- **States to implement:** Loading (table skeleton), Empty (no products), Error (SA error toast), Success (optimistic table update)
- **Empty state:** Center-aligned in the table area: "You haven't added any products yet." with a prominent "Add your first product" button

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `products`, `listings`, `media_attachments`
- **Entities involved:** `products`, `media_attachments`
- **Operations:**
  - `createProduct`: INSERT `products` + INSERT `media_attachments` rows for images
  - `updateProduct`: UPDATE `products` + DELETE old `media_attachments` rows + INSERT new rows if images changed
  - `deleteProduct`: UPDATE `products SET deleted_at = now()` — soft delete
  - `reorderProducts`: UPDATE `products SET display_order = $n WHERE id = $id AND listing_id = $listing_id`

**Ownership check pattern (every action must implement this):**

```typescript
// Verify caller owns the listing
const { data: listing } = await supabase
  .from('listings')
  .select('owner_user_id')
  .eq('id', input.listingId)
  .single()

if (!listing || listing.owner_user_id !== user.id) {
  return { error: 'You do not own this listing.', code: ERROR_CODES.FORBIDDEN }
}
```

**100-product limit check in `createProduct`:**

```typescript
const { count } = await supabase
  .from('products')
  .select('*', { count: 'exact', head: true })
  .eq('listing_id', input.listingId)
  .is('deleted_at', null)

if ((count ?? 0) >= 100) {
  return { error: 'Maximum 100 products per listing.', code: ERROR_CODES.PRODUCT_LIMIT_EXCEEDED }
}
```

**Slug generation:** Auto-generated from `name` in the Server Action: `slugify(name)` → ensure uniqueness within the listing by appending `-2`, `-3`, etc. if a conflict exists. Use a helper in `lib/utils/slug.ts`.

**RLS policies:** Dashboard mutations use the authenticated Supabase client. The ownership check is in the service layer — RLS on `products` for authenticated users is `WHERE listing_id IN (SELECT listing_id FROM user_roles WHERE user_id = auth.uid() AND role = 'owner')`.

**Migration required:** No — `products` table is created in Ticket 071. Ticket 073 adds one new `ERROR_CODES` entry: `PRODUCT_LIMIT_EXCEEDED`.

---

## API Notes

- **Server Actions plan:** `docs/blacqlist/architecture/server-actions-plan.md` § marketplace

**All four mutations are Server Actions (not Route Handlers)** because they mutate data and must call `revalidateTag` for ISR invalidation.

**`createProduct` input:**

```typescript
{
  listingId: string         // UUID
  name: string              // required, 1–120 chars
  description?: string      // max 1000 chars
  price_cents: number       // required, >= 0
  category?: string
  status: 'active' | 'inactive'
  stock_count?: number      // >= 0
  imageFiles?: File[]       // max 6 files; handled via separate upload call
}
```

**`updateProduct` input:** Same as create plus `productId: string`; all fields optional except `productId` and `listingId`.

**`deleteProduct` input:** `{ productId: string, listingId: string }`

**`reorderProducts` input:** `{ listingId: string, items: Array<{ id: string, display_order: number }> }`

**`revalidateTag` call in all four actions:** `revalidateTag(\`vendor-${listingId}\`)`

**Error codes to handle in the UI:**

| Code                     | User message                                        |
| ------------------------ | --------------------------------------------------- |
| `PRODUCT_LIMIT_EXCEEDED` | "You've reached the 100-product limit."             |
| `FORBIDDEN`              | "You don't have permission to manage this listing." |
| `NOT_FOUND`              | "This product no longer exists."                    |
| `VALIDATION_ERROR`       | Inline field errors per field                       |
| `INTERNAL_ERROR`         | "Something went wrong. Please try again."           |

---

## Implementation Notes

**Files to create:**

- `lib/actions/marketplace/createProduct.ts`
- `lib/actions/marketplace/updateProduct.ts`
- `lib/actions/marketplace/deleteProduct.ts`
- `lib/actions/marketplace/reorderProducts.ts`
- `lib/validations/marketplace.ts` — `createProductSchema`, `updateProductSchema` zod schemas
- `app/dashboard/products/page.tsx` — product table; Server Component; fetches own products from Supabase directly
- `app/dashboard/products/new/page.tsx` — create form page
- `app/dashboard/products/[id]/edit/page.tsx` — edit form page
- `components/dashboard/products/ProductTable.tsx` — Client Component; renders the table with drag-to-reorder; receives `products` prop from Server Component
- `components/dashboard/products/ProductForm.tsx` — shared form for create and edit; receives `product?` prop for edit mode
- `lib/utils/slug.ts` — `slugify()` and `uniqueSlug()` helpers (or add to existing utils file)

**Files to modify:**

- `lib/errors/codes.ts` — add `PRODUCT_LIMIT_EXCEEDED`
- Dashboard sidebar nav — add "Products" link pointing to `/dashboard/products`

**Key patterns:**

- Follow the standard 7-step Server Action pattern from `docs/blacqlist/architecture/server-actions-plan.md`
- Image upload: do NOT upload files directly in the Server Action — Server Actions cannot stream multipart/form-data. The client component calls `POST /api/upload` first (Ticket 030), receives the storage path, then passes the path to the Server Action.
- `reorderProducts` must validate that all `id`s in the input array belong to the caller's `listingId` before updating — prevent cross-listing manipulation
- Use `@dnd-kit/core` and `@dnd-kit/sortable` for drag-to-reorder if not already installed; confirm not available in shadcn/ui before installing

**Do not:**

- Skip the ownership check for any of the four Server Actions — this is the primary security constraint
- Hard-delete products (use soft delete — set `deleted_at`)
- Expose `status` enum in UI; translate to Active / Inactive labels in the component layer
- Call `revalidatePath('/dashboard/products')` — revalidate the public storefront tag instead: `revalidateTag(\`vendor-${listingId}\`)`

---

## Acceptance Criteria

- [ ] Given a vendor owner on `/dashboard/products`, the product management table renders all their products (active and inactive) sorted by `display_order`
- [ ] Given no products, the empty state renders: "You haven't added any products yet." with "Add your first product" button
- [ ] Given the owner clicks "Add product", they are navigated to `/dashboard/products/new`; the form validates and calls `createProduct`; on success, they are redirected to `/dashboard/products` with the new product in the table
- [ ] `createProduct` enforces the 100-product limit; given a vendor at 100 products, submitting returns error "You've reached the 100-product limit."
- [ ] `updateProduct` updates the product and re-renders the table with new values
- [ ] `deleteProduct` soft-deletes the product (`deleted_at IS NOT NULL`); the product disappears from the table and from the public storefront after ISR revalidation
- [ ] Drag-to-reorder changes `display_order` values; optimistic update moves the card immediately; `reorderProducts` persists on drag end
- [ ] All four Server Actions return `FORBIDDEN` when called with a `listingId` the caller does not own
- [ ] `revalidateTag(\`vendor-${listingId}\`)` is called after every successful mutation
- [ ] Price input accepts decimal values (e.g., 25.99); `price_cents` is stored as `2599`
- [ ] Image upload works: up to 6 images per product; images appear as thumbnails in the form; removing an image deletes the `media_attachments` row on save
- [ ] Zod validation errors are shown inline per field on the create/edit form
- [ ] Mobile at 375px: create/edit form is single column; submit button is accessible without scrolling

---

## Failure States

| Failure                  | Condition                                                   | User sees                                                             | Recovery                                             |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Product limit reached    | COUNT >= 100 before create                                  | Toast error: "You've reached the 100-product limit."                  | Owner must delete an existing product first          |
| Ownership check fails    | `listingId` not owned by caller                             | Toast error: "You don't have permission to manage this listing."      | No action (should not be reachable via normal UI)    |
| Validation error         | Required field missing or out of range                      | Inline field errors below each invalid field                          | Correct and resubmit                                 |
| Product not found (edit) | Product was deleted between loading the form and submitting | Toast error: "This product no longer exists."                         | Redirect to `/dashboard/products`                    |
| Image upload fails       | `POST /api/upload` returns error                            | Inline error below the image input: "Image upload failed. Try again." | Retry upload; form submission blocked until resolved |
| Reorder fails            | `reorderProducts` returns error                             | Toast error: "Couldn't save new order. Please try again."             | Local state rolled back to previous order            |
| Server error             | Unexpected DB error in any SA                               | Toast error: "Something went wrong. Please try again."                | Retry                                                |

---

## Edge Cases

- Vendor owner with two listings (multi-listing edge case) — dashboard shows the first `owner` role listing at MVP; `reorderProducts` must validate ALL item IDs belong to the same `listingId` in the input
- `price_cents` input: user enters a value with more than 2 decimal places (e.g., "10.999") — truncate to 2 decimal places in the zod transform before converting to cents
- Slug conflict: two products with the same name → slug is `product-name` and `product-name-2`; `uniqueSlug()` must handle this without an infinite loop
- Owner deletes a product that is the last active product — the public storefront shows the "No products listed yet" empty state after ISR revalidation (no special handling needed in this ticket)
- Owner reorders an empty array — `reorderProducts` returns success immediately (no DB writes needed)
- Form navigated away mid-fill — no autosave at MVP; data is lost; this is acceptable for a dashboard form (not a public submission)

---

## Accessibility Notes

- [ ] Product table has appropriate `<th scope="col">` headers
- [ ] Drag handles are keyboard-operable: focus + Arrow Up/Down + Enter to confirm position (dnd-kit supports this natively with `KeyboardSensor`)
- [ ] Delete confirmation `AlertDialog` traps focus and returns focus to the delete button on cancel
- [ ] Form fields all have associated `<Label>` elements; required fields marked with `*` and a legend
- [ ] Inline validation errors are linked to their fields via `aria-describedby`
- [ ] Status badge uses both color and text label ("Active" / "Inactive") — not color alone

---

## QA Test Cases

| #    | Scenario                  | Role         | Steps                                                                       | Expected result                                                                                  |
| ---- | ------------------------- | ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| QA-1 | Create product happy path | Vendor owner | Navigate to `/dashboard/products/new`; fill all required fields; click Save | Product appears in the table; public storefront revalidated                                      |
| QA-2 | 100-product limit         | Vendor owner | Create 100 products then attempt to create a 101st                          | Error toast: "You've reached the 100-product limit."                                             |
| QA-3 | Ownership enforcement     | Vendor owner | Call `createProduct` with a `listingId` owned by another user               | Returns `FORBIDDEN` error; no product created                                                    |
| QA-4 | Delete product            | Vendor owner | Click ✕ on a product; confirm in AlertDialog                                | Product removed from table; `deleted_at` set; product not visible on public storefront after ISR |
| QA-5 | Drag to reorder           | Vendor owner | Drag product B above product A; release                                     | Product order updates optimistically; `reorderProducts` SA called; order persists on page reload |
| QA-6 | Validation errors         | Vendor owner | Submit create form with name and price empty                                | Inline errors shown under both fields; no product created                                        |
| QA-7 | Mobile form               | Vendor owner | Open `/dashboard/products/new` at 375px                                     | Single-column form; submit button visible without scrolling                                      |

---

## Security Notes

- Every Server Action verifies `listings.owner_user_id = auth.uid()` before any mutation — this is not optional
- `reorderProducts` validates all submitted `id` values belong to the caller's `listing_id` — prevents cross-listing data manipulation
- Image upload paths are validated server-side in `POST /api/upload` (Ticket 030); the Server Action only records paths returned by the upload endpoint, never paths provided directly by the client
- Slug is generated server-side — do not accept client-provided slugs in the create or update input

---

## Completion Checklist

- [ ] All four Server Actions implemented (`createProduct`, `updateProduct`, `deleteProduct`, `reorderProducts`)
- [ ] Ownership check present in every Server Action
- [ ] `revalidateTag(\`vendor-${listingId}\`)` called after every successful mutation
- [ ] 100-product limit enforced in `createProduct`
- [ ] Zod schemas in `lib/validations/marketplace.ts`
- [ ] Dashboard product table renders correctly (active + inactive products; drag handle)
- [ ] Create and edit forms render correctly; validation errors shown inline
- [ ] Delete confirmation AlertDialog implemented
- [ ] Drag-to-reorder implemented with optimistic update and rollback on failure
- [ ] `ERROR_CODES.PRODUCT_LIMIT_EXCEEDED` added to `lib/errors/codes.ts`
- [ ] All acceptance criteria verified
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested (table, drag handles, AlertDialog)
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
