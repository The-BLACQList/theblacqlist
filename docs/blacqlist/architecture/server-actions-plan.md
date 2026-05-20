# Server Actions Plan — The BLACQList

**Last updated:** 2026-05-07
**Status:** Reference document for all backend engineers
**Owner:** Architecture + Engineering
**Related:** `api-contract-a.md`, `api-contract-b.md`, `api-contract-c.md`, `architecture-decisions.md`, `tech-stack-decision.md`

This document defines the mutation strategy for The BLACQList platform: when to use Server Actions vs. Route Handlers, how Server Actions are structured, and a complete inventory of every action across all phases and feature areas.

Engineers must read this document before writing any Server Action or Route Handler. If an action already exists in the inventory, do not create a duplicate.

---

## 1. Architecture Decision: Server Actions vs. Route Handlers

The BLACQList uses two server-side mutation mechanisms. Choosing the wrong one creates correctness problems (cache not invalidated after a mutation) or unnecessary complexity (heavy Server Action for a fire-and-forget toggle). The rules below are binding.

### Use Server Actions when:

- The operation mutates data (INSERT, UPDATE, DELETE) and the result affects a cached page
- The operation must call `revalidatePath` or `revalidateTag` after completing — any mutation that changes content on a publicly-ISR-cached route must use a Server Action to ensure revalidation fires in the same request lifecycle
- The operation originates from a form in a Client Component (works with `react-hook-form` + `useFormState` / `useActionState`)
- The operation requires multiple sequential DB writes that must succeed or fail together (multi-step mutations with consistent state)
- The operation is an admin moderation action that must write to `admin_audit_log` atomically with the primary mutation
- The operation changes trust tier, verification status, or claim ownership — anything that affects what is rendered on a BLACQList Page

### Use Route Handlers (`app/api/`) when:

- The operation is a GET (read-only — public discovery, search results, dashboard data fetches)
- The endpoint must be callable from mobile apps, external clients, or third-party services that cannot invoke Server Actions
- The operation is fire-and-forget without cache implications (analytics event recording, impression tracking)
- The operation receives a webhook payload from an external service (Stripe billing events, Resend delivery status)
- The operation handles file upload via multipart/form-data streaming (media uploads to Supabase Storage)
- The operation is a lightweight authenticated toggle with no ISR-cached page implications (`POST /api/saves`, `DELETE /api/saves` — saves state is session-specific, not rendered on public pages)

### Decision table

| Operation                       | Mechanism     | Reason                                                                |
| ------------------------------- | ------------- | --------------------------------------------------------------------- |
| Search listings                 | Route Handler | Public GET, mobile-accessible, no mutation                            |
| Get featured listings           | Route Handler | Public GET, ISR-cached at the CDN layer                               |
| Create listing draft            | Server Action | Mutation — inserts row, may trigger revalidation if auto-published    |
| Update listing draft            | Server Action | Mutation + revalidation if listing is published                       |
| Submit listing for review       | Server Action | Mutation + sends admin notification email                             |
| Publish listing (admin approve) | Server Action | Mutation + revalidation + audit log + approval email                  |
| Upload listing media            | Route Handler | Multipart/form-data streaming to Supabase Storage                     |
| Save listing (bookmark)         | Route Handler | Lightweight toggle, no public-page cache implications                 |
| Submit claim                    | Server Action | Mutation + admin notification email                                   |
| Approve claim                   | Server Action | Multi-step mutation + revalidation + audit log + email                |
| Submit review                   | Server Action | Mutation with validation + conflict check                             |
| Respond to review               | Server Action | Mutation + revalidation (review section on listing page)              |
| Submit data correction          | Server Action | Mutation — anonymous-accessible, inserts correction record            |
| Fire analytics event            | Route Handler | Fire-and-forget, unauthenticated                                      |
| Stripe webhook                  | Route Handler | External webhook receiver — must verify signature                     |
| Get owner dashboard data        | Route Handler | Authenticated GET, no mutation                                        |
| Approve / reject any entity     | Server Action | Admin mutation + audit log + revalidation + email                     |
| Moderate media                  | Server Action | Admin mutation + revalidation + audit log                             |
| Manage categories               | Server Action | Admin mutation + `revalidateTag` for all category-dependent pages     |
| Manage collections              | Server Action | Admin mutation + revalidation of collection pages                     |
| Get signed storage URL          | Server Action | Server-side URL generation (service_role required — no Route Handler) |

---

## 2. File Organization

All Server Actions live under `lib/actions/`. One action per file is preferred for actions with significant business logic (permission checks, multi-step writes, side effects). Closely related trivial actions (add/update/delete on the same child resource) may share a file if each function is separately exported and the file stays under ~200 lines.

