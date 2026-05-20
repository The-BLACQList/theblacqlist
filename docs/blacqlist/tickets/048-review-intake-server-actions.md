# Ticket 048: Review intake server actions and form (createReview, updateReview, deleteOwnReview)

---

## Status

Backlog

## Phase

Phase 7: Saves, Reviews, Corrections, Sharing

## Priority

P1 — High

## Estimate

M (2–4h)

## Feature Area

Reviews / Intake

---

## Context

At MVP, reviews are intake-only. Users can submit a star rating and written review for any published listing, but submitted reviews are stored with `status = 'intake'` and are NOT displayed publicly anywhere on the platform. The public BLACQList Page shows a "Reviews coming soon. Be part of the first wave." placeholder. Reviews are not moderated or displayed at MVP — they are collected to seed quality data before the public review system launches.

This ticket builds the three Server Actions that manage the review lifecycle (create, update, delete-own) and the `ReviewIntakeForm` component that users see on the BLACQList Page. The form is accessible from the BLACQList Page below the services section but reviewing the submitted content is not possible from the public page.

The admin can see the review intake count in the admin overview but cannot view individual reviews at MVP (moderation is deferred to the Beta / V1 review moderation phase).

Sources: `docs/blacqlist/architecture/server-actions-plan.md` § 4 (Reviews); `docs/blacqlist/architecture/api-contract.md` § Reviews (the contract section defines review endpoints); `docs/blacqlist/ux/mvp-screen-map.md` § Business BLACQList Page (Reviews placeholder).

---

## User Story

As a logged-in supporter, I want to submit a star rating and written review for a listing I've visited, so that my experience is captured and will be part of the platform's future public review system.

---

## Scope

**In scope:**

- `lib/actions/reviews/createReview.ts` — Server Action
- `lib/actions/reviews/updateReview.ts` — Server Action
- `lib/actions/reviews/deleteOwnReview.ts` — Server Action
- `components/reviews/ReviewIntakeForm.tsx` — "use client"; star rating selector + textarea + submit button
- `components/reviews/ReviewsSection.tsx` — the section on the BLACQList Page; contains the placeholder message AND the intake form; shows the form conditionally (authenticated only)
- Review form on BLACQList Page: accessible below the services section
- Star rating selector: 5 interactive stars; Amber Gold fill on hover/select; accessible keyboard navigation
- Textarea: min 20 chars; character counter showing `N / 1000` chars; max 1000 chars
- Form submit: calls `createReview`; on success shows a thank-you message inline; form resets
- If the user has already submitted a review for this listing: show the submitted review with options to "Edit" (pre-fills form) or "Delete"
- Edit: pre-fills form with existing review; submit calls `updateReview`
- Delete: confirmation inline → calls `deleteOwnReview`; on success replaces with the review intake form again
- Unauthenticated: `ReviewsSection` shows only the placeholder text; the form is not shown; a "Sign in to leave a review" link opens the sign-in modal
- Public BLACQList Page ALWAYS shows the placeholder: "Reviews coming soon. Be part of the first wave." — this is not replaced by the intake form count at MVP (count is admin-only)
- `createReview` fires a `review_submitted` analytics event (fire-and-forget)
- All three SAs follow the 7-step Server Action pattern; no cache invalidation (reviews are not displayed publicly at MVP)

**Out of scope:**

- Public display of reviews on the listing page (V1)
- Admin moderation interface for reviews (Beta/V1 — `moderateReview` SA)
- Owner responses to reviews (Beta — `respondToReview` SA)
- Review sorting, filtering, or pagination (V1)
- Average rating calculation for the listing's `avg_rating` field (V1 — when reviews go public)

---

## Dependencies

| Dependency                                                 | Type            | Status                                   |
| ---------------------------------------------------------- | --------------- | ---------------------------------------- |
| Ticket 011 — `reviews` table migration                     | Blocking ticket | Not started                              |
| Ticket 013 — Auth middleware                               | Blocking ticket | Not started                              |
| Ticket 014 — BLACQList Page layout and authenticated state | Blocking ticket | Not started                              |
| `lib/validations/review.ts` — zod schema                   | New file        | Created in this ticket                   |
| `SignInModal` component                                    | Component       | Must exist from Ticket 045 or earlier    |
| Ticket 049 — Analytics event ingestion API                 | Soft dependency | Fire-and-forget; stub if not yet shipped |

---

## UX Notes

- **Screen:** Business BLACQList Page — `docs/blacqlist/ux/mvp-screen-map.md` § Business BLACQList Page, Reviews Placeholder section
- **Route:** The review form is embedded in `/[city-slug]/business/[listing-slug]`
- **Entry points:** Scroll to the reviews section on the BLACQList Page
- **Exit points:** No navigation — form submits in-place; success message replaces the form

