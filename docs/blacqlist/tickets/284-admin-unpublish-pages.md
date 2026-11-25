# Ticket 284: Admin Unpublish for Pages

**Status:** In review. The founder approved the ticket and then the build on 2026-11-25 ("ok to merge 418 and build 284"). The merge and each migration need their own OK.

## Why

An admin can unpublish a job (ticket 235). Nothing in `lib/actions/admin/` takes any other live Page down, so a business Page comes down through a one-off script. Ops' process for owners who ask to be removed (active 2026-11-25) hides a Page by default and needs a button, an undo and a do-not-re-add mark.

## What the Code Does Today

Read on main `dc0f2d7`. No database was read or written, and nothing here was run.

### Can a Removed Page Come Back?

| Case | Answer | Where |
|---|---|---|
| Hidden, launch seeds run again | No. A slug that exists is skipped. | `scripts/seed-launch-listings.ts:320-334`; `supabase/seeds/001_listings.sql:215`; same clause in the other listing seeds |
| Hidden, collections seed runs again | Not added. Only published Pages are picked up. A row already in a collection stays and isn't public. | `scripts/seed-collections.ts:333-337` |
| Fully deleted, launch seed runs again | **Yes, published**, if it is still in the seed data. The slug is gone, so it is inserted again. | `scripts/seed-launch-listings.ts:297-320` |
| The owner republishes | No. The guard allows no owner move out of `unpublished`. | `20260926000000_listings_entitlement_guard.sql:236-247`; `lib/actions/dashboard/updateListingStatus.ts:58` |
| Someone claims it | No. A claim needs a published Page. | `lib/actions/claims/createClaim.ts:115` |
| Someone adds the business again | **Yes, as a new Page in review.** The name check looks at published Pages only, and the reviewer gets no warning. | `app/api/listings/duplicate-check/route.ts:92`; `lib/actions/listings/submitListing.ts:204` |
| An admin approves it | **Possible.** Only published and rejected are refused. No button shows for a hidden Page, but the server accepts the call. | `lib/actions/admin/approveEntity.ts:45-47` |

### What Happens to Its Content?

| | Hidden (`unpublished`) | Fully deleted |
|---|---|---|
| Page, search, map, sitemap | Not shown (`lib/listings/entityPage.ts:217`, `lib/services/search.ts:242`, `app/api/map/listings/route.ts:52`, `app/sitemap.ts:18`) | Gone |
| Saves ("followers") | Kept, not shown (`app/account/saved/page.tsx:46`) | Deleted |
| Reviews | Kept. **Still readable through the data API:** the read rule checks the review's status, not the Page's (`20260510000001_mvp_rls_policies.sql:665-674`) | Deleted |
| Photos | Kept. **A direct link still opens:** the bucket is public (`20260524000000_storage_buckets.sql:3`) | No code or trigger removes the files. **They stay.** |
| Claims, messages, booking requests, job payments | Kept | **Deleted** (`ON DELETE CASCADE`) |
| Receipts and spend events | Kept | Kept, no longer linked to the Page (`20260511000001:11,44`, `ON DELETE SET NULL`) |
| Paid plan | **Keeps billing.** Account deletion is the only place in `app/` or `lib/` that cancels a subscription (`lib/services/billing/accountDeletion.ts:47`). | **Keeps billing.** Our subscription row stays and loses its link to the Page (`20261201000000_owner_plan_pages.sql:61-64`, `ON DELETE SET NULL`). The first version of this ticket said the row was deleted; that was wrong. |

Almost every table that points to `listings` cascades. No app code deletes a published Page today.

## Scope

1. **Unpublish Page.** For any published Page that isn't a job, one at a time, on `app/admin/entities/[id]/page.tsx`. Two steps, like `components/admin/JobUnpublishAction.tsx`. `published` → `unpublished`, guarded on `published`. Jobs keep `unpublishJob`.
2. **Reason, required:** Owner Asked, Closed, Not Eligible, Duplicate, Other. Other needs a note.
3. **One transaction.** The status change, the audit row and the mark are written together by one service-role-only database function. `writeAuditLog` ignores a failed insert (`lib/admin/guard.ts:90-98`) and the job action doesn't await it, so neither is enough here. If any part fails, nothing changes and the admin is told.
4. **Put Back (undo).** Returns a Page to `published`, with its own required reason and audit row. Only for a Page whose latest hide is this action's audit row, so events hidden by the expiry sweep (`lib/services/expiry/sweeps.ts:430`) and jobs are left alone. Keeps the original `published_at`, and sends no approval email.
5. **Close the side door.** `approveEntity` refuses `unpublished`.
6. **Do-not-re-add mark.** A small admin-only table with no foreign key to `listings`, so it outlives a full delete. Holds Page id, slug, business name, city, date and reason; no owner name, email or phone. A checkbox sets it, on by default for Owner Asked. Put Back clears it; the audit log keeps the history.
7. **What respects the mark:**
   - `seed-launch-listings.ts` skips a marked slug, or the same name and city, and lists what it skipped. If it can't read the marks, it stops.
   - `supabase/seeds/*.sql` can't check it safely. The build adds a note in those files and decides whether the table itself should refuse a marked slug.
   - Admin review of a new Page shows a warning on a match. It never blocks.
   - The add-business name check stays as it is, so the public can't learn that a business asked to be removed.
