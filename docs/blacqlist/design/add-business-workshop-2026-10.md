# Add-business workshop: the /add-business redesign

**Audience:** founder and whoever builds /add-business next.
**Last updated:** 2026-10-05
**Canvas:** https://claude.ai/artifact/XWKTMrEE5dwDwV2x5rNge2 (private to the founder until shared). Round 2 is the main view. Round 1 stays reachable through a "Round 1" link.

## Context

Owners get stuck early on `/add-business`. Step 2 ("What do you do") shows too much at once. The founder also wants owners to describe the business in their own words, get drafts they can adjust, end up with a page that ranks well in search, and be helped to the right category (or a new one when nothing fits). Everything below is design direction until the tickets ship.

## Round 1 summary

Three concepts were shown. Founder reaction, 2026-10-05:

- Liked B ("your page fills in") so far, ideally mixed with A's one-question-at-a-time pacing.
- Liked the page-strength meter and the add-on sections ("Excellent").
- Step 2 showed too much at once and was confusing.
- Wants AI help, free for every new owner, with caps. Ship rules-first, AI later behind a switch.
- Follow-up the same day: ask for the owner's website or social link first and fill the draft from it, so owners type less.

## Round 2 summary

One concept: B's live page with A's one-question pacing. On a phone, one short question per sheet sits over the page and each answer shows on the page right away. On desktop, the question is on the left and the live page is on the right.

| Step | What the owner sees |
|---|---|
| 0 | "Bring in what you already have": a website or link-in-bio link, or "Skip, I'll type it" |
| 1 | Business name, with "Is this you? Claim it" matches |
| 2 | "What do you do?" in the owner's own words (1 to 3 sentences) |
| 3 | "Here's how we'd list you": one suggestion. "Not quite" shows two more, then the 13 groups, then "Suggest a new category" under the closest group |
| 4 | The main button (call to action), asked once |
| 5 | One line about the business |
| Finish | Page-strength meter, drafts, add-on sections, and a Google search preview card. Submit is available at any time |

The workshop page also showed "With AI" and "Rules only" side by side. Rules only is what ships first. The design critic passed round 2.

## Decisions

`[Decision — founder, 2026-10-05]` Round 2 flow approved as shown: one flow mixing B's live page with A's one-question pacing.

`[Decision — founder, 2026-10-05]` The founder answered "yes" to all six questions on the page, meaning keep what is shown:

| # | Question | Decision |
|---|---|---|
| 1 | Import first or after the name? | Import comes first, before the business name |
| 2 | One suggestion, then two more, then the 13 groups? | Clear. Keep it |
| 3 | New-category promise | Listed under the closest group until the team adds it. We email either way |
| 4 | When are drafts written? | When the owner taps "Save my draft". No separate "Write drafts for me" tap |
| 5 | When AI has no good answer | Quietly fall back to rules matching and simple drafts, with one line saying so |
| 6 | Google preview card | Keep it for the search title and description |

`[Decision — founder, 2026-10-05]` Earlier the same day:

- AI help is free, with caps: about 5 drafts per page, a daily cap, a monthly ceiling, and a kill switch.
- Ship rules-first. AI comes later behind a flag.
- Socials found on a Free page are saved and show once the owner is on Starter.
- Import v1 reads websites and link-in-bio pages only. Instagram needs Meta app review and Google Business Profile is a paid API, so both come later.
- #181 (the category guide, ticket 125 part 5a) closes into the ticket 126 PR. Its `lib/categories/sorting-guide.ts` logic is reused.

## Bugs the round 2 checks caught

Ticket 126 covers each in its acceptance criteria.

| Bug | Fix |
|---|---|
| The rules-built search description could come out under 40 characters and block "Use this" | Always at least 40 characters |
| Lists with `overflow:hidden` inside a flex-column scroll sheet collapsed to 0 height on phones | `flex-shrink:0` on those lists |
| A disabled primary button with its reason off screen stalled owners | Keep the button live and focus the missing field |

## Open polish items (not yet decided by the founder)

The critic passed round 2 with these deferred. Each has a recommendation.

| Item | Recommendation |
|---|---|
| Label the 11 strength-meter segments | Do it. Show the segment name on tap or focus, and list the missing items under the meter |
| Finish-page order | Meter first, then drafts, then add-on sections, then the Google card. Ship in that order and revisit after tester feedback |
| Brand-styled primary button instead of the same black pill everywhere | Do it for the finish page and the main step buttons. Use the existing gold/ember brand tokens |
| Small text sizes | Raise anything under 14px that carries meaning. Keep tiny sizes only for tags like "From your site" |
| Empty hero preview on steps 0 and 1 | Show a soft placeholder (category-neutral cover and "Your business name") so the page never looks blank |

## Next

| Ticket | What | Flag |
|---|---|---|
| [126](../tickets/126-add-business-rules-first.md) | Rules-first flow, finish page, form bug fixes, category requests | none |
| [127](../tickets/127-add-business-site-import.md) | Bring in what you already have (websites and link-in-bio pages) | `FEATURE_SITE_IMPORT` |
| [128](../tickets/128-add-business-ai-drafts.md) | AI drafts and category help | `FEATURE_AI_ONBOARDING`, off by default |

127 and 128 depend on 126.
