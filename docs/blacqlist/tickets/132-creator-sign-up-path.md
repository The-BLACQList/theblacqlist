# Ticket 132: Creator sign-up path

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 131 (creator type and groups), 126 (add-business quick start), 129 (finish view)
**Gates:** Copy. The Black Creator / Ally Creator definitions, the 18+ wording and the new `/terms#creator-listings` section need founder sign-off and a legal review before merge. No migration.
**Decision record:** `docs/blacqlist/features/creators-and-influencers.md`

---

## Why

`[Decision — founder, 2026-10-08]` Creators add themselves only; we never publish a person's page without their consent. The label is "Black Creator / Ally Creator". Creator tags don't count toward the Free plan's 3-tag limit. Sign-up is open at launch, with no invite links.

The quick start is worded for a business ("What's your business called?"). A creator needs the same flow worded for a person, plus an adult check: the Terms already say 18+, and sign-up never asks.

## Scope

In:

- `/add-business?as=creator` forces the `creator` type and the Creators subcategories.
- Person-worded quick start steps.
- Ownership step with the creator labels, plus "I'm 18 or older".
- Finish view: a Creator details section and the partner switch. Business pages get the switch too.
- A creator page-strength checklist.
- Server checks for the type, the 18+ attestation and the creator tag caps.
- New `/terms#creator-listings` section.

Out:

- Social links (133), the Discover filter and badges (134), home page links (135).
- Creator verification. Creator pages can't reach Verified in v1.
- Invite links.

## How it works

**Entry.** `?as=creator` on `/add-business`. Links come from the Creators band (135), the Creators Discover banner and the sign-up page.

**Quick start copy** (`lib/listings/quickStart.ts`, `TextSteps.tsx`):

| Step | Business copy today | Creator copy |
|---|---|---|
| Name | What's your business called? | What do people call you? |
| Place | Where is it? | Where are you based? City optional; none means Online (`virtual`) |
| Main button | Business choices | Message / Follow / Work with me (link) |
| Label | Black-Owned / Ally | **Black Creator:** "I'm a Black creator." **Ally Creator:** "I'm not Black, and I support Black-owned businesses and creators." |
| Attest | Accuracy + terms | Adds "I'm 18 or older." Terms link goes to `/terms#creator-listings` |

**Finish view** (`components/listings/PageFinishView.tsx`):

- Creator details: niche (up to 3), platforms (any), audience size (one, "self-reported").
- Partner switch, worded by type: "Open to brand deals" on creator pages; "Open to creator partnerships & sponsorships" elsewhere. Not shown on event or job pages.

**Checklist** (`lib/ai/checklist.ts`): for creators, drop hours and phone/website; add socials, a niche and a sample post or video.

**Server:**

| Need | Where |
|---|---|
| Accept `creator`, require the 18+ attestation | `lib/actions/listings/createListing.ts` |
| Save the partner switch | `updateListingContent.ts` |
| Skip creator groups in the Free cap; enforce 3 niches, 1 audience size | `updateListingAttributes.ts`, `checkAttributeCount` in `lib/stripe/planChecks.ts` |

**Moderation.** New creator pages go through the existing `new_submission` queue. Add a creator section to the moderation policy (`.claude/rules/moderation-policy.md`, `moderate-queue` skill): the label matches the person, linked profiles exist and belong to them, the audience range is plausible, the creator is an adult, no minors shown as the creator.

## Acceptance criteria

- Given a signed-in person opens `/add-business?as=creator`, then every step uses the creator copy and the category step offers only Creators subcategories.
- Given they leave the city empty, then the page saves as Online and its address starts `/online/creator/`.
- Given they don't tick "I'm 18 or older", then they can't submit, and the server refuses a request without it.
- Given a Free creator page, when the owner picks 3 niches, platforms and an audience size, then all save and their other tags still have the full Free allowance.
- Given a creator picks a fourth niche or a second audience size, then the UI stops them and the server refuses it.
- Given a business page in the finish view, then it shows "Open to creator partnerships & sponsorships", and turning it on saves.
- Given an event or job page, then no partner switch shows.
- Given a submitted creator page, then it lands in the new-submission queue and isn't public until approved.

## Known limits

- Self-listed pages stay `unclaimed`, so creators can't reach Verified. Same as businesses today; logged separately.
- The 18+ check is an attestation, not proof of age.

## QA notes

- Unit: `checkAttributeCount` exemptions and caps; `createListing` refuses a missing attestation and accepts `creator`; checklist items by type.
- Browser (local): sign up through `?as=creator` on a phone width, finish with niche, platforms and audience on Free, submit, approve as admin, check the public page.
- a11y: keyboard through the new steps, the switch and the attestation at 375px; the switch has a visible label and state.
- Copy gate: confirm founder sign-off and legal review are recorded before asking to merge.