**Reviews section layout on the BLACQList Page:**

```
┌─────────────────────────────────────────────┐
│  Reviews coming soon.                        │
│  Be part of the first wave.                  │
│                                              │
│  [If authenticated and no prior review:]     │
│  ★ ★ ★ ★ ★  (interactive star selector)    │
│  [Textarea: Share your experience... ]       │
│  [Submit review]                             │
│                                              │
│  [If authenticated and review exists:]       │
│  "You reviewed this listing."                │
│  ★ ★ ★ ★ ☆  (4 stars)                     │
│  "Great experience..."                       │
│  [Edit] [Delete]                             │
│                                              │
│  [If unauthenticated:]                       │
│  [Sign in to leave a review →]              │
└─────────────────────────────────────────────┘
```

- Star selector: hover fills stars from left to current position; click locks the selection; clicking the same star again deselects (goes to 0, which blocks submit — at least 1 star required)
- Form state machine: Idle → Submitting (spinner, button disabled) → Success (thank-you inline) → Error (toast, form preserved)
- Character counter: shown below textarea; red when approaching limit (>900 chars); blocks submit at max

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** `ReviewIntakeForm` (custom), `StarRatingSelector` (custom — 5 star icons), shadcn/ui `Textarea`, `Button`, `Dialog` (delete confirm)
- **Star icons:** Use Lucide `Star` (filled) and `StarOff` or CSS-based fill control; Amber Gold (`#E2A428`) for hover/selected; Charcoal outline for unselected
- **Submit button:** Amber Gold, full-width on mobile; label: "Submit review"
- **Textarea placeholder:** "Share your experience with [Business Name]..."
- **Character counter position:** Right-aligned below the textarea; `text-sm text-muted-foreground`
- **Success state:** Replaces the form with: "Thank you for sharing your experience. Your review has been submitted." (Cream card, checkmark icon)
- **Edit mode:** Form re-renders with pre-filled values; submit button label: "Update review"
- **Delete confirm:** Inline below the review card: "Delete your review? This cannot be undone." + "Delete" (destructive) + "Cancel" buttons
- **States to implement:** Idle, Hover (stars), Submitting, Success, Error, Edit mode, Delete loading, Delete success

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `reviews`
- **Entities involved:** `reviews`
- **Operations:**
  - `createReview`: INSERT `reviews (listing_id, reviewer_user_id, rating, body, status='intake', source='web')`; check for existing review first → 409 if found
  - `updateReview`: UPDATE `reviews SET rating, body, updated_at` WHERE `id = review_id AND reviewer_user_id = auth.uid() AND status = 'intake'`
  - `deleteOwnReview`: DELETE `reviews` WHERE `id = review_id AND reviewer_user_id = auth.uid() AND status = 'intake'`
- **Validation rules:**
  - `listing_id`: required; valid UUID; listing must exist
  - `rating`: required; integer 1–5
  - `body`: required; min 20 chars; max 1000 chars
  - `createReview`: check uniqueness — one review per `(reviewer_user_id, listing_id)` combination; return `REVIEW_ALREADY_EXISTS` if found
  - `updateReview`: status must be `'intake'` — cannot edit a review that has moved to moderation
  - `deleteOwnReview`: ownership check (`reviewer_user_id = auth.uid()`) AND status must be `'intake'`
- **RLS policies:** Users can INSERT their own reviews; can UPDATE/DELETE their own reviews only while `status = 'intake'`
- **Migration required:** No — `reviews` table from Ticket 011

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/server-actions-plan.md` § 4 (Reviews)

**Server Actions:**

| Action            | File                                     | Auth      | Cache | Audit | Email |
| ----------------- | ---------------------------------------- | --------- | ----- | ----- | ----- |
| `createReview`    | `lib/actions/reviews/createReview.ts`    | supporter | No    | No    | No    |
| `updateReview`    | `lib/actions/reviews/updateReview.ts`    | supporter | No    | No    | No    |
| `deleteOwnReview` | `lib/actions/reviews/deleteOwnReview.ts` | supporter | No    | No    | No    |

**No cache invalidation for any review action at MVP** — reviews are not displayed on public ISR-cached pages. When the public review display is built (V1), `revalidatePath` will be added to `createReview` and `deleteOwnReview`.

**Request shapes:**

```typescript
// createReview
interface CreateReviewInput {
  listing_id: string // UUID
  rating: number // 1–5
  body: string // min 20, max 1000 chars
}

// updateReview
interface UpdateReviewInput {
  review_id: string // UUID; must be owned by auth.uid() and status='intake'
  rating: number // 1–5
  body: string // min 20, max 1000 chars
}

