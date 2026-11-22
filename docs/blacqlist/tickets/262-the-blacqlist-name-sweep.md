# Ticket 262: Always "The BLACQList"

**Status:** PR open, 2026-11-21. Follows 252, where the signed-in area was fixed first.

## Why

The founder (2026-11-21), reviewing the ticket 252 menu: "Not just BLACQList. Always The BLACQList." 252 fixed the signed-in pages. This ticket does the rest of the site. The founder asked for it first among the follow-ups ("name sweep first").

## Decisions (founder, AskUserQuestion, 2026-11-21)

- **Top trust tier:** "Certified by The BLACQList", in the same shape as "Verified by The BLACQList". Where space is tight (the round badges, the status pill, the search filter chip) it reads "Certified", next to "Claimed" and "Verified". This matches /about/trust, which already says "Certified".
- **Home-screen name** (`app/manifest.ts` `short_name`): "The BLACQList". It is 13 characters, so a few phones may cut it short.

## What Changed

Every bare "BLACQList" a visitor, owner, admin or email reader can see now says "The BLACQList". The wording is reshaped where a plain "The" in front would read badly:

- **"Your BLACQList Page" style** becomes "your page on The BLACQList": onboarding, sign-up, the claim band, the claim-approved email, For Vendors, Pricing, the AI social caption prompts.
- **"BLACQList admins"** becomes "The BLACQList's admins": the receipt privacy notes, the Privacy Policy, the receipt image notice, the admin notification emails.
- **"the BLACQList"** gets its capital: The Collective, its methodology, Pricing, For Sponsors, the Marketplace error.
- **Page titles:** "| The BLACQList Marketplace" and "| The BLACQList Admin".
- **Headings:** "Events on The BLACQList", "The BLACQList Marketplace", "The BLACQList Pricing", "Who Sponsors The BLACQList?".
- **Other wording:**
  - The reviewer fallback name is "Community Member".
  - A buyer with no usable name is "A member of The BLACQList".
  - The legal "upcoming" page descriptions read "The BLACQList's updated ... Policy".
- **Trust tier:** Terms, For Business, the listing trust panel and the chapters trust line all say "Certified by The BLACQList". The Terms change is the name only; no terms changed.
- While on the Marketplace error line, its em dash became a full stop.

**Left alone (code, not copy):**
- the crawler user agents (`TheBLACQList/1.0`);
- the title-case dictionary entry;
- the internal license key for first-party sample art (never shown);
- code comments;
- the `BLACQLIST` card descriptor;
- "BLACQLight".

Twelve of the touched files were not Prettier-formatted on main. Those got the word edits only, so the legal pages don't show hundreds of reflowed lines.

## Tests

- **`tests/brand-name-the.test.ts`** (new):
  - Scans `app`, `components` and `lib` (comments stripped) for a bare "BLACQList". "The" at the end of the previous line counts, because JSX wraps text.
  - Checks that the Terms and the trust panel use "Certified by The BLACQList".
- **`tests/listing-chapters.test.ts`:** the Certified badge reads "Certified", and the trust line reads "Certified by The BLACQList".
- **`e2e/listing-thin-page.spec.ts`:** the trust label pattern accepts "Certified".

## Verification

Local, 2026-11-21:
- Unit tests: 5801 passed. Typecheck clean.
- Lint: no errors. The 2 warnings were already on main (SaveButton, save-icon-button).
- Playwright on staging data (listing-thin-page, for-business-brand): 21 passed.

## Not in This Ticket

- Docs, ops notes and seed scripts. They are not seen by visitors.
- Database text, such as owner-written content or old email logs.
