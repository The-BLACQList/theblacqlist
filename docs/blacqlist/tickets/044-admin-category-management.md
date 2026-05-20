# Ticket 044: Admin category management (/admin/categories)

---

## Status
Backlog

## Phase
Phase 6: Admin Review and Verification

## Priority
P2 — Medium

## Estimate
M (2–4h)

## Feature Area
Admin / Categories

---

## Context

Categories are a core navigation and filtering primitive throughout the platform. They appear in the homepage category grid, in the discover and search filter bar, in the city + category pages, and on every listing card. Admins must be able to manage the category list: edit names and slugs, toggle active status, and control display order.

When categories change, the `revalidateTag('categories')` call must fire so that all pages using the category list — navigation, filter dropdowns, city pages — pick up the change on the next request.

Categories are never hard-deleted; they are deactivated. Deactivating a category with active listings does not remove those listings from the directory but it does hide the category from the navigation and filter UI.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` (no dedicated admin categories screen in the screen map but referenced in admin panel scope); `docs/blacqlist/architecture/server-actions-plan.md` §§ 4, 5 (`manageCategories`); `docs/blacqlist/architecture/api-contract.md` § Admin.

---

## User Story

As an admin, I want to manage the list of categories — edit their names, slugs, and descriptions, control their display order, and activate or deactivate them — so that the platform's navigation and filtering surfaces are always accurate and correctly ordered.

---

## Scope

**In scope:**
- `app/admin/categories/page.tsx` — Server Component, admin-only
- List of all categories (active and inactive) with columns: name, slug, listing count, active status toggle, display_order
- Drag-to-reorder rows by `display_order`; order is persisted on drop via SA
- Row action: "Edit" — opens an inline edit panel or modal with fields: name, slug (auto-generated from name, editable), description (textarea, optional), icon_name (text, optional), active toggle
- "Add new category" button — opens the same edit form pre-cleared for new entry
- No "Delete" action — categories are deactivated only; row remains in the list with an "Inactive" badge
- `manageCategories` SA handles both create and update operations
- On any create or update: `revalidateTag('categories')` to update navigation and filter dropdowns across the app
- Loading, empty, and error states

**Out of scope:**
- Category icon image uploads (icon_name is a text identifier referencing a bundled icon set)
- Category hierarchy / subcategories (deferred to V1)
- Public-facing category pages (existing tickets)
- Bulk category operations

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 037 — Admin shell + auth middleware | Blocking ticket | Not started |
| Ticket 007 — `categories` table migration and seed data | Blocking ticket | Must exist |
| `manageCategories` SA — `lib/actions/admin/manageCategories.ts` | Server Action | Not started |
| `admin_audit_log` table migration | Database | Must exist |

---

## UX Notes

- **Screen:** Admin Categories — referenced in `docs/blacqlist/ux/mvp-screen-map.md` § Admin panel scope
- **Route:** `/admin/categories`
- **Layout:** Admin panel — single-column list view; drag handle on left, row content center, actions right
- **Entry points:** Admin sidebar nav item "Categories" (may be under a "Content" sub-section)
- **Exit points:** No page navigation from this screen; all actions are inline
- **Drag-to-reorder:** Works identically to the collections editor reorder pattern — optimistic UI on drop, SA fires in background, rollback on error
- **Edit form:** Opens inline below the row (accordion-style expand) or in a Dialog — use inline expand to avoid a context switch; "Save" and "Cancel" buttons at the bottom of the expanded form
- **Active toggle:** `Switch` component directly in the row — fires SA on change without requiring the edit form
- **Mobile behavior:** Drag-to-reorder falls back to up/down arrow buttons; edit form is full-width below the row

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Card`, `Button`, `Badge`, `Switch`, `Input`, `Textarea`, `Skeleton`
- **Active badge:** Green "Active", gray "Inactive"
- **Drag handle:** `GripVertical` icon (Lucide) on the left of each row
- **Listing count:** Displayed as a small gray text next to the category name; read-only
- **Edit form fields:** Name (text, required), Slug (text, auto-generated), Description (textarea, optional, max 500 chars), Icon name (text, optional, placeholder: "e.g. utensils"), Active (Switch)
- **Add button:** Amber Gold, top-right of the page: "Add category"
- **States to implement:** Loading, Idle, Editing (inline form open), Saving, Saved, Error, Empty

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `categories`
- **Entities involved:** `categories`, `admin_audit_log`
- **Operations:**
  - SELECT: all categories ordered by `display_order ASC`; include listing count via subquery or join
  - `manageCategories` (create): INSERT `categories`; audit log `category_created`
  - `manageCategories` (update): UPDATE `categories`; audit log `category_updated`
  - `manageCategories` (reorder): UPDATE `display_order` for all affected rows
  - Active toggle (update): UPDATE `categories.is_active`; audit log `category_updated`