```
lib/
  actions/
    account/
      updateProfile.ts
      setOnboardingRole.ts
      deleteAccount.ts               (V1)

    listings/
      createListing.ts
      updateListingDraft.ts
      submitListingForReview.ts
      publishListing.ts              (admin auto-approve path)

    dashboard/
      updateListingContent.ts
      manageCtas.ts
      addService.ts
      updateService.ts
      deleteService.ts
      reorderServices.ts
      deleteMedia.ts
      updateMediaAltText.ts
      reorderMedia.ts
      getListingAnalytics.ts

    claims/
      createClaim.ts
      withdrawClaim.ts

    reviews/
      createReview.ts
      updateReview.ts
      deleteOwnReview.ts
      respondToReview.ts             (Beta)
      reportReview.ts                (Beta)

    corrections/
      submitCorrection.ts            (Beta)

    admin/
      approveEntity.ts
      rejectEntity.ts
      approveClaim.ts
      rejectClaim.ts
      getVerificationDocUrl.ts
      updateVerificationStatus.ts    (V1)
      moderateMedia.ts
      moderateReview.ts
      resolveCorrection.ts           (Beta)
      manageCategories.ts
      manageCollections.ts
      manageCollectionItems.ts

    spend/                           (V2)
      createReceiptSubmission.ts
      createSpendLog.ts
      getReceiptImageUrl.ts

    marketplace/                     (V2)
      createProduct.ts
      updateProduct.ts
```

### Supporting modules (not Server Actions — shared helpers)

```
lib/
  admin/
    audit.ts                         (insertAuditLog helper + sanitizeState)
    serviceRoleClient.ts             (createServiceRoleClient factory)

  validations/
    listing.ts                       (zod schemas for listing mutations)
    claim.ts
    review.ts
    account.ts
    admin.ts
    spend.ts
    marketplace.ts

  email/
    resend.ts                        (sendNotificationEmail helper)
    templates/
      listingSubmitted.tsx
      listingApproved.tsx
      listingRejected.tsx
      claimReceived.tsx
      claimApproved.tsx
      claimRejected.tsx
      verificationGranted.tsx
      verificationRejected.tsx

  errors/
    codes.ts                         (ERROR_CODES const — see Section 6)
    format.ts                        (formatZodErrors helper)
    types.ts                         (ActionResult<T> type definition)
```

---

## 3. Standard Server Action Pattern

Every Server Action follows the same seven-step pattern without exception. Deviating from this pattern — skipping auth, running DB writes before validation, throwing instead of returning — is a defect.

### Return type

All Server Actions return `ActionResult<T>`. They never throw. The caller uses `'error' in result` to branch.

```typescript
// lib/errors/types.ts

export type ActionSuccess<T> = { data: T }
export type ActionError = {
  error: string // Human-readable — safe to display in UI
  code: string // Machine-readable — matches ERROR_CODES
  fields?: Record<string, string> // Field-level validation messages
}
export type ActionResult<T> = ActionSuccess<T> | ActionError
```

### Seven-step pattern

```typescript
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { type ActionResult } from '@/lib/errors/types'
import { ERROR_CODES } from '@/lib/errors/codes'
import { formatZodErrors } from '@/lib/errors/format'
import { insertAuditLog } from '@/lib/admin/audit'

const schema = z.object({
  // ... field definitions
})

export async function exampleAction(input: unknown): Promise<ActionResult<ResponseType>> {
  // STEP 1 — Get and validate session
  // Always use createServerClient with cookies() — never the browser client.
  // Always call supabase.auth.getUser() — not getSession() — to re-validate with the auth server.
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Authentication required.', code: ERROR_CODES.AUTH_REQUIRED }
  }

  // STEP 2 — Validate input
  // Validation runs before any DB operation. Never trust client-provided data.
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return {
      error: 'Validation failed. Please check the highlighted fields.',
      code: ERROR_CODES.VALIDATION_ERROR,
      fields: formatZodErrors(parsed.error),
    }
  }

  // STEP 3 — Check permissions
  // For owner-scoped operations: query the resource and verify ownership.
  // For admin operations: query user_roles for role='admin' or 'super_admin'.
  // Never rely on JWT claims or client-provided role values.
  const { data: ownership } = await supabase
    .from('listings')
    .select('id')
    .eq('id', parsed.data.listingId)
    .eq('submitted_by', user.id)
    .single()
  if (!ownership) {
    // Return NOT_FOUND rather than FORBIDDEN to avoid leaking resource existence
    return { error: 'Listing not found.', code: ERROR_CODES.NOT_FOUND }
  }

  // STEP 4 — Execute business logic
  // All mutations set updated_by = user.id on the target row.
  const { data, error: dbError } = await supabase
    .from('listings')
    .update({ ...parsed.data, updated_by: user.id })
    .eq('id', parsed.data.listingId)
    .select()
    .single()
  if (dbError || !data) {
    console.error('[exampleAction] DB error:', { userId: user.id, error: dbError })
    return { error: 'Operation failed. Please try again.', code: ERROR_CODES.OPERATION_FAILED }
  }

  // STEP 5 — Side effects (non-blocking, after successful DB write)
  // Audit log (admin actions only) — uses service_role client.
  // Email notifications — errors caught and logged, never thrown.
  // These run after the primary operation succeeds and before cache invalidation.

  // STEP 6 — Invalidate cache
  // Only after a confirmed successful DB write.
  // Provide the concrete path — never revalidatePath('/') globally.
  revalidatePath(`/${data.city_slug}/business/${data.slug}`)

  // STEP 7 — Return success
  return { data: { id: data.id } }
}
```

