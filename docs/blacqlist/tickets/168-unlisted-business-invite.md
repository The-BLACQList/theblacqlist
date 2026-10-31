# Ticket 168: Unlisted businesses, a shopper invite and a private list

**Phase:** V1.5 · **Priority:** P2 · **Status:** Blocked on open question O2
**Depends on:** 162. It gets better with 163, which finds the name.
**Gates:**
- GATE-DEPLOY.
- GATE-COMMS for any message we send a business ourselves.
- No migration if the list reads from `receipt_uploads.raw_business_name`.

**Decision record (founder, 2026-10-31):** "If the business isn't listed, we can use this as an opportunity to contact a new business to add or maybe have the customer prompt the business in some way."

---

## Why

A receipt from a business that isn't on the list is a lead. Today it becomes an "unmatched" row and nothing else happens.

## Scope

In (if O2 is A, the lean):

- **On the form and on the shopper's My receipts row** for an unmatched receipt: "This business isn't on The BLACQList yet. Invite them."
  - **The button** opens the share sheet, or Copy as the fallback.
  - **Ready text:** "I shop at your business and would love to see you on The BLACQList. You can add your business here: [link to /add-business]".
  - **Nothing is sent by us.**
- **Private admin list at `/admin/receipts/unlisted`.**
  - **Contents:** unmatched business names grouped by normalized name and city, with a receipt count and the last date seen.
  - **Never shown:** shopper names or ids.
  - **Action per group:** "Add as a listing", which opens the admin add flow prefilled with the name.
  - **Purpose:** the founder decides outreach from here.
- **Approval:** an unmatched receipt can still be approved. It counts toward the shopper's total but not the map, as today.

Out:

- Emails or texts from us to businesses (O2 B; each would be GATE-COMMS).
- Scraping contact details.

## Acceptance criteria

- Given an unmatched receipt, the shopper sees the invite with the ready text.
- Given the admin list, groups show names, counts and dates, and no shopper data.
- Given "Add as a listing", the admin form opens with the name filled in.
- Given a non-admin, `/admin/receipts/unlisted` is refused.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Share cancelled | Nothing | None |
| List read fails | "Couldn't load the list." | Try again |

## Tests

- Unit tests for the name normalizer and grouping, and the admin guard.
