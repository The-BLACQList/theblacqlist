# Ticket 240: For Business looks like the home page

**Asked by:** the founder, 2026-11-21. Their words: "The For Business page doesn't look like it fits with the rest of the website. I want it to look more like the home page, but still keep the information and context. Lose the section numbering, but keep the buttons and calls to action. Trim some of the unnecessary text." The hero is full width, like the home page's.

**Depends on:** 206 (the page this one restyles).

## What changed
- `/for-business` now uses the home page's building blocks:
  - A full-width photo hero. It has the same height and shading as `HomeHero`, with the café photo.
  - Bands with a small uppercase eyebrow and a headline, using `py-12 md:py-16` spacing.
  - Pill buttons, as in `OwnerCta`.
  - The site's own fonts: Jost for headlines, Inter for body text.
  - `Reveal` on each band.
- The page's own stylesheet (`for-business.css`) is gone. No section numbers remain.
- The compare table is now one full-width row per feature: plan label (Free / Starter and Up), title, one line of text. Even at any row count (founder 2026-11-21: no uneven boxes). The gates and the AI flags are unchanged.
- The AI rows no longer say "AI writes it" in each row (founder 2026-11-21). One note under the list discloses AI whenever an AI row shows: "These drafts and reads are written by AI." (or "This draft is written by AI." when only the add-business draft is on). Not Cue: the dashboard tools (Explain My Numbers, the Write buttons, the add-business drafts) aren't called Cue, Explain My Numbers is a button rather than a question box, and Marketing keeps Cue in the supporter lane (proof prf_ask-cue-pillar-gated_2b1899). Wording is Marketing's fallback.
- Copy is trimmed in two places:
  - Hero: one line of copy, then two facts. The help line and the numbered How It Works list are removed.
  - Shorter row, sample and trust lines. Every fact that `tests/for-business-copy.test.ts` pins is still there.
- The buttons and links are unchanged: Find My Business, Add My Business, Get Your Page, the three See the X Sample links, the plan cards, Compare Every Plan, and the closing door. The page still has exactly one `#start`.

## Supersedes
- Creative DR-003 and DR-005 (split hero, Jost only, numbered chapters), for this page only.
- DR-004 still applies: the round trust marks are kept.

## Checks
- `e2e/for-business-brand.spec.ts` is rewritten for the site's fonts (Jost headings, Inter text) and still enforces a 14px minimum. The audit now reads `oklab()` colours.
- On a phone, the door buttons must end within 520px and the first fact must be inside the first screen.
- `a11y.spec` and `contrast.spec` on /for-business: both pass.