### Key implementation rules

| Rule                                          | Detail                                                                                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use `createServerClient` from `@supabase/ssr` | Never use the browser Supabase client in Server Actions                                                                                                                                             |
| Use `supabase.auth.getUser()`                 | Never `getSession()` — `getUser()` re-validates with the Supabase auth server on every call                                                                                                         |
| Admin operations use service_role client      | Use `createServiceRoleClient()` (from `lib/admin/serviceRoleClient.ts`) for audit log writes and any operation that bypasses RLS deliberately. Never expose the service_role key in Route Handlers. |
| Never return raw Supabase error messages      | Map all DB errors to friendly strings + `ERROR_CODES` constants                                                                                                                                     |
| Validate before any DB operation              | `safeParse` runs in Step 2; no `supabase.from()` calls before Step 3                                                                                                                                |
| All mutations: set `updated_by`               | Every `UPDATE` includes `updated_by: user.id` on the target table                                                                                                                                   |
| Cache invalidation after confirmed write      | `revalidatePath` / `revalidateTag` runs in Step 6, only if Step 4 succeeded                                                                                                                         |
| Never throw from a Server Action              | All error paths return `{ error, code }` — never `throw`                                                                                                                                            |

---

## 4. Complete Server Action Inventory

Legend:

- **Auth**: Minimum role required (`anon` = unauthenticated allowed, `supporter` = any authenticated user, `owner` = user with ownership of the specific listing, `admin` = platform staff)
- **Phase**: `MVP` / `V1` / `Beta` / `V2`
- **Cache**: Whether successful execution triggers `revalidatePath` or `revalidateTag`
- **Audit**: Whether an entry is written to `admin_audit_log`
- **Email**: Whether a notification email is sent via Resend

### Account

| Action              | File                           | Auth      | Phase | Cache | Audit | Email |
| ------------------- | ------------------------------ | --------- | ----- | ----- | ----- | ----- |
| `updateProfile`     | `account/updateProfile.ts`     | supporter | MVP   | No    | No    | No    |
| `setOnboardingRole` | `account/setOnboardingRole.ts` | supporter | MVP   | No    | No    | No    |
| `deleteAccount`     | `account/deleteAccount.ts`     | supporter | V1    | No    | No    | No    |

### Listings — Submission

| Action                   | File                                 | Auth      | Phase | Cache                                         | Audit | Email                    |
| ------------------------ | ------------------------------------ | --------- | ----- | --------------------------------------------- | ----- | ------------------------ |
| `createListing`          | `listings/createListing.ts`          | supporter | MVP   | No (draft created, not yet published)         | No    | No                       |
| `updateListingDraft`     | `listings/updateListingDraft.ts`     | owner     | MVP   | Yes — only if `status = 'published'`          | No    | No                       |
| `submitListingForReview` | `listings/submitListingForReview.ts` | owner     | MVP   | No (moves to pending review — not yet cached) | No    | Yes — admin notification |
| `publishListing`         | `listings/publishListing.ts`         | admin     | MVP   | Yes — listing page + city tag                 | Yes   | Yes — submitter notified |

### Owner Dashboard — Content Management

| Action                 | File                                | Auth  | Phase | Cache              | Audit | Email |
| ---------------------- | ----------------------------------- | ----- | ----- | ------------------ | ----- | ----- |
| `updateListingContent` | `dashboard/updateListingContent.ts` | owner | MVP   | Yes — listing page | No    | No    |
| `manageCtas`           | `dashboard/manageCtas.ts`           | owner | MVP   | Yes — listing page | No    | No    |
| `addService`           | `dashboard/addService.ts`           | owner | MVP   | Yes — listing page | No    | No    |
| `updateService`        | `dashboard/updateService.ts`        | owner | MVP   | Yes — listing page | No    | No    |
| `deleteService`        | `dashboard/deleteService.ts`        | owner | MVP   | Yes — listing page | No    | No    |
| `reorderServices`      | `dashboard/reorderServices.ts`      | owner | MVP   | Yes — listing page | No    | No    |
| `deleteMedia`          | `dashboard/deleteMedia.ts`          | owner | MVP   | Yes — listing page | No    | No    |
| `updateMediaAltText`   | `dashboard/updateMediaAltText.ts`   | owner | MVP   | Yes — listing page | No    | No    |
| `reorderMedia`         | `dashboard/reorderMedia.ts`         | owner | MVP   | Yes — listing page | No    | No    |
| `getListingAnalytics`  | `dashboard/getListingAnalytics.ts`  | owner | V1    | No (read-only)     | No    | No    |

