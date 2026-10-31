# Ticket 165: Hearing back, an email when a receipt is counted or needs a fix

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 164 (the email buttons land there).
**Gates:**
- GATE-DEPLOY.
- GATE-DATA for one migration (staging first, then prod on the founder's word, with a down plan).
- The founder approves the email copy in the PR before merge.

**Decision record (founder, 2026-10-31):** Screen 4 **A, an email each time**, with a way to turn the counted emails off. Preset reasons on the review card.

---

## Why

A receipt that needs a fix is only useful if the shopper hears about it soon. Today no email goes out for either outcome.

## Scope

In:

- **Two transactional templates** in `lib/email/templates/`, shaped like `claim-approved.tsx`, each with one button:
  - `receipt-counted.tsx`:
    - subject "Your receipt is counted";
    - body: "Your $X at [Business] is counted. Your spend joined the map.";
    - button "See it on the map", to 166's screen.
  - `receipt-needs-fix.tsx`:
    - subject "Your receipt needs a quick fix";
    - body: the reason;
    - button "Fix and resend", to the edit page.
- **Sending.** `approveReceipt.ts` and `rejectReceipt.ts` send fire-and-forget, the way `approveEntity.ts` does. A failed send never fails the review.
- **Preset reasons on the `/admin/receipts` review card:**
  - "Photo is hard to read"
  - "Amount doesn't match the photo"
  - "Date doesn't match the photo"
  - "Business isn't on the list"
  - "Looks like a duplicate"
  - "Other", with free text

  The chosen text is saved to `rejection_reason`, as today.
- **Turning the counted emails off.**
  - **Migration:** `profiles.receipt_counted_emails boolean not null default true`. Down plan: drop the column.
  - **Switch:** on the account settings page, labelled "Email me when a receipt is counted".
  - **Footer link:** every counted email links to it.
  - **Needs-a-fix emails always send.** They're about something the shopper started.

Out:

- A weekly digest.
- Push notifications.
- Emails to businesses.

## Acceptance criteria

- Given the founder approves a receipt, the shopper gets one "counted" email, unless their switch is off.
- Given the founder rejects with a preset reason, the shopper gets one "needs a fix" email with that reason and a button that opens the edit form.
- Given Resend is down or the address is missing, the review still succeeds.
- Given the switch is off, no counted email goes out and needs-a-fix still does.
- The email copy has no em dashes and names no other shopper.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Send fails | Review stands, `console.error` with the receipt id only | None for the shopper; My receipts shows the status |
| Profile read fails | Treat the switch as on | None |

## Tests

- Unit tests for the template text, the switch check, and that a failed send keeps the review result.
- Migration applied on staging, with a before and after column check.
