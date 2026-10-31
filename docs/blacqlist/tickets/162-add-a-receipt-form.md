# Ticket 162: Add a receipt, photo required and on top, plus "I shopped here"

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none.
**Gates:** GATE-DEPLOY. No migration, no new dependency.
**Decision record (founder, 2026-10-31):** Screen 2 **A, short form, photo on top**. Q1 **Add a receipt**, Q2 **My receipts**, Q3 photo **required**, Q4 **"I shopped here" yes**, Q5 **within 3 business days**.

---

## Why

The photo is optional today and comes last. Without it the founder has nothing to check against, and nothing stops a future date or a made-up amount.

## Scope

In:

**1. `ReceiptSubmissionForm.tsx` order:**
1. Photo (required). Camera on phones via `capture="environment"`, plus a file picker, a preview, and Retake or Remove.
2. Business (today's match-as-you-type).
3. Amount, with `inputMode="decimal"`.
4. Date, already set to today.
5. One button, "Add a receipt".

Notes and the aggregate opt-out move under "More options".

**2. Server checks** in `lib/spend/receipt-input.ts` and `createReceiptSubmission.ts`:
- **New receipts need a photo:** return "Add a photo of your receipt" without one.
- **Edits keep the stored photo** unless a new one is chosen.
- **Date:** no future date, and nothing older than 90 days.
- **Amount:** greater than $0 and no more than $10,000.

  Both limits are named constants and covered by unit tests.

**3. "I shopped here" button** on business pages, shown when all of these hold:
- the reader is signed in;
- the business is published and not an event or job;
- The Collective is open.

It sits in `components/entity-page/EntityQuickActionBar.tsx` and links to `/account/receipts/new?listing=<id>`.

The new-receipt page reads `listing` and prefills the business. A bad or unknown id prefills nothing.

**4. Wording everywhere:** "Submit a receipt", "Submit receipt" and similar become "Add a receipt". Known places:
- `app/account/receipts/new/page.tsx`
- `app/account/receipts/page.tsx`
- `app/account/(overview)/page.tsx`
- `app/account/community-spend/page.tsx`
- `app/account/spending/page.tsx`
- `components/account/CollectivePanel.tsx`
- `app/(public)/flow-map/page.tsx`
- metadata titles

The list is always "My receipts".

**5. Success line:** "We'll check it within 3 business days."

Out:

- Reading the photo (163).
- Unlisted business invites (168).

## Acceptance criteria

- Given the form at 375px, the photo field is first. On a phone it opens the rear camera, and the button is reachable with one thumb.
- Given no photo, submit is blocked on the client and refused on the server with "Add a photo of your receipt".
- Given a future date, an amount of $0, or an amount over $10,000, the server refuses with a field error, and everything typed is kept.
- Given a pending receipt being edited without a new photo, the old photo stays.
- Given a signed-in member on a published business page, "I shopped here" opens the form with that business filled in.
- Given a signed-out reader, an event or job page, or The Collective switched off, the button doesn't show.
- Given a search of user-facing strings, "Submit a receipt" appears nowhere.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Photo upload fails | "Your photo didn't upload. Try again." Fields are kept | Try again |
| Photo over 10 MB or wrong type | Inline error naming the limit | Pick another photo |
| `?listing=` doesn't match a live business | Business field left empty | Type to search |

## Tests

- Unit tests for the photo-required, date and amount rules, and for the `listing` prefill parser.
- Existing receipt tests updated.
- Preview at 375px and 1280px. Keyboard through the form.