Note: `getListingAnalytics` is included as a Server Action (rather than a Route Handler) because it requires the service_role client to aggregate across the `analytics_events` table against the owner's specific listings without exposing aggregation logic to the client. No mutation; no cache invalidation.

### Claims

| Action          | File                      | Auth      | Phase | Cache                              | Audit | Email                    |
| --------------- | ------------------------- | --------- | ----- | ---------------------------------- | ----- | ------------------------ |
| `createClaim`   | `claims/createClaim.ts`   | supporter | MVP   | No (claim enters moderation queue) | No    | Yes — admin notification |
| `withdrawClaim` | `claims/withdrawClaim.ts` | supporter | MVP   | No                                 | No    | No                       |

### Reviews

| Action            | File                         | Auth      | Phase | Cache                                               | Audit | Email |
| ----------------- | ---------------------------- | --------- | ----- | --------------------------------------------------- | ----- | ----- |
| `createReview`    | `reviews/createReview.ts`    | supporter | MVP   | No (review enters pending moderation)               | No    | No    |
| `updateReview`    | `reviews/updateReview.ts`    | supporter | MVP   | No (only editable while pending)                    | No    | No    |
| `deleteOwnReview` | `reviews/deleteOwnReview.ts` | supporter | MVP   | No                                                  | No    | No    |
| `respondToReview` | `reviews/respondToReview.ts` | owner     | Beta  | Yes — listing page (owner response shown on review) | No    | No    |
| `reportReview`    | `reviews/reportReview.ts`    | supporter | Beta  | No                                                  | No    | No    |

### Corrections

| Action             | File                              | Auth | Phase | Cache                                   | Audit | Email |
| ------------------ | --------------------------------- | ---- | ----- | --------------------------------------- | ----- | ----- |
| `submitCorrection` | `corrections/submitCorrection.ts` | anon | Beta  | No (correction enters moderation queue) | No    | No    |

Note: `submitCorrection` is the only Server Action accessible to unauthenticated users. It inserts into the `corrections` table and applies strict rate limiting at the middleware layer. No PII is required — `submitted_by` is nullable.

### Admin — Moderation and Management

| Action                     | File                                | Auth  | Phase | Cache                                                            | Audit                                                                    | Email                                   |
| -------------------------- | ----------------------------------- | ----- | ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| `approveEntity`            | `admin/approveEntity.ts`            | admin | MVP   | Yes — listing page + city tag                                    | Yes — `listing_approved`                                                 | Yes — submitter notified                |
| `rejectEntity`             | `admin/rejectEntity.ts`             | admin | MVP   | No (rejected listings are not publicly cached)                   | Yes — `listing_rejected`                                                 | Yes — submitter notified with reason    |
| `approveClaim`             | `admin/approveClaim.ts`             | admin | MVP   | Yes — listing page (trust_tier badge changes)                    | Yes — `claim_approved`                                                   | Yes — claimant notified with login link |
| `rejectClaim`              | `admin/rejectClaim.ts`              | admin | MVP   | No                                                               | Yes — `claim_rejected`                                                   | Yes — claimant notified with reason     |
| `getVerificationDocUrl`    | `admin/getVerificationDocUrl.ts`    | admin | V1    | No (signed URL, expires in 60 min)                               | Yes — `verification_doc_viewed`                                          | No                                      |
| `updateVerificationStatus` | `admin/updateVerificationStatus.ts` | admin | V1    | Yes — listing page (trust_tier changes to `verified`)            | Yes — `verification_status_updated`                                      | Yes — listing owner notified            |
| `moderateMedia`            | `admin/moderateMedia.ts`            | admin | MVP   | Yes — listing page (removed media no longer rendered)            | Yes — `media_moderated`                                                  | No                                      |
| `moderateReview`           | `admin/moderateReview.ts`           | admin | MVP   | Yes — listing page (review count + avg_rating update)            | Yes — `review_moderated`                                                 | No                                      |
| `resolveCorrection`        | `admin/resolveCorrection.ts`        | admin | Beta  | Conditional — yes if correction was applied to published listing | Yes — `correction_resolved`                                              | No                                      |
| `manageCategories`         | `admin/manageCategories.ts`         | admin | MVP   | Yes — `revalidateTag('categories')` affects all filter UIs       | Yes — `category_created` / `category_updated`                            | No                                      |
| `manageCollections`        | `admin/manageCollections.ts`        | admin | MVP   | Yes — collection page + `/collections` index                     | Yes — `collection_created` / `collection_updated` / `collection_deleted` | No                                      |
| `manageCollectionItems`    | `admin/manageCollectionItems.ts`    | admin | MVP   | Yes — collection page                                            | Yes — `collection_item_added` / `collection_item_removed`                | No                                      |

