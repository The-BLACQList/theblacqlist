# Entity Submission Workflow — Implementation Report

**Date:** 2026-05-11
**Checks:** `pnpm tsc --noEmit` → ✅ zero errors · `pnpm lint` → ✅ zero errors

---

## What Was Built

Full entity submission workflow for The BLACQList. Business owners can submit a listing through a 4-step form. Submissions land in `listings` + `listing_details_business`, are added to the `moderation_queue` for admin review, and trigger an `analytics_events` record. The listing is created with `status: 'pending'` and never auto-published.

---

## Files Created

| File                                        | Purpose                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `lib/actions/listings/submitListing.ts`     | Server action — validates all fields, creates listing + details, enqueues for moderation, fires analytics event |
| `app/add-business/page.tsx`                 | Auth-gated Server Component — fetches categories, renders form                                                  |
| `components/listings/SubmitListingForm.tsx` | 4-step Client Component form with localStorage draft, per-step validation, `useTransition` submission           |
| `app/add-business/submitted/page.tsx`       | Success confirmation page — reads listing name from URL param                                                   |

---

## Routes

| Route                                  | Auth         | Description                  |
| -------------------------------------- | ------------ | ---------------------------- |
| `GET /add-business`                    | Required     | 4-step submission form       |
| `GET /add-business/submitted?name=...` | Not required | Post-submission confirmation |

`/add-business` is already in `middleware.ts` `AUTH_REQUIRED_PREFIXES` — no middleware change needed.

---

## Form Steps

| Step                    | Fields                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| 1 — About your business | Entity type, business name, short description (tagline), category / subcategory                    |
| 2 — Where you operate   | Location type, city, state (conditional), service area description (conditional), ships nationwide |
| 3 — How to reach you    | Primary CTA type + link, website, contact email, phone, 6 social link fields                       |
| 4 — Your story          | Full description (required), founder story (optional)                                              |

---

## Validation Rules

| Field           | Rule                                                           |
| --------------- | -------------------------------------------------------------- |
| `entity_type`   | Must be one of 6 valid enum values                             |
| `name`          | 2–120 characters                                               |
| `tagline`       | 10–120 characters                                              |
| `category_id`   | Must exist in `categories` table with `is_active = true`       |
| `description`   | 20–2000 characters                                             |
| `location_type` | Must be one of 6 valid enum values                             |
| `cta_type`      | Must be one of 17 valid enum values                            |
| `website_url`   | Optional — must start with `https://` or `http://` if provided |
| `email`         | Optional — must match basic email pattern if provided          |
| `cta_url`       | Optional — must start with `https://` or `http://` if provided |
| Social fields   | Optional — must start with `https://` or `http://` if provided |

Client-side validation checks required fields before advancing steps. Server action re-validates all fields before any DB write.

---

## Database Operations

| Table                      | Client                         | Operation                                                                       |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `listings`                 | Authenticated (user)           | INSERT with `status: 'pending'`, `source: 'web_form'`, `owner_user_id: user.id` |
| `listing_details_business` | Authenticated (user)           | INSERT with all contact/description/social fields                               |
| `moderation_queue`         | Service role                   | INSERT (queue is admin-only, requires `createServiceClient()`)                  |
| `analytics_events`         | Service role (fire-and-forget) | INSERT (requires `createServiceClient()`)                                       |

If `listing_details_business` insert fails, the orphaned `listings` row is deleted before returning an error.

---

## Slug Generation

Slugs are generated deterministically from the business name (lowercased, normalized, non-alphanumeric stripped, spaces hyphenated, max 80 chars). If a collision is detected, a base-36 timestamp suffix is appended. This is handled entirely in the server action — no client input.

---

## Draft Persistence

Form state is saved to `localStorage` under key `draft-add-business` on every field change via a lazy `useState` initializer (SSR-safe with `typeof window === "undefined"` guard). The draft is cleared on successful submission. No server-side draft exists.

---

## Known Gaps

| Gap                                   | Notes                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `founder_story` not persisted         | Column not yet in `listing_details_business` schema. Field is collected in the form but not sent to the server. Add `founder_story text` column (Ticket 009 or new migration) and add `founder_story: founderStory` to the server action insert. |
| Image / logo upload                   | Not implemented. The form spec included logo upload as optional-if-storage-ready. Storage integration is a separate ticket (see Ticket 030).                                                                                                     |
| Draft form for incomplete submissions | No `draft` status flow. All submissions go directly to `pending`. If a draft lifecycle is needed (save without submitting), that requires a new `status: 'draft'` value and separate UI.                                                         |
| Multi-owner listings                  | Not supported. One listing is always owned by the submitting user.                                                                                                                                                                               |

---

## Admin Dependency

Submitted listings are added to `moderation_queue` with `queue_type: 'new_submission'` and `status: 'pending'`. They will not appear publicly until an admin sets `listings.status = 'approved'`. The admin moderation queue UI is covered by Ticket 038.

---

## Next Ticket Recommendation

- **Ticket 030 — Media Upload API**: Logo/photo upload for listings (Supabase Storage). Required to complete the form's optional image field.
- **Ticket 038 — Admin Listings Table**: Moderation queue UI — admins need a way to approve/reject the submissions this workflow creates.
- **New migration**: Add `founder_story text` column to `listing_details_business` and update the server action.

---

## Test Checklist

```bash
pnpm tsc --noEmit   # ✅ zero errors
pnpm lint           # ✅ zero errors
```

**Manual golden path (requires Supabase project connected):**

1. Sign in as a test user
2. Navigate to `/add-business`
3. Step 1: select entity type, enter name + short description, select category
4. Step 2: select location type, enter city/state
5. Step 3: select CTA type, enter at least one contact field
6. Step 4: enter description (20+ chars), click "Submit for review"
7. Verify redirect to `/add-business/submitted?name=...`
8. Check Supabase: `listings` row with `status = 'pending'`, matching `listing_details_business` row, `moderation_queue` entry

**Edge cases to verify:**

- Step 1 "Continue" with empty fields → inline errors appear, step does not advance
- Step 4 "Submit" with description < 20 chars → inline error appears
- Category with subcategories → subcategory select appears; error fires if subcategory not selected
- Navigate back from step 3 to step 1 → field values preserved
- Refresh page mid-form → draft restored from localStorage
- Submit with duplicate business name → second listing created with timestamp-suffixed slug
- Submit without Supabase connection → server error displayed on step 4
