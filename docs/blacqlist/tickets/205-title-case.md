# Ticket 205: Title Case across the site

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR; merges after the 16–17 Nov freeze)
**Depends on:** none. Conflicts with in-flight branches (204 chapters, the Shop worktree, `feat/header-search-cue`, `feat/prelaunch-waitlist`, `feat/shared-tester-invite`): merge this first after the freeze, then rebase them; the guard test flags any sentence-case label they add.
**Gates:** GATE-DATA, one migration for labels saved in the database (founder-approved 2026-11-14). Staging first; production with the merge.
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
| Saved labels                | migration, seed, `reviewCategoryRequest`, `scripts/ops/title-case-categories.ts` (see GATE-DATA below)                                                                           |

Tests changed only where they assert on visible text. No `it(...)` title was changed. Negative assertions that look for an old label now use a case-insensitive regex, so they keep proving the label is gone.

Two fixes came out of the sweep:

- `TemplateHero` compared a label against `'Local business'`, which would have broken silently. It now compares against `'Local Business'`.
- The receipt-to-verify email has its own subject (`receiptToVerifySubject`). `receiptToVerifyLine` stays a sentence because it is also the headline and the inbox preview.

## Judgment calls

- **A preposition at the end is capitalized** under the last-word rule: "Find Us At", "Order On", "What We Stand For".
- **Question headings use Title Case:** "What Do People Call You?", "Something Broken or Confusing?".
- **Kept as sentences** (in the allowlist, each with a reason): the password checklist ("A lowercase letter"), the banner quality notes ("Good on most screens"), checkbox options ("Open to brand deals"), and the "+3 more" count suffix. First-person role pickers ("I own a business") are also left as sentences.
- **Headlines and email headings that end in a full stop** ("Your claim for Mama's Kitchen is approved.") stay as sentences, as the founder decided. Email subjects, buttons, eyebrows and sub-heads are Title Case.
- **"Special hours"** is left in source as is because CSS already shows it in capitals.
- **Busy-state aria-labels** that differ from the visible text only in case were left alone. Screen readers and voice control ignore case.
- **Admin rejection presets:** only the dropdown text changed. The reason saved and emailed is unchanged.
- **Body copy that names a button** now matches it ("Tap **Report a Problem**").

## Founder answers (2026-11-14)

1. **Headlines written as a sentence, with a full stop:** "leave it". About 17 page headlines ("Your page. Your story. Your customers.", "Start free. Grow when you're ready.", "This page isn't on the list.") and the email headlines ("Your claim for Mama's Kitchen is approved.") stay as sentences. The scanner skips anything ending in a full stop on purpose.
2. **Saved button labels:** "Update it". Pages saved before this change can hold the old quick-start presets in `listing_details_business.cta_label_override`.
3. **Category names in the database:** "Update them".

## GATE-DATA: saved labels (founder-approved, staging first)

Migration `supabase/migrations/20261119000000_title_case_saved_labels.sql`:

| Table.column                                  | From                            | To                              |
| --------------------------------------------- | ------------------------------- | ------------------------------- |
| `listing_details_business.cta_label_override` | "Email me"                      | "Email Me"                      |
|                                               | "Follow me"                     | "Follow Me"                     |
|                                               | "Work with me"                  | "Work with Me"                  |
| `categories.name` (`ecommerce-solutions`)     | "E-commerce Solutions"          | "E-Commerce Solutions"          |
| `attribute_groups.name` (`audience-size`)     | "Audience size (self-reported)" | "Audience Size (Self-Reported)" |

- Every UPDATE matches the old text exactly. A label an owner typed is never touched, a row edited since is left alone, and a re-run is a no-op. Rollback SQL is in the migration header.
- The seed (`supabase/seed.sql`) carries the new names. Every other seeded category name was already Title Case; `tests/title-case-saved-labels.test.ts` keeps it that way and pins the presets to `lib/listings/quickStart.ts`.
- The creator filter heading is in the same migration because it is the same kind of stored label (a form heading). Drop that UPDATE if the founder wants it left.
- **Categories an admin added from a category request** exist only in each database. `scripts/ops/title-case-categories.ts` lists them (dry run by default) and renames them with `--apply --yes`, printing rollback SQL before the first write. Approving a new category now saves the name in Title Case (`reviewCategoryRequest`).
- **Order:** staging first (migration, then the script's dry run and apply). Production goes with the merge after the 16–17 Nov freeze: the migration with the deploy, then the script's dry run against production, which needs the founder's word like any production read.
- Tested on a throwaway Postgres 14: the migration renamed the three presets and both labels, left an owner label ("Book a discovery call"), a lowercase "email me" and NULL untouched, and a second run updated 0 rows. The script's dry run, refusal without `--yes`, apply and re-run all behaved as described.

One helper fix came out of this: "HR" was read as the unit "hr" and lowercased ("hr & Staffing"). An all-caps word now stays as written. No source label had been affected.

## What the scanner and guard cannot see

The guard reads source with the TypeScript compiler. It does not flag:

- template literals with a `${value}`;
- labels returned from a function or held in a variable before use;
- text in a `<span>` inside a button.

Defaults of label props (`{ submitLabel = 'Join the Waitlist' }`) are checked.

These were reviewed by hand in this ticket. New code should follow [the house style](../design/title-case.md).

## Verification

- `npx tsx scripts/check-title-case.ts` reports 0 labels.
- `pnpm typecheck`, `pnpm lint`, and the full Vitest suite, guard included.
- `pnpm build` passes (compiled and generated all 122 static pages, with the main checkout's `.env.local` linked in; local Supabase was down, so vendor pages logged handled fetch errors).
- Playwright did not run: its global setup needs local Supabase (`127.0.0.1:54321`) and Docker Desktop was stuck on an error dialog. Run `pnpm exec playwright test` before merge. String role names match case-insensitively, and the case-sensitive assertions in `e2e/` were updated.
- Visual pass (production build, 375 and 1280 px): home, `/pricing`, `/for-business`, sign-in. Buttons, nav, tabs and headings show Title Case with no wrapping or clipping. It turned up one scanner gap, defaults of label props (`submitLabel = 'Join the waitlist'`), now covered. `/example`, the dashboard and admin need a database and were not captured.