### Spend — Receipt and Dollar-Flow Logging (V2)

| Action                    | File                               | Auth      | Phase | Cache                            | Audit | Email |
| ------------------------- | ---------------------------------- | --------- | ----- | -------------------------------- | ----- | ----- |
| `createReceiptSubmission` | `spend/createReceiptSubmission.ts` | supporter | V2    | No                               | No    | No    |
| `createSpendLog`          | `spend/createSpendLog.ts`          | supporter | V2    | No                               | No    | No    |
| `getReceiptImageUrl`      | `spend/getReceiptImageUrl.ts`      | supporter | V2    | No (signed URL, caller-specific) | No    | No    |

### Marketplace (V2)

| Action          | File                           | Auth  | Phase | Cache                                                                       | Audit | Email |
| --------------- | ------------------------------ | ----- | ----- | --------------------------------------------------------------------------- | ----- | ----- |
| `createProduct` | `marketplace/createProduct.ts` | owner | V2    | No (draft created, not yet published)                                       | No    | No    |
| `updateProduct` | `marketplace/updateProduct.ts` | owner | V2    | Yes — vendor listing page (storefront), only if product `status = 'active'` | No    | No    |

---

## 5. Cache Invalidation Patterns

This section is the single source of truth for what paths and tags each Server Action revalidates. Engineers must not call `revalidatePath('/')` or revalidate paths that were not changed — over-invalidation defeats ISR caching and increases Supabase query load.

### Path and tag revalidation by action

| Action                                                                      | Revalidates                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `approveEntity(listingId, citySlug, listingSlug)`                           | `revalidatePath('/[citySlug]/business/[listingSlug]')` + `revalidateTag('city-[citySlug]')` |
| `publishListing(listingId, citySlug, listingSlug)`                          | `revalidatePath('/[citySlug]/business/[listingSlug]')` + `revalidateTag('city-[citySlug]')` |
| `updateListingDraft` — only when `status = 'published'`                     | `revalidatePath('/[citySlug]/business/[listingSlug]')`                                      |
| `updateListingContent` — only when `status = 'published'`                   | `revalidatePath('/[citySlug]/business/[listingSlug]')`                                      |
| `manageCtas` — only when listing `status = 'published'`                     | `revalidatePath('/[citySlug]/business/[listingSlug]')`                                      |
| `addService` / `updateService` / `deleteService` / `reorderServices`        | `revalidatePath('/[citySlug]/business/[listingSlug]')`                                      |
| `deleteMedia` / `updateMediaAltText` / `reorderMedia`                       | `revalidatePath('/[citySlug]/business/[listingSlug]')`                                      |
| `approveClaim(listingId, citySlug, listingSlug)`                            | `revalidatePath('/[citySlug]/business/[listingSlug]')` — trust_tier badge changes           |
| `updateVerificationStatus` — only when status moves to `approved`           | `revalidatePath('/[citySlug]/business/[listingSlug]')` — trust_tier changes to `verified`   |
| `moderateReview(reviewId, listingId, citySlug, listingSlug)`                | `revalidatePath('/[citySlug]/business/[listingSlug]')` — review count + avg_rating update   |
| `moderateMedia(mediaId, listingId, citySlug, listingSlug)`                  | `revalidatePath('/[citySlug]/business/[listingSlug]')` — removed media no longer rendered   |
| `resolveCorrection` — only if correction was applied to a published listing | `revalidatePath('/[citySlug]/business/[listingSlug]')`                                      |
| `manageCategories(categoryId)`                                              | `revalidateTag('categories')` — affects all city/category pages and filter UIs              |
| `manageCollections(collectionId, slug)`                                     | `revalidatePath('/collection/[slug]')` + `revalidatePath('/collections')`                   |
| `manageCollectionItems(collectionId, slug)`                                 | `revalidatePath('/collection/[slug]')`                                                      |
| `updateProduct` — only when product `status = 'active'`                     | `revalidatePath('/[citySlug]/vendor/[listingSlug]')` — storefront updates                   |

### ISR TTL reference

These TTL values define how long a page is served from cache before Next.js triggers a background revalidation. On-demand revalidation via the actions above fires immediately and overrides the TTL for any user request following the mutation.

