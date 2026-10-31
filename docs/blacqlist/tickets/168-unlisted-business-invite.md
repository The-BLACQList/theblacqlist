# Ticket 168: Unlisted businesses, a shopper invite and a private list

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready (O2 answered A + B, 2026-10-31)
**Depends on:** 162. It gets better with 163, which finds the name.
**Gates:**
- GATE-DEPLOY.
- GATE-COMMS for any message we send a business ourselves.
- GATE-DATA for one small migration: a table for business-invite sends (normalized name, city, emailed_at, opted_out, sent_by). The grouped list itself reads from `receipt_uploads.raw_business_name`. Staging first, prod on the founder's word, with a down plan.

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

- **O2 B, "Email this business" on each admin group:**
  - The founder types the business's email address (we never scrape one) and sees the message before sending.
  - **Message:** subject "Customers are adding your receipts on The BLACQList". Body: "Shoppers have been adding receipts from [Business] to The BLACQList. Add your business for free so they can find you: [link to /add-business]." Footer with our physical address and "Reply STOP and we won't email you again."
  - One business per send, never bulk, never automatic. Each send is the founder's GATE-COMMS act.
  - The group records "Emailed on [date]" so nobody emails twice. A business that replies STOP is marked and the button is disabled.
  - Founder approves the message copy in the PR.

Out:

- Bulk or automatic emails to businesses.
- Texts to businesses.
- Scraping contact details.

## Acceptance criteria

- Given an unmatched receipt, the shopper sees the invite with the ready text.
- Given the admin list, groups show names, counts and dates, and no shopper data.
- Given "Add as a listing", the admin form opens with the name filled in.
- Given a non-admin, `/admin/receipts/unlisted` is refused.
- Given the founder sends one business email, exactly one email goes to the typed address and the group shows "Emailed on [date]". A second send asks to confirm.
- Given a group marked opted out, the email button is disabled.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Share cancelled | Nothing | None |
| List read fails | "Couldn't load the list." | Try again |

## Tests

- Unit tests for the name normalizer and grouping, and the admin guard.