- **Validation rules:**
  - `name`: required; max 100 chars; min 2 chars
  - `slug`: required; max 100 chars; unique across `categories`; lowercase alphanumeric and hyphens; auto-generated from name but editable
  - `description`: optional; max 500 chars
  - `icon_name`: optional; max 50 chars; no special characters
  - `is_active`: boolean; deactivating does not affect existing listings
- **RLS policies:** Admin-only; write access via service_role or admin RLS policy
- **Migration required:** No — `categories` table from Ticket 007; seed data in that ticket

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/server-actions-plan.md` § 4 (`manageCategories`) + § 5

**Server Action:**

| Action | File | What it does |
|---|---|---|
| `manageCategories` | `lib/actions/admin/manageCategories.ts` | Create or update a category; validate slug uniqueness; `revalidateTag('categories')` after any change; audit log |

**Cache invalidation:** `revalidateTag('categories')` after every successful create or update. This tag must be applied to all data fetches that read from the `categories` table (nav menu, discover filter bar, add-business category select, city+category pages).

**Error codes to handle:**

| Code | Condition | UI shows |
|---|---|---|
| `AUTH_REQUIRED` | Session expired | Redirect to `/sign-in?next=/admin/categories` |
| `FORBIDDEN` | Not admin | Redirect to `/dashboard` |
| `VALIDATION_ERROR` | Name missing or slug conflict | Inline field error in the edit form |
| `CONFLICT` | Slug already in use | Inline: "This slug is already in use." |
| `OPERATION_FAILED` | Unexpected DB error | Toast: "Couldn't save. Try again." |

---

## Implementation Notes

**Files to create:**
- `app/admin/categories/page.tsx` — Server Component; fetches all categories + listing counts
- `components/admin/categories/CategoriesList.tsx` — "use client"; draggable + sortable list; inline edit form
- `components/admin/categories/CategoryEditForm.tsx` — "use client"; create/edit fields; calls `manageCategories` SA
- `lib/actions/admin/manageCategories.ts` — Server Action (create + update; slug uniqueness check; `revalidateTag`)

**Files to modify:**
- `app/admin/layout.tsx` (or sidebar) — ensure "Categories" nav item links to `/admin/categories`
- Any component using the categories list (nav, filter bar) — ensure it applies the `categories` cache tag via `unstable_cache` or `fetch` with `{ next: { tags: ['categories'] } }` so `revalidateTag` takes effect

**Key patterns:**
- Follow the 7-step Server Action pattern from `server-actions-plan.md` § 3
- `insertAuditLog` called in Step 5; `action = 'category_created'` for new entries, `action = 'category_updated'` for edits; snapshot changed fields only in `after_state`
- Slug auto-generation: same pattern as collections editor (title → lowercase hyphen-separated slug; stops auto-generating once admin manually edits the slug field)
- Reorder: same optimistic UI + rollback pattern as collections

**Do not:**
- Provide a hard-delete action — categories are deactivated only
- Allow deactivation of a category that is the only category for a large set of published listings without showing a warning (count displayed in the row is sufficient for this)
- Emit `revalidatePath('/')` for category changes — only `revalidateTag('categories')` is permitted

---

## Acceptance Criteria

- [ ] Given the admin navigates to `/admin/categories`, then a list renders showing all categories (active and inactive) with name, slug, listing count, active toggle, and display_order
- [ ] Given the admin drags a category row to a new position, then `display_order` updates optimistically in the UI and is persisted by the SA on drop
- [ ] Given the admin clicks "Edit" on a category, then an inline form expands with pre-filled name, slug, description, icon_name, and active toggle
- [ ] Given the admin modifies the name, then the slug auto-generates from the new name; once the admin manually edits the slug field, auto-generation stops
- [ ] Given the admin saves the edit form, then `manageCategories` is called, `revalidateTag('categories')` fires, the row updates inline with the new values, and a success toast shows: "Category updated."
- [ ] Given the admin clicks "Add category" and fills in the form, then a new category is created with the correct values, inserted at the end of the list, and visible in the table
- [ ] Given the admin toggles the active switch directly in the row, then the category's `is_active` updates immediately (optimistic) and is persisted
- [ ] Given the slug is already in use by another category, then the save is blocked and an inline error shows: "This slug is already in use."
- [ ] Loading state: skeleton rows while fetching; "Add category" button is visible immediately
- [ ] Empty state: should not occur post-seed, but if it does: "No categories yet. Add your first." + "Add category" button
- [ ] Audit log: `category_created` entry for new categories; `category_updated` entry for edits
- [ ] `revalidateTag('categories')` verified: nav and filter dropdowns reflect the change without a full redeploy

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Save fails | DB error | Toast: "Couldn't save. Try again." Form values preserved | Retry |
| Slug conflict | Slug already in use | Inline error below slug field | Change slug |
| Reorder fails | SA fails on drop | Original order restored (rollback); toast: "Reorder failed. Try again." | Re-drag |
| Active toggle fails | SA fails on switch change | Toggle snaps back to previous state; toast: "Couldn't update. Try again." | Retry |
| Session expired | 401 | Redirect to `/sign-in?next=/admin/categories` | Re-authenticate |

---

## Edge Cases

- Category with zero listings deactivated — listing count shows `0`; no downstream effect on existing listings (none exist for this category)
- Category name contains special characters (e.g., "Food & Beverage") — slug auto-generates as `food-beverage`; strip `&` and consecutive hyphens
- Very long category name (max 100 chars) — slug truncated to max 100 chars; no overflow in the table cell (ellipsis)
- Admin reorders while another admin is also reordering — last write wins; no conflict detection needed at MVP

---

## Accessibility Notes

- [ ] All form inputs have associated labels (`htmlFor` or `aria-label`)
- [ ] Active toggle (`Switch`) has an accessible label: `aria-label="Active — [Category Name]"`
- [ ] Drag handles have `aria-roledescription="Draggable"` and include the category name in the accessible label
- [ ] Arrow button reorder fallback (mobile) has `aria-label="Move [Category Name] up/down"`
- [ ] Inline edit form: focus moves to the first input when the form expands; focus returns to the "Edit" button on cancel/save
- [ ] Success and error toasts use `role="alert"`

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Edit category | 1. Log in as admin. 2. Navigate to `/admin/categories`. 3. Click "Edit" on a category. 4. Change the name. 5. Save. | Row updates with new name. `revalidateTag('categories')` fires. Navigation and filter bar reflect new name on next page load. Audit log entry created. |
| QA-2 | Add category | 1. Click "Add category". 2. Fill in name, description. 3. Save. | New category appears in list. `revalidateTag('categories')` fires. Category appears in discover filter bar. |
| QA-3 | Deactivate category | 1. Toggle active switch OFF on a category with listings. | Category `is_active = false`. Category disappears from nav and filter dropdowns after cache invalidation. Listings remain in the directory but the category filter no longer shows as an option. |
| QA-4 | Slug uniqueness | 1. Edit a category and set its slug to match an existing category's slug. 2. Save. | Inline error: "This slug is already in use." Save blocked. |
| QA-5 | Reorder | 1. Drag a category from position 3 to position 1. | Display order updates optimistically. SA persists new order. On page refresh, order is preserved. |
| QA-6 | Permission boundary | 1. Log in as owner. 2. Navigate to `/admin/categories`. | Middleware redirects to `/dashboard`. |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] `manageCategories` SA: create and update operations tested; `revalidateTag('categories')` fires
- [ ] Audit log entries verified for create and update
- [ ] Slug auto-generation tested with special characters
- [ ] Reorder drag tested; rollback on failure tested
- [ ] Active toggle tested: IS update persisted and rollback on failure works
- [ ] Nav and filter bar confirmed to reflect changes after `revalidateTag`
- [ ] Loading, empty (if applicable), error states tested
- [ ] Mobile tested at 375px — arrow button reorder fallback works