| Route type                                     | ISR TTL           | On-demand revalidation                                         |
| ---------------------------------------------- | ----------------- | -------------------------------------------------------------- |
| Listing pages (`/[city]/business/[slug]`)      | 1 hour            | Yes — any content mutation on a published listing              |
| Vendor listing pages (`/[city]/vendor/[slug]`) | 1 hour            | Yes — any published product or content change                  |
| City index pages (`/[city]`)                   | 24 hours          | Yes — via `revalidateTag('city-[citySlug]')` on entity approve |
| City/category pages (`/[city]/[category]`)     | 24 hours          | Yes — via `revalidateTag('city-[citySlug]')`                   |
| Collection pages (`/collection/[slug]`)        | 1 hour            | Yes — via `revalidatePath` on collection or item change        |
| Collections index (`/collections`)             | 1 hour            | Yes — via `revalidatePath('/collections')`                     |
| Homepage, Discover                             | 30 minutes        | No — TTL-only; no on-demand revalidation needed                |
| Admin, Owner Dashboard, Account pages          | 0 (fully dynamic) | Not applicable — session-dependent, never cached               |

### Rule: never over-invalidate

`revalidatePath('/')` is forbidden. `revalidatePath('/[city]')` is forbidden unless the city index page content actually changed. Revalidate only the exact paths affected by the mutation. Each unnecessary revalidation triggers a full SSR re-render and a Supabase query for every path listed.

---

## 6. Error Handling in Server Actions

### ActionResult type

```typescript
// lib/errors/types.ts

export type ActionSuccess<T> = {
  data: T
}

export type ActionError = {
  error: string // Human-readable — safe to show in UI toast or inline message
  code: string // Machine-readable — match against ERROR_CODES
  fields?: Record<string, string> // Field-level messages for form validation display
}

export type ActionResult<T> = ActionSuccess<T> | ActionError

// Type guard — use in Client Components to branch on result type
export function isActionError(result: ActionResult<unknown>): result is ActionError {
  return 'error' in result
}
```

### formatZodErrors helper

Converts a Zod `ZodError` into a flat `Record<string, string>` keyed by field name, suitable for passing to `react-hook-form`'s `setError` or for returning in `ActionError.fields`.

```typescript
// lib/errors/format.ts

import { ZodError } from 'zod'

export function formatZodErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !fields[path]) {
      fields[path] = issue.message
    }
  }
  return fields
}
```

### Client component usage

```typescript
// In a Client Component form handler

const result = await updateListingContent(formValues)

if (isActionError(result)) {
  if (result.code === ERROR_CODES.VALIDATION_ERROR && result.fields) {
    // Map field errors back to react-hook-form
    for (const [field, message] of Object.entries(result.fields)) {
      form.setError(field as keyof FormValues, { message })
    }
  } else {
    // Surface non-field errors as a toast
    toast.error(result.error)
  }
  return
}

// Success path
toast.success('Listing updated.')
router.refresh()
```

### Error code constants

```typescript
// lib/errors/codes.ts

export const ERROR_CODES = {
  // Universal
  AUTH_REQUIRED: 'AUTH_REQUIRED', // No valid session
  FORBIDDEN: 'FORBIDDEN', // Valid session, wrong role
  NOT_FOUND: 'NOT_FOUND', // Resource does not exist or not owned
  VALIDATION_ERROR: 'VALIDATION_ERROR', // Zod parse failure
  CONFLICT: 'CONFLICT', // Unique constraint or state conflict
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION', // State machine violation
  OPERATION_FAILED: 'OPERATION_FAILED', // Unexpected DB or server error
  RATE_LIMITED: 'RATE_LIMITED', // Rate limit exceeded (middleware)

  // Domain-specific — Claims
  CLAIM_ALREADY_OPEN: 'CLAIM_ALREADY_OPEN', // User already has an open claim on this listing
  LISTING_ALREADY_CLAIMED: 'LISTING_ALREADY_CLAIMED', // Listing already has an approved owner

  // Domain-specific — Reviews
  REVIEW_ALREADY_EXISTS: 'REVIEW_ALREADY_EXISTS', // User already reviewed this listing
  RESPONSE_ALREADY_EXISTS: 'RESPONSE_ALREADY_EXISTS', // Owner already responded to this review

  // Domain-specific — Marketplace / Payments
  STRIPE_CONNECT_REQUIRED: 'STRIPE_CONNECT_REQUIRED', // Owner must complete Stripe Connect before publishing product
  DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION', // Idempotency key already processed

  // Domain-specific — Account
  ROLE_ALREADY_SET: 'ROLE_ALREADY_SET', // setOnboardingRole called after role is already assigned
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
```

### Error handling rules

**Rule 1: Never return raw Supabase error messages to clients.**
Supabase errors contain internal table names, constraint names, and sometimes column values. Map every DB error to a `code` constant and a generic human-readable string before returning. Log the raw error server-side.

```typescript
// Wrong
return { error: dbError.message, code: 'OPERATION_FAILED' }

// Correct
console.error('[updateListingContent] DB error:', { userId: user.id, listingId, error: dbError })
return { error: 'Failed to update listing. Please try again.', code: ERROR_CODES.OPERATION_FAILED }
```

