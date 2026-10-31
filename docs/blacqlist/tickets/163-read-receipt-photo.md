# Ticket 163: Read the receipt photo, fill the form and match the business

**Phase:** V1.5 · **Priority:** P2 · **Status:** Blocked on open question O1
**Depends on:** 162.
**Gates:**
- GATE-DEPLOY.
- If O1 picks A, this also needs GATE-PUBLISH (privacy policy update with notice), a Privacy agent review and counsel. A flag (`FEATURE_RECEIPT_READ`) stays off in prod until the updated policy is in effect.
- No migration unless the build adds a "read by" note to `receipt_uploads`.

**Decision record (founder, 2026-10-31):** "the photo should extract information when available ... match and autofill much of the receipt and even match the business by the receipt information."

---

## Why

Typing the amount and finding the business are the slowest parts of the form. The photo already holds both.

## Scope

In:

- **After a photo is chosen, read it and fill the fields.** The reader picks out:
  - business name;
  - address or phone, when printed;
  - total;
  - date.

  Every filled field is marked "From your photo" and can be changed. Nothing is sent until the shopper taps "Add a receipt".
- **Match the business against published listings,** using the name plus city, address or phone when they're printed.
  - One strong match: fill the business.
  - Several matches: show up to three to pick from.
  - No match: keep the name the reader found as `raw_business_name`, and show 168's invite once it's built.
- **If O1 is A (Claude on our server):**
  - A server action sends the image to Claude Haiku 5.5 through `lib/ai`, with the rate limit and spend ceiling, and asks for JSON only (name, address, phone, total, date).
  - Checkbox on the form, on by default: "Read my receipt for me. We send the photo to our AI provider to read it, and they don't keep it." When it's off, the shopper fills the form by hand.
  - The audit log records that a read happened. It never stores the image or the result.
  - Before the flag switches on, `app/(public)/privacy/PrivacyPolicy.tsx` changes in two places: the AI section ("we don't attach your receipts...") and Section 4 (receipt uploads). Counsel reviews the change, and notice goes out per the 2026-10-16 pattern.
- **If O1 is B (on the phone):** Tesseract-style reading in the browser, loaded only when a photo is chosen. No policy change.
- **Unreadable or blurry photo:** "We couldn't read this one. Fill it in below." The form still works.

Out:

- Line items, tax and tips. We read the total only.
- Auto-approval. Every receipt is still reviewed.

## Acceptance criteria

- Given a clear photo of a receipt from a listed business, the business, amount and date fill in, and each is marked "From your photo".
- Given a receipt from an unlisted business, the name fills in, and the form shows it isn't on the list yet.
- Given the read fails or times out after 8 seconds, the shopper fills the form by hand with no error blocking them.
- Given (A) the checkbox off, no request goes to the AI provider.
- Given (A) the flag off, no read happens and the checkbox doesn't show.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Reader errors or times out | Quiet note, fields stay empty | Type them |
| Spend ceiling reached | Checkbox hidden for the day | Type them |
| Reader returns a future date or $0 | That field is left empty | Type it |

## Tests

- Unit tests for the JSON parser and validation, the listing match scoring, and the flag and checkbox gating.
- A fixture set of five sample receipts (no real shoppers) for the matcher.
