# Ticket 205: Title Case across the site

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR; merges after the 16–17 Nov freeze)
**Depends on:** none. Conflicts with in-flight branches (204 chapters, the Shop worktree, `feat/header-search-cue`, `feat/prelaunch-waitlist`, `feat/shared-tester-invite`): merge this first after the freeze, then rebase them; the guard test flags any sentence-case label they add.
**Gates:** no migration. Two GATE-DATA questions below, not applied.
**House style:** [design/title-case.md](../design/title-case.md)

**Decision record (founder, 2026-11-14):**

1. "We should be using Title Case all through The BLACQList website. (Add a Listing, Claim a Business, etc.)"
2. **Scope:** the public site and sign-in, the owner dashboard and account, admin, emails and page titles.
3. **Text types:** headings, buttons, links styled as buttons, nav and footer links, tabs, menu items, badges and form field labels. Placeholders, helper text, running sentences and text from owners, reviewers or the database stay as written.

---

## What changed

One commit per area:

| Commit                      | Area                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Helper and scanner          | `lib/text/title-case.ts`, `scripts/title-case/scan.ts`, `scripts/check-title-case.ts`, `scripts/title-case-allowlist.json`                                                       |
| Public site and sign-in     | `app/(public)`, `app/(auth)`, `app/[citySlug]`, `app/example`, onboarding, add-business, `components/**` outside the dashboard and admin, category and label constants in `lib/` |
| Owner dashboard and account | `app/dashboard`, `app/account`, `components/dashboard`, `account`, `messaging`, `spend`, `tour`                                                                                  |
| Admin                       | `app/admin`, `components/admin`                                                                                                                                                  |
| Emails and page titles      | email buttons, eyebrows, sub-heads and subjects; template-literal page titles                                                                                                    |
| Guard                       | `tests/title-case-guard.test.ts`                                                                                                                                                 |

Tests changed only where they assert on visible text. No `it(...)` title was changed. Negative assertions that look for an old label now use a case-insensitive regex, so they keep proving the label is gone.

Two fixes came out of the sweep:

- `TemplateHero` compared a label against `'Local business'`, which would have broken silently. It now compares against `'Local Business'`.
- The receipt-to-verify email has its own subject (`receiptToVerifySubject`). `receiptToVerifyLine` stays a sentence because it is also the headline and the inbox preview.

## Judgment calls

- **A preposition at the end is capitalized** under the last-word rule: "Find Us At", "Order On", "What We Stand For".
- **Question headings use Title Case:** "What Do People Call You?", "Something Broken or Confusing?".
- **Kept as sentences** (in the allowlist, each with a reason): the password checklist ("A lowercase letter"), the banner quality notes ("Good on most screens"), checkbox options ("Open to brand deals"), and the "+3 more" count suffix. First-person role pickers ("I come to them") are also left as sentences.
- **Email headings that end in a full stop** ("Your claim for Mama's Kitchen is approved.") stay as sentences. Email subjects, buttons, eyebrows and sub-heads are Title Case.
- **"Special hours"** is left in source as is because CSS already shows it in capitals.
- **Busy-state aria-labels** that differ from the visible text only in case were left alone. Screen readers and voice control ignore case.
- **Admin rejection presets:** only the dropdown text changed. The reason saved and emailed is unchanged.
- **Body copy that names a button** now matches it ("Tap **Report a Problem**").

## GATE-DATA: for the founder, not applied

1. **Saved button labels.** Some pages saved a quick-start button label before this change, so `listing_details_business.cta_label_override` can hold "Email me", "Follow me" or "Work with me". New pages get "Email Me", "Follow Me" and "Work with Me". Should a one-off update rewrite the old rows to the new casing? The owner may have typed their own label, so only exact matches of the three presets would change.
2. **Category names in the database.** Category display names stored in the `categories` table show as stored. The constants in `lib/categories` are now Title Case. Should the stored names be updated to match?

## What the scanner and guard cannot see

The guard reads source with the TypeScript compiler. It does not flag:

- template literals with a `${value}`;
- labels returned from a function or held in a variable before use;
- text in a `<span>` inside a button.

These were reviewed by hand in this ticket. New code should follow [the house style](../design/title-case.md).

## Verification

- `npx tsx scripts/check-title-case.ts` reports 0 labels.
- `pnpm typecheck`, `pnpm lint`, and the full Vitest suite, guard included.
- `pnpm build`, Playwright and a visual pass are recorded in the PR.