**Rule 2: Never throw from a Server Action.**
Throwing causes Next.js to render the nearest error boundary, which strips the caller's ability to show field-level errors or recover gracefully. All error paths — validation failures, permission denials, DB errors — must return `{ error, code }`.

**Rule 3: Pattern for unexpected errors.**
Catch-all at the bottom of every action after all specific error branches:

```typescript
} catch (err) {
  console.error('[actionName] Unexpected error:', { userId: user?.id, input, err })
  return { error: 'Something went wrong. Please try again.', code: ERROR_CODES.OPERATION_FAILED }
}
```

**Rule 4: Use NOT_FOUND for ownership failures, not FORBIDDEN.**
When a user requests a resource they do not own, return `NOT_FOUND` rather than `FORBIDDEN`. `FORBIDDEN` confirms the resource exists, which leaks information about other users' data.

---

## 7. Admin Audit Log Pattern

Every admin mutation Server Action writes an entry to `admin_audit_log` before returning. The audit log uses the service_role client — it bypasses RLS because audit logs are INSERT-only and must not be suppressible by any user-scoped policy. No UPDATE or DELETE is permitted on `admin_audit_log` (enforced by a DB trigger).

### insertAuditLog helper

```typescript
// lib/admin/audit.ts

import { createServiceRoleClient } from '@/lib/admin/serviceRoleClient'

interface AuditLogEntry {
  adminUserId: string
  action: string
  targetTable: string
  targetId: string
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  ipAddress?: string | null
}

export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabaseAdmin = createServiceRoleClient()
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    admin_user_id: entry.adminUserId,
    action: entry.action,
    target_table: entry.targetTable,
    target_id: entry.targetId,
    before_state: entry.beforeState ? sanitizeState(entry.beforeState) : null,
    after_state: entry.afterState ? sanitizeState(entry.afterState) : null,
    ip_address: entry.ipAddress ?? null,
  })
  if (error) {
    // Log but never throw — audit failure must not fail the primary operation
    console.error('[insertAuditLog] Failed to write audit entry:', { entry, error })
  }
}
```

### sanitizeState

The `before_state` and `after_state` JSONB snapshots must never contain storage paths for private documents. `sanitizeState` strips these fields before writing.

```typescript
const SENSITIVE_FIELDS = ['verification_docs', 'doc_paths', 'image_path', 'file_path', 'signed_url']

function sanitizeState(state: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...state }
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }
  return sanitized
}
```

### Required audit log entries by action

Every action in this table must call `insertAuditLog` as Step 5 (side effects) before returning success. Omitting the audit log from any action in this list is a defect.

| Server Action                    | `action` value                | `targetTable`           | Notes                                                                                       |
| -------------------------------- | ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `approveEntity`                  | `listing_approved`            | `listings`              | Snapshot `status` before/after                                                              |
| `rejectEntity`                   | `listing_rejected`            | `listings`              | Include `rejection_reason` in `after_state`                                                 |
| `approveClaim`                   | `claim_approved`              | `listing_claims`        | Snapshot `status` before/after                                                              |
| `rejectClaim`                    | `claim_rejected`              | `listing_claims`        | Include `rejection_reason` in `after_state`                                                 |
| `getVerificationDocUrl`          | `verification_doc_viewed`     | `listing_verifications` | `before_state` and `after_state` both null — log the view only                              |
| `updateVerificationStatus`       | `verification_status_updated` | `listing_verifications` | Snapshot `status` before/after; `before_state` / `after_state` pass through `sanitizeState` |
| `moderateMedia`                  | `media_moderated`             | `listing_media`         | Include `moderation_action` (`hidden` / `deleted`) in `after_state`                         |
| `moderateReview`                 | `review_moderated`            | `reviews`               | Include `moderation_action` in `after_state`                                                |
| `resolveCorrection`              | `correction_resolved`         | `corrections`           | Include `resolution_type` in `after_state`                                                  |
| `manageCategories` (create)      | `category_created`            | `categories`            | `before_state: null`                                                                        |
| `manageCategories` (update)      | `category_updated`            | `categories`            | Snapshot changed fields                                                                     |
| `manageCollections` (create)     | `collection_created`          | `collections`           | `before_state: null`                                                                        |
| `manageCollections` (update)     | `collection_updated`          | `collections`           | Snapshot changed fields                                                                     |
| `manageCollections` (delete)     | `collection_deleted`          | `collections`           | Snapshot full row in `before_state`; `after_state: null`                                    |
| `manageCollectionItems` (add)    | `collection_item_added`       | `collection_items`      | `before_state: null`                                                                        |
| `manageCollectionItems` (remove) | `collection_item_removed`     | `collection_items`      | Snapshot row in `before_state`; `after_state: null`                                         |
| Any role assignment              | `role_assigned`               | `user_roles`            | Snapshot `role` + `listing_id` in `after_state`                                             |
| Any role revocation              | `role_revoked`                | `user_roles`            | Snapshot `role` + `listing_id` in `before_state`                                            |
| `publishListing` (admin path)    | `listing_approved`            | `listings`              | Same as `approveEntity` — shares audit action value                                         |

