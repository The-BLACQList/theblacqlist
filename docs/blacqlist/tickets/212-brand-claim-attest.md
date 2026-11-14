# Ticket 212: A brand claims its directory entry and attests

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready
**Depends on:** 211
**Gates:** no migration, because 211 adds the claim columns. The attest wording follows the #248 Terms §4 pattern. `[Needs professional review]` Counsel should approve the attest text before it goes live.
**Decision record:** 2026-11-08, Q1 C. The brand attests in order to claim its entry.

## Why

A directory entry starts from a source the founder found. Once the brand claims it, the brand keeps its own price range, products and stockists current. That's what keeps "Reported by the brand · updated {date}" honest.

## Scope

In:
- **On a directory brand's public product page** (217), a quiet link at the foot: "Is this your brand? Claim it".
- **The claim flow** needs a sign-in. It has three parts:
  - a short form: role at the brand, and a work email or the brand site's contact email;
  - the attest checkbox, reusing the #248 wording family: the person confirms they're authorized to speak for the brand, and that the ownership details are true;
  - submit.
  Saving it writes `claimed_by`, `attested_at` and `attest_version`, but only after founder approval.
- **Admin queue** at `/admin/marketplace/directory/claims`. The founder can approve or decline, with a preset reason.
  - Apply the same rule as ticket 159: approval refuses to overwrite a different `claimed_by`.
  - The claim waits in a `pending` state. Store it in the existing claims table if its shape fits. If it doesn't, the PR says why, and the new table goes through GATE-DATA.
- **Once approved,** the claimant sees a "Your brand" card on `/dashboard`. From there they can edit the brand description, products and price ranges. Stockists come in 213.

Out:
- Emails about claim status. Those are GATE-COMMS and get their own ticket if wanted. The dashboard card shows the status.
- Turning a directory brand into a paid storefront. They can list a page through `/add-business` as today.

## Checks

- A second person can't claim a brand that's already claimed. Approval refuses it, as in 159, with a unit test.
- A declined claim leaves the brand untouched.
- The claimant's edits to a price range still pass the 211 CHECK.
- Signed out, the claim link sends the shopper to sign in and back again.
