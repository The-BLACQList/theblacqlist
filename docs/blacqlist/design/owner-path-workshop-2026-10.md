# Owner path workshop, round 1

**Audience:** founder and whoever builds the owner path next.
**Last updated:** 2026-10-31
**Canvas:** https://claude.ai/artifact/VQ1Mg2pJUFGirBQHYPvGtk (private to the founder until shared)

The founder asked (2026-10-31): show that a business has to be claimed before it can post a job, and combine the experience for people who publish their own page.

## What the code does today

`[Observed — repo at main 1d2f688]`

- Posting a job needs a page you own that is **published**. Nothing in the job path checks claims or `trust_tier` (`app/add-job/page.tsx:48-55`, `lib/actions/listings/postJob.ts:81-93`).
- Adding your own page makes you its owner (`owner_user_id`, `source='owner'`, `ownership_attested=true`) but leaves it `unclaimed` (`lib/actions/listings/createListing.ts:616-641`). Approval only sets the status (`lib/actions/admin/approveEntity.ts:46-54`).
- So a self-listed page goes live saying "This listing has not yet been claimed by its owner" with a "Claim this listing" button. Its owner can't ask for Verified (`submitVerificationRequest.ts:41`) and can't republish it themselves if they unpublish it.
- A claim on a page that already has an owner is accepted (`createClaim.ts:95`), and approving it overwrites the owner (`approveClaim.ts:75-82`). That is a safety bug and ships as ticket 159 whatever is picked here.
- `/add-job` with no live page says "You need a published business page first" and offers only "Add your business" (`components/jobs/post/StepRole.tsx:21-36`). It doesn't name a draft or a page in review, and it doesn't point to claiming a page that is already listed.
- Review time is written two ways: "1–3 business days" on `/add-business/submitted` and "3–5 business days" on the dashboard.

**The rule the founder wants, restated:** you can post a job once you own a live page. There are two ways to own one: claim a listed page, or add your own and have it approved. This workshop makes both ways end in the same place and makes the sign on `/add-job` say which step you're on.

## References

| Reference | Borrow | Avoid |
|---|---|---|
| Google Business Profile, "Own this business?" | Search first. If the business exists, the path is claim, and if it doesn't, create. Both end in one manager state | The long verification wait with no status. We show the step and the time |
| Yelp for Business, claim flow | "Find your business" opens the flow, and a duplicate result goes straight into claim | Upsells mixed into the claim flow |
| Etsy shop setup | A checklist that shows what's done and the one next step, and stays visible until you're live | A long checklist. Ours is three rungs |

**Current standards note:** marketplace and directory owner tools in 2026 lead with one search box ("find your business"), route found businesses to claim, show a short status checklist until the account can act, and disable actions with the reason shown next to them rather than hiding them.

**Trend read:**
- A progress checklist that stays until done will age well. It is a plain pattern that explains itself.
- Inline search results inside a form step (rather than a separate search page) will also age well, because it is less to build and less to learn.
- Skipped: celebration animations on approval. They date fast and add nothing to the job.

## Screens and options

1. **Who can post a job (`/add-job`).** A checklist; B next-step card; C inline in the business picker. Lean **A**.
2. **One front door.** A search page before `/add-business`; B keep both doors and cross-link them; C matches appear inside the first add-business step. Lean **C**.
3. **A self-listed page once approved.** A becomes Claimed on approval; B new "Listed by owner" label; C stays unclaimed with the claim button hidden. Lean **A**.
4. **Dashboard Post a job card.** A hidden until you can post (today); B shown with the step you're on. Lean **B**.
5. **Messages along the way.** A one shared "You manage this page" line plus a Post a job link everywhere; B keep today's copy and only add the Post a job link. Lean **A**.

## Questions

| # | Question | Lean |
|---|---|---|
| Q1 | Which review time do we say everywhere? | 3 to 5 business days (matches the dashboard and the claim copy) |
| Q2 | If 3A: move existing self-listed, approved pages to Claimed (ticket 160, staging count first, prod on your word)? | Yes |
| Q3 | If 3A: start the 90-day certification clock on the approval date? | Yes. We write an approved claim row on approval so the clock and the admin claim history both see it |

## Picks

`[Decision — founder, 2026-10-31]` All five picks and all three answers match the lean.

| Screen | Pick |
|---|---|
| 1. Who can post a job | **A, checklist** |
| 2. One front door | **C, matches inside step 1** |
| 3. A self-listed page once live | **A, Claimed on approval** |
| 4. Dashboard Post a job card | **B, shown with the step** |
| 5. Messages along the way | **A, same line everywhere** |

- **Q1:** 3 to 5 business days, everywhere.
- **Q2:** yes, move existing self-listed live pages to Claimed (ticket 160, GATE-DATA).
- **Q3:** yes, approval writes an approved claim row so the 90-day clock starts that day.

**Tickets:** 156 checklist sign + dashboard card, 157 front door, 158 Claimed on approval + shared messages, 159 ownership safety fix, 160 backfill + review-time copy. Build order: 159, 156, 158, 160, 157.