### Placement in the seven-step pattern

Audit log writes happen in Step 5 (after successful DB write, before cache revalidation). If the DB write in Step 4 fails, the audit log is not written — this is intentional. The audit log records what actually happened, not what was attempted.

```typescript
// Step 4 — DB write succeeded
// Step 5 — Audit log (non-blocking)
await insertAuditLog({
  adminUserId: user.id,
  action: 'listing_approved',
  targetTable: 'listings',
  targetId: listingId,
  beforeState: { status: 'pending_review' },
  afterState: { status: 'published' },
  ipAddress: ipFromRequestHeaders,
})
// Step 6 — Cache invalidation
// Step 7 — Return success
```

---

## 8. Email Notification Pattern

Email notifications are sent as non-blocking side effects in Step 5 of the Server Action pattern. An email send failure never fails the primary DB operation. All email errors are caught, logged, and (in V1) queued for retry.

### sendNotificationEmail helper

```typescript
// lib/email/resend.ts

import { Resend } from 'resend'
import type { ReactElement } from 'react'

const resend = new Resend(process.env.RESEND_API_KEY)

interface EmailTemplate {
  name: string
  subject: (data: Record<string, unknown>) => string
  component: (data: Record<string, unknown>) => ReactElement
}

export async function sendNotificationEmail(
  template: EmailTemplate,
  to: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await resend.emails.send({
      from: 'The BLACQList <noreply@theblacqlist.com>',
      to,
      subject: template.subject(data),
      react: template.component(data),
    })
  } catch (error) {
    // Email failure is non-fatal — log and move on
    console.error('[sendNotificationEmail] Send failed:', {
      template: template.name,
      to,
      error,
    })
    // TODO (V1): push to dead-letter queue for retry
  }
}
```

### Usage in a Server Action

```typescript
// Step 5 — Side effects (after successful DB write)

// Audit log (admin actions)
await insertAuditLog({ ... })

// Email notification (non-blocking)
await sendNotificationEmail(
  ListingApprovedTemplate,
  submitterEmail,
  { listingName: data.name, listingUrl: `https://theblacqlist.com/${citySlug}/business/${slug}` }
)

// Step 6 — Cache invalidation
revalidatePath(`/${citySlug}/business/${slug}`)
```

### Email notification inventory

All email templates use React Email components styled with BLACQList brand tokens (brand black `#0A0A0A`, Amber Gold `#D4A017` accents, Glacial Indifference for headings, Lato for body).

| Trigger                               | Template               | Recipient                                                       | Condition                                                                  |
| ------------------------------------- | ---------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `submitListingForReview`              | `listingSubmitted`     | Admin notification address (`ADMIN_NOTIFICATION_EMAIL` env var) | Every time an owner submits a listing for review                           |
| `approveEntity` / `publishListing`    | `listingApproved`      | Listing submitter's email                                       | When admin approves listing — listing goes live                            |
| `rejectEntity`                        | `listingRejected`      | Listing submitter's email                                       | When admin rejects listing — includes `rejection_reason` in email body     |
| `createClaim`                         | `claimReceived`        | Admin notification address                                      | Every time a new ownership claim is submitted                              |
| `approveClaim`                        | `claimApproved`        | Claimant's email                                                | When admin approves claim — includes magic-link login and dashboard URL    |
| `rejectClaim`                         | `claimRejected`        | Claimant's email                                                | When admin rejects claim — includes `rejection_reason`                     |
| `updateVerificationStatus` (approved) | `verificationGranted`  | Listing owner's email                                           | When verification status moves to `approved`                               |
| `updateVerificationStatus` (rejected) | `verificationRejected` | Listing owner's email                                           | When verification status moves to `rejected` — includes `rejection_reason` |

### Admin notification address

The admin notification email address is stored in the `ADMIN_NOTIFICATION_EMAIL` environment variable. It must never be hardcoded in action files. See `environment-plan.md` for the full environment variable inventory.

### Email template location

All React Email template components live in `lib/email/templates/`. Each template file exports a default React component and a `subject` function. Templates are typed; the `data` parameter is typed per-template, not as `Record<string, unknown>` in the actual template file — the loose type in the helper is for the generic wrapper only.

### V1 dead-letter queue note

In MVP, failed email sends are logged to console only. In V1, a dead-letter table (`email_send_failures`) will be added to capture the template name, recipient, data payload, and error for retry. The `sendNotificationEmail` helper's catch block is the single place where this retry hook will be added. No changes to calling Server Actions will be required.
