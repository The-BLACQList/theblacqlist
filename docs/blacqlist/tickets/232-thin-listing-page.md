# Ticket 232: Tidy today's business page for thin listings

**Phase:** V1.5 · **Priority:** P2 · **Status:** In review (draft PR)
**Depends on:** 231 (live 2026-11-19).
**Gates:** GATE-DEPLOY (draft PR; merge on the founder's OK). No data changes.

**Decision record (founder, Software session):**

1. 2026-11-18: thin-page problems from Creative's 231 QA (QA231-08) go in a separate small ticket.
2. 2026-11-19: "start the thin page ticket".
3. 2026-11-19, the initials badge on a hero with no cover: "Right side; off on phones".
4. 2026-11-19, the trust label: "Use the round mark" (DR-004), beside the tier name.

---

## Why

Ticket 231 shows the chapters layout only on Storefront listings with a cover, 4+ photos and a story. Every other listing keeps today's page. Creative's QA found four problems on that page, all older than #355:

1. **Initials badge over the name.** With no cover, `ImageFallback` centres the gold initials badge in the whole hero, while `TemplateHero` pins the text bottom-left on top of it. On phones the hero grows to fit the text, so the badge lands behind the name and tagline. On wider screens a long name runs into it. All five templates share the hero.
2. **White band under the header (Preview only).** `PreviewBanner` was a strip in the page flow. The fixed header covered it, and `main`'s header padding started below it, leaving a 24px band (40px when the strip wrapped on a phone). Production never had it, but it shows on every Preview page and misled reviewers.
3. **Top bar fading in over the hero.** The tablet/desktop quick bar showed whenever the hero button was off screen, including when it was still *below* the fold on first load.
4. **Trust pill.** The trust panels used today's filled pill, not the round DR-004 mark the new page uses.

## Scope

**In**
- `ImageFallback` gets `placement: 'center' | 'aside'`. The hero uses `aside`: the badge sits on the right from 768 up and is hidden on phones. With no cover, the hero text stops at about two-thirds of the width. Cards are unchanged.
- `PreviewBanner` becomes a fixed pill in the bottom-left corner (above the phone bottom bar), 14px text, out of the page flow.
- `quickBarVisibility` (`lib/entity-page/quickBar.ts`): the phone bar keeps its rule (button off screen either way, DR-003); the top bar shows only once the button has scrolled up past the top.
- `TrustTierLabel`: round `TrustMark` plus the tier name (Unclaimed, Claimed, Verified, BLACQList Certified), in `EntityTrustSection` (Storefront) and `TemplateTrustPanel` (Professional, Creative).

**Out**
- The hero's own tier badges, Ask Cue placement (founder kept it as today, 2026-11-18), and the repeated "No reviews yet" and "Suggest a correction" blocks.

## Tests

- Unit: `tests/thin-listing-page.test.ts` (bar rules, tier to mark).
- e2e: `e2e/listing-thin-page.spec.ts` on the claimable fixture (no cover), at 375, 768, 1024 and 1280: the badge never overlaps the name or the main button and is hidden on phones; the top bar is hidden on load and shows after scrolling; the trust panel shows the mark; axe. `E2E_THIN_LISTING` points it at another thin listing.
