# Ticket 206: Sample pages on For Business, and the page rework

**Asked:** founder, 2026-11-17: "Add nav/buttons to the examples on the For Business page as examples of what their pages could be." Then, 2026-11-18, after seeing the draft: "the wording and layout need some work on the For Businesses page", with a visual workshop (Creative Studio, `blacqlist-for-business`) and a text workshop (Marketing, with an Author OS voice pass). The founder approved Creative's DR-003 to DR-006, and this branch builds that page.

**Gates:** GATE-DEPLOY (founder OK to merge). No migration, no env change, no data writes.

## What ships

- **For Business, rebuilt** to Creative's build spec (`creative-studio/projects/blacqlist-for-business/09_production/specs/for-business-build-spec-v2.md`, which supersedes v1) and Marketing's copy deck (`marketing-department/projects/theblacqlist/07_funnels/pages/for-business/COPY_DECK.md`). The page's own styles are in `app/(public)/for-business/for-business.css`, scoped to `.fb`, in Jost, with container breakpoints at 640, 768 and 1024.
  - **Hero (the one owner door, `#start`):** "Is Your Business Already on the List?", Find My Business and Add My Business, two facts, How It Works in three steps, and the café photo.
  - **01 What Your Page Can Do:** one table of Free against Starter and Up, built from the plan gates in `lib/stripe/features.ts`. The AI rows show only while their flag is on (`aiOnboarding`, `aiBeta`) and say they are written by AI.
  - **02 See a Sample Page:** one card per layout (Storefront, Professional, Creative), each a screenshot of its sample, linking to `/example/<layout>`. A line under the cards says the business is made up and that live Pages look different.
  - **03 How Trust Is Earned:** the four marks, Unclaimed to BLACQList Certified, on the ember band. "Earned, never sold."
  - **04 Start Free** (holding heading; the founder struck the first line on 2026-11-18 and is picking the final one): the shared `PricingPlans` cards, unchanged and without the Most Popular flag, plus a line, read from plan availability, on which plans open later.
  - **Closing:** "Claim or Add Your Business" and the same two buttons.
- **Checks:** `tests/for-business-copy.test.ts` pins every fact the copy states (plan gates, AI flags and disclosure, Verified is free, the Certified rule, no typed prices, no em dashes, one `#start`). `e2e/for-business-brand.spec.ts` runs at 375, 1024 and 1280 with reduced motion: Jost only, the 14px floor, no grey lighter than #6b6b6b and no gold on light, 4.5:1 contrast, every chapter heading on the gutter, no sideways scroll, axe clean, and the round trip from a sample card to its sample and back to the door.
- **Sample banner:** "Get a Page Like This" after the notice, back to `/for-business#start`. The link guard lets it through by `data-example-allow-links`.
- **`/example` opens on production.** Ticket 184 kept it a 404 there; a For Business link to a 404 is worse. It stays out of search: `noindex, nofollow` in the layout, `/example/` disallowed in robots.txt, and on production the page leaves out the LocalBusiness JSON-LD so the live domain never describes a made-up business to search engines.

## Checked against seed-data-plan §10

§10 lists records not to seed into the production database. The sample pages are code fixtures, not database rows: nothing is written, no listing exists, search and the map never see them, and every page carries the non-dismissible "not a real business" banner. Licences: all 44 photos are Unsplash License (commercial use allowed); `example-image-licenses.md` now names the For Business use.

## Founder review, 2026-11-18

After the Preview the founder asked for three changes, all on this branch:

- **Creative sample: the photo first.** The bold cover is the first thing a visitor sees on a Creative page, edge to edge at every width: about one screen high on desktop, 4:5 on a phone. The caption comes next, then the name, tagline, facts and buttons in one full-width row (`chapters.css`, the last `.c-hero` block). This replaces prototype v7's split. Only the visual order changes: the h1 stays first in the markup for screen readers.
- **The hero photo at 2400 px.** `cafe-interior.webp` was downloaded again through the photo's own Unsplash download link (no bot check on that route) and saved as WebP, about 400 KB. Same photo, author and licence.
- **"Sample & Co."** replaces "Test Business 123" on all three samples: name, banner, stories, venues, slugs (`sample-and-co`) and the three logos, now redrawn as an S&C monogram in the same three designs. The staging seed keeps its slug prefix `demo-test-business-123` on purpose: it upserts and purges by slug, so a new prefix would strand the listings already there. Re-running the seed renames them in place (a staging write, so it waits for the founder).
- The sample-card screenshots were retaken from the real pages at 1280 × 800.

**Creative's visual QA** (`creative-studio/projects/blacqlist-for-business/reviews/2026-11-18-build-206-visual-qa.md`, spec v2): conforms with corrections. Fixed here: the hero crop is 50% 60% at every width (QA-04), the display tracking is no longer reset (QA-05), the closing band is 64 px top and bottom (QA-06), the → is drawn as an SVG because the Jost subset has no U+2192 (QA-07), and the table descriptions are at line-height 1.45 (QA-08). QA-01 and QA-02 were fixed in ab1cbd6, and QA-03 by the 2400 px photo.

## Open for the founder

- **OK to merge** (GATE-DEPLOY).
- **Re-seed staging** so the demo listings carry the new name.
- **Later, separate tickets:** the site-wide labels (DR-004) and a restyle of the shared plan cards, after this page is approved.
- **The layout.** The samples show the chapters layout (ticket 204); live listings still use the stacked template. The copy says "could look like", not "will".
