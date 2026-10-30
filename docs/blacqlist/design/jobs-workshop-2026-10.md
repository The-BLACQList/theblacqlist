# Jobs workshop, round 1

**Audience:** founder and whoever builds Jobs next.
**Last updated:** 2026-10-30
**Canvas:** https://claude.ai/artifact/Rfp1d7nwpivAyfmdKrT8Lq (private to the founder until shared)

Jobs is covered at the Tue 3 Nov opening (`FEATURE_JOBS_OPEN=false`, founder 2026-10-30). It reopens when this design is live and the first real job (Community Moderator, Volunteer) is published through it.

## Picks

`[Decision — founder, 2026-10-30]` Pasted from the canvas picks form. All six screens match the lean. Q1 to Q5 were pasted unchanged as "yes", which counts as the answer.

| Screen | Picked | What it is |
|---|---|---|
| 1. The board (`/jobs`) | **A · Board** | Header with "Post a job", then filter chips that apply on tap: **Where** (Remote plus each city with open roles) and **Kind of work** (full-time, part-time, contract, internship, volunteer). Cards in a grid (1 column on a phone, 2 to 3 on a computer). "No roles match these filters" with a Clear filters button. Filters live in the URL |
| 2. The card | **B · Business first** | Business mark and name with the place on top, the role title, then fact chips: pay (range and period, or "Unpaid"), kind of work (teal, Jobs only), Remote if remote. Foot: "Closes {date}". The same card is used on the board, in search and on the business page |
| 3. The job page | **B · Fact sheet** | Breadcrumb `Jobs / {place}`, title, "at {business}", then a fact sheet (Type, Where, Pay, Closes), About the role, How to apply (email shown as text with a Copy button, or the apply link), About the business with a link to its page. On a phone the apply action sits in a bar fixed to the bottom of the screen |
| 4. Posting a job | **B · Four steps** | 1 The role, 2 Pay and place, 3 How to apply, 4 Review, with a live card preview. The hiring business is picked in step 1. The Black-owned / Ally radio is gone. Step 4 shows the price before submit: "Uses 1 of your N included postings" ($0) or "$9.99 for 30 days" |
| 5. Confirmation | **A · Its own page** | "Your role is in review", what it cost (included or $9.99 paid), a short timeline (Submitted, In review, Live, Closes), and links back to the dashboard and to post another |
| 6. Where Jobs shows up | **B · Visible** | Home Avenues Jobs tile turns on (live count of open roles) once Jobs is open; dashboard Publish shows "Post a job" with postings left; a business page shows "Now hiring" with its open roles |

Not picked: Board B (dense list) and C (by place), Card A (pay first) and C (with stub), Job page A (single column), Post A (one long form), Confirmation B (dashboard toast), Entry A (quiet).

## Questions settled

| # | Question | Answer |
|---|---|---|
| Q1 | Default closing date | **Yes.** Default `closes_at` to 30 days after the role goes live (the length of a paid slot). The poster can change it |
| Q2 | Take roles down after they close | **Yes.** A nightly sweep moves closed roles off the board and search. The page stays up with an "Applications closed on {date}" banner so shared links still work |
| Q3 | Drop the Black-owned / Ally choice | **Yes.** The hiring business already carries its label, and "Black-owned" is never shown on cards since 16 Oct |
| Q4 | Require pay on paid roles | **Yes.** A pay range and a period are required for anything that isn't volunteer. `[Needs professional review]` Several states and cities have pay-transparency laws for job ads. Counsel should confirm the field set covers them |
| Q5 | The first role is from The BLACQList | **Yes.** Post the Moderator role under The BLACQList's own page, use an included posting if one exists, and have someone other than the poster approve it, or log that the founder approved their own |

## States (come with the picks)

- **No roles yet:** "No open roles right now". Roles appear once businesses post them and our team approves them. Owners get a "Post the first one" link.
- **Loading:** a skeleton that matches the card shape.
- **Couldn't load:** "We couldn't load jobs just now", with Try again. Filters are kept.
- **Filters match nothing:** "No roles match these filters", with Clear filters.
- **A closed role:** the job page shows "Applications closed on {date}". The role leaves the board and search.

## Follow-up calls (founder, 2026-10-30, after ticket 149 review)

- **Temporary chip:** the board gets a sixth Kind of work chip, Temporary, so no live role is unfilterable. `[Decision — founder, 2026-10-30]`
- **Board H1:** "Jobs" (was "Black-Owned Business Jobs"). `[Decision — founder, 2026-10-30]`
- **Remote once:** a remote role shows "Remote" only on its chip, not again in the top line (fixed in #269). `[Decision — founder, 2026-10-30]`
- **Closing dates:** shown as the calendar day in Eastern time (America/New_York) everywhere. `[Decision — founder, 2026-10-30]`

## Copy facts to keep right when building

- Pay format: "$18–$22 an hour" (en dash in ranges). Volunteer roles say "Unpaid".
- Price: $9.99 for 30 days, or included with Growth and Premium. Read both from `lib/stripe/jobPostings.ts`, not from this doc.
- "Black-owned" is never a card label. The board's subhead ("Open roles at Black-owned businesses") follows the 23 Oct site-copy rule.
- Every role is checked by our team before it goes live (GATE-MODERATION).
- The teal Jobs colour (`#1f7e94`, ink `#176679` for text) is new. It is used only for the kind-of-work chip and Jobs eyebrows.

## Next

Tickets 149 onward in [../tickets/ticket-index.md](../tickets/ticket-index.md), the route-map fix, then one PR per ticket in a worktree from `origin/main`.