8. **Owner view.** The "Taken Down" card in `components/dashboard/PublishSection.tsx` is for jobs only, so the owner of a hidden Page sees no status there. Extend it, with wording that fits a Page. An event that simply ended must not say it was taken down.
9. **Paid plan.** Confirm says when the Page is on a paid plan and that billing doesn't stop. A hidden Page can also keep its place in the owner's plan; the build checks this.
10. **Reviews.** The review read rule also requires a published Page, so reviews of a hidden Page aren't public. Authors still read their own.
11. **Refresh.** Page, city, map, search, sitemap and dashboard pages are refreshed after a hide or a Put Back.

## Not Included

- Full delete. It stays a one-off on the founder's words, and not before the mark exists.
- Emails to owners, refunds, cancelling a plan.
- Bulk hide. Removing photo files.

## Decisions for the Founder, at Build Time

- Is the mark on by default for Owner Asked?
- Is the reason list right?
- Should a hidden Page's photos stop opening from a direct link?

## Gates

A migration (the mark table, the function, the review rule) on staging and then production, each with its own founder OK. Hiding a Page stays GATE-MODERATION, per Page.

## Checks for the Build

- Unit tests: admins only; published only; jobs refused; reason required; a failed audit insert changes nothing; Put Back refuses a sweep-hidden event; `approveEntity` refuses `unpublished`; the seed skips a marked slug and stops when the marks can't be read.
- Database tests: the mark survives deleting its Page; signed-out and signed-in users can't read the marks; reviews of a hidden Page aren't readable.
- Staging: hide and put back one made-up Page. While hidden, check its Page, search, map, sitemap and reviews signed out, then run the seed and confirm it stays hidden.
- The admin panel at 375px and 1280px, by keyboard.

## Build Notes

Written during the build, 2026-11-25.

- **Migration first.** `20261207000000_admin_page_unpublish.sql` works with the code before this ticket. Until it is applied, the new buttons report an error, review of a new Page says the marks couldn't be checked, and `seed-launch-listings.ts` stops, so apply it before the merge.
- **Mark on by default for Owner Asked,** off for the other reasons. The admin can change it either way. Reason list as in Scope. Photos unchanged. The founder kept all three on 2026-11-25 ("keep the defaults").
- **The table refuses a marked Page.** Once a marked Page is fully deleted, a published row with its slug can't be inserted. A SQL seed file that still holds it stops with an error. The app never inserts a published row. While the hidden Page exists, seeds skip it as before.
- **Reviewer names** (`review_author_names`) follow the new review rule. Page owners and review authors keep reading what is theirs; the names list is for owners only while hidden.
- **The note stays in the audit log.** `moderation_notes` isn't written, since owners can read it.
- **A hidden Page keeps its place in the owner's plan.** Plan coverage looks at `deleted_at`, not status.
- **Map:** its data is cached for up to about an hour, so the success message says so.
- **No button clears a mark for a fully deleted Page,** and approving a new Page doesn't clear an old mark. Both take a one-off.

### Checked

- Migration tests (`tests/migrations/admin-page-unpublish.test.ts`) on a throwaway local Postgres 14. They skip in CI, which has no database for them.
- Unit tests for the actions, mark matching, plan notice, approval refusal, owner card and the launch seed (the real script against a fake client).
- The two forms and the warning at 375px and 1280px by keyboard, in a throwaway local page with made-up data.

- **Staging, 2026-11-25.** Migration applied; row counts unchanged; signed-out and signed-in users can't read the marks or call the functions. One made-up Page was hidden, put back and fully deleted:
  - Hidden: its page 404s; gone from search, the map, the sitemap and its city page. Its review and reviewer name aren't readable by the public; its author still reads the review, its owner reads both. The 15 other staging reviews stay readable.
  - Put back: live everywhere again, same `published_at`, mark cleared.
  - Owner: sees Taken Down with the support address at 375px and 1280px, no publish button, not the admin's note, and can't change the status.
  - Launch seed (the real script, with a made-up one-city file): hidden without a mark, the slug is skipped; hidden with a mark, or fully deleted with a mark, both the slug and a respelled name are skipped. After the full delete, inserting it published stops with an error.
  - Test data removed. Seven audit rows stay, since the audit log can't be changed.
  - The app ran locally in dev mode, so production caching (the map's hour) wasn't measured. The real city files weren't seeded.

### Not Checked Yet

- The admin page itself, signed in, on staging. No admin account was made for the test.