// deleteOwnReview
interface DeleteOwnReviewInput {
  review_id: string // UUID; must be owned by auth.uid() and status='intake'
}
```

**Error codes:**

| Code                        | Condition                        | UI shows                                                     |
| --------------------------- | -------------------------------- | ------------------------------------------------------------ |
| `AUTH_REQUIRED`             | Not authenticated                | Should not reach SA — form gated to authenticated users      |
| `REVIEW_ALREADY_EXISTS`     | Duplicate review attempt         | Show "Edit your existing review" inline; switch to edit mode |
| `NOT_FOUND`                 | Review ID not found or not owned | Toast: "Review not found."                                   |
| `INVALID_STATUS_TRANSITION` | Review status is not `'intake'`  | Toast: "This review can no longer be edited."                |
| `VALIDATION_ERROR`          | Body too short, rating missing   | Inline field errors below each field                         |
| `OPERATION_FAILED`          | Unexpected DB error              | Toast: "Couldn't submit review. Try again."                  |

---

## Implementation Notes

**Files to create:**

- `lib/actions/reviews/createReview.ts` — Server Action
- `lib/actions/reviews/updateReview.ts` — Server Action
- `lib/actions/reviews/deleteOwnReview.ts` — Server Action
- `lib/validations/review.ts` — zod schemas for `createReview` and `updateReview`
- `components/reviews/ReviewIntakeForm.tsx` — "use client"; star selector + textarea + submit
- `components/reviews/StarRatingSelector.tsx` — "use client"; reusable 5-star interactive selector
- `components/reviews/ReviewsSection.tsx` — "use client"; section container with placeholder + conditional form

**Files to modify:**

- `app/[city-slug]/business/[listing-slug]/page.tsx` — import and render `<ReviewsSection listingId={listing.id} listingName={listing.name} existingReview={userReview} isAuthenticated={!!user} />`

**Key patterns:**

- All three SAs follow the 7-step pattern from `server-actions-plan.md` § 3
- `createReview` Step 3: before INSERT, `SELECT id FROM reviews WHERE reviewer_user_id = auth.uid() AND listing_id = input.listing_id`; if found, return `REVIEW_ALREADY_EXISTS` with the existing review's ID in the `data` field so the UI can switch to edit mode
- `deleteOwnReview` is a hard delete (not soft delete) per the server-actions-plan inventory
- Analytics event in `createReview` Step 5: fire-and-forget via `fetch('/api/analytics/event', ...)` — do not await
- `StarRatingSelector` state: `hoveredRating: number | null` for hover preview + `selectedRating: number` for committed value; accessible via arrow keys (see Accessibility Notes)
- Form pre-fill for edit mode: `useForm` default values set from `existingReview`

**Do not:**

- Render any submitted reviews publicly at MVP
- Call `revalidatePath` from any review action at MVP
- Allow editing a review with `status != 'intake'` — this guard must be at the SA level, not just the UI
- Show the form to unauthenticated users — show only the placeholder text + sign-in link

---

## Acceptance Criteria

- [ ] Given an authenticated user navigates to a BLACQList Page they have not reviewed, then the reviews section shows the placeholder text AND the review intake form below it
- [ ] Given an unauthenticated user navigates to a BLACQList Page, then the reviews section shows only the placeholder text and a "Sign in to leave a review" link; no form is shown
- [ ] Given the user selects a star rating, then stars fill with Amber Gold up to the selected star; hovering over a different star previews the new selection; the selected star is highlighted after click
- [ ] Given the user submits a review with a rating and body text (min 20 chars), then `createReview` is called; on success the form is replaced with "Thank you for sharing your experience. Your review has been submitted."
- [ ] Given the user submits with fewer than 20 characters in the body, then the submit button is disabled or an inline error shows: "Review must be at least 20 characters."
- [ ] Given the user has already submitted a review for this listing, then their review is shown with "Edit" and "Delete" options instead of the blank intake form
- [ ] Given the user clicks "Edit" on their submitted review, then the form pre-fills with their existing rating and body text; submitting calls `updateReview`
- [ ] Given the user clicks "Delete" on their submitted review, then a confirmation prompt shows; on confirm `deleteOwnReview` is called; on success the blank intake form replaces the review
- [ ] Given `createReview` returns `REVIEW_ALREADY_EXISTS`, then the UI switches to edit mode showing the existing review
- [ ] Character counter shows `N / 1000` below the textarea; turns red above 900 characters; submit is blocked at 1000
- [ ] During SA call, the submit button shows a spinner and is disabled to prevent double-submission
- [ ] No submitted reviews are rendered publicly on the BLACQList Page at MVP — only the placeholder text and the intake form

---

## Failure States

| Failure                       | Condition                                      | User sees                                                                | Recovery                       |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| SA error on submit            | DB error                                       | Toast: "Couldn't submit review. Try again." Form values preserved        | Retry submit                   |
| Duplicate review              | Already reviewed this listing                  | Form switches to edit mode showing the existing review                   | Edit or delete existing review |
| SA error on update            | DB error                                       | Toast: "Couldn't update review. Try again." Form preserved               | Retry                          |
| SA error on delete            | DB error                                       | Toast: "Couldn't delete review. Try again." Review card stays visible    | Retry                          |
| Invalid status on edit/delete | Review moved out of `'intake'` by admin action | Toast: "This review can no longer be edited." Edit/Delete options hidden | None needed at MVP             |
| Session expired               | 401 during SA call                             | Toast: "Your session expired." + "Sign in" link                          | Re-authenticate                |

---

## Edge Cases

- User submits review on one device, then opens the same listing on a second device — the second device's page (if still showing the blank form from a cached SSR render) will hit `REVIEW_ALREADY_EXISTS` on submit and switch to edit mode
- Rating is selected but body is blank — submit button stays disabled; form validation prevents submission
- User pastes text with leading/trailing whitespace — body is trimmed server-side before length check; UI trims before displaying the character count
- Body text contains only whitespace (spaces, newlines) — after trim it is below min; validation error shown
- User clicks "Delete" and then closes the confirmation prompt without confirming — review card stays visible; no action taken
- Star rating: clicking the currently-selected star (e.g., 3/5) again — deselects to 0 (unrated); submit is blocked; the first star is re-highlighted on next hover

---

## Accessibility Notes

- [ ] `StarRatingSelector`: rendered as a `radiogroup` with `role="radiogroup"` and 5 `<input type="radio">` elements (or equivalent `role="radio"` buttons); each has an accessible label: "1 star", "2 stars", etc.
- [ ] Arrow keys navigate between star options; selected star is announced by screen reader
- [ ] Textarea has an associated `<label>` ("Your review") and `aria-describedby` pointing to the character counter
- [ ] Submit button: `aria-disabled="true"` when body is too short or no star is selected; not just visually disabled
- [ ] Error messages are linked to their fields via `aria-describedby` and announced via `aria-live="polite"`
- [ ] Inline delete confirmation: focus moves to the "Delete" button when the confirmation expands; focus returns to the "Delete" action row on cancel
- [ ] Success message: announced via `role="status"` or `aria-live="polite"` after form replaced

---

## QA Test Cases

| ID   | Test                       | Steps                                                                                                                       | Expected                                                                                                                                     |
| ---- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Happy path: submit review  | 1. Log in. 2. Navigate to a BLACQList Page. 3. Select 4 stars. 4. Enter 50+ chars of review text. 5. Click "Submit review". | `createReview` SA called. Review inserted with `status='intake'`. Thank-you message replaces form. `review_submitted` analytics event fired. |
| QA-2 | Edit review                | 1. Submit a review. 2. Click "Edit". 3. Change rating to 5. 4. Click "Update review".                                       | Form pre-fills. `updateReview` SA called. Success message shows. DB record updated.                                                          |
| QA-3 | Delete review              | 1. With an existing review, click "Delete". 2. Confirm.                                                                     | `deleteOwnReview` SA called. Review deleted from DB. Blank intake form shown.                                                                |
| QA-4 | Validation: body too short | 1. Select 3 stars. 2. Type 10 chars in textarea. 3. Click submit.                                                           | Inline error: "Review must be at least 20 characters." Submit blocked.                                                                       |
| QA-5 | Unauthenticated user       | 1. Log out. 2. Navigate to a BLACQList Page. 3. Scroll to reviews section.                                                  | No form shown. Placeholder text shown. "Sign in to leave a review" link present.                                                             |
| QA-6 | Public display confirm     | 1. Submit a review. 2. Open the BLACQList Page in an incognito window.                                                      | Placeholder text only visible: "Reviews coming soon." No review content displayed publicly.                                                  |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] `createReview`: review inserted with `status='intake'`; duplicate check works; analytics event fires
- [ ] `updateReview`: ownership check verified; status='intake' guard tested
- [ ] `deleteOwnReview`: ownership check verified; hard delete confirmed in DB
- [ ] `REVIEW_ALREADY_EXISTS`: UI switches to edit mode
- [ ] Star rating: hover preview, click to select, arrow key navigation, `aria-checked` state
- [ ] Character counter: shows count; red at >900; blocks submit at 1000
- [ ] No reviews displayed publicly — confirmed in incognito browser
- [ ] Mobile tested at 375px — form is usable; stars are tappable (44×44px tap target)
- [ ] Keyboard navigation: star selection via arrow keys; form submission via Enter/Tab
