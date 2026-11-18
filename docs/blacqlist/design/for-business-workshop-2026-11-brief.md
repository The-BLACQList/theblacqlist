# For Business workshop brief (ticket 206)

**Asked:** founder, 2026-11-18. The wording and layout of the For Business page both need work. Run a visual/design workshop and a text workshop, with Marketing and Author OS supporting.

**Scope:** the whole page (`/for-business`), including the new Sample Pages section from draft PR #352.

**Who does what:**

- **Creative Studio leads the visual workshop.** Round 1 is 2–3 whole-page directions as one clickable prototype.
- **Marketing leads the text workshop.** It produces a copy deck for every section, built from `projects/theblacqlist/05_messaging/MESSAGING.md` and the proof audit.
- **Author OS supports with a voice pass** on Marketing's deck, against the founder's profile.
- **Software** (software-agent-bundle) wrote this brief. It relays the founder's picks and builds the chosen page.

Nothing here is approved copy. Every line stays a `recommendation` until the founder picks it. Messaging approval is still Marketing's pending gate.

**Merge gate:** GATE-DEPLOY. Merging needs the founder's OK.

---

## 1. The reader and the job

- **Who:** a business owner, usually on a phone. They often arrive from a flyer, from a search, or from their own unclaimed page.
- **Job (from the ticket 115 spec):** "When I find my business on the list, I want to know what claiming gets me and what it costs, so I can decide in a minute."
- **Conversion** (Marketing's project): an owner submits a claim on a seeded listing, or publishes a new Page.
- **Founder notes so far:**
  - Ticket 115 chose "Documentary" for this page in October 2026.
  - In November 2026 the listing pages moved to an upscale, editorial "chapters" look: Jost only, wide photos, motion that respects reduced-motion settings. The founder said the old pages were "not impactful enough".
  - The founder now says the For Business wording and layout need work. Treat the current page as the "before", not a constraint.

## 2. The page today

Screenshots (current branch, local dev data):

- `/private/tmp/claude-501/-Users-chalecedelacoudray-Desktop-agents-software-agent-bundle/b00aeaf4-4c4c-41da-b04c-4b7d6388c37e/scratchpad/fb-before/for-business-1280.png`
- `/private/tmp/claude-501/-Users-chalecedelacoudray-Desktop-agents-software-agent-bundle/b00aeaf4-4c4c-41da-b04c-4b7d6388c37e/scratchpad/fb-before/for-business-375.png`

The scratchpad can be cleared, so copy them into your own project if you need them.

Source: `app/(public)/for-business/page.tsx`, branch `feat/206-for-business-samples`.

| #   | Section                                  | Current wording                                                                                                                                                                                                                                                                                                                                                         | Notes                                                                                                                 |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Hero (dark)                              | Eyebrow "For business owners"; h1 "Your page. Your story. Your customers."; body "Claim your page for free, keep your details right, and see how people find you. Open to every business." (with an AI clause when AI is on); the owner door box "Is Your Business Already on the List?" with **Find My Business** (`/claim`) and **Add My Business** (`/add-business`) | Photo: `citrus-harvest.webp`                                                                                          |
| 2   | AI writing help (white)                  | "Stuck on what to say? Start from a draft." plus 1 free item and 4 Starter items, and a quota line                                                                                                                                                                                                                                                                      | Only shown while the `aiOnboarding` / `aiBeta` flags are on                                                           |
| 3   | How it works (off-white)                 | "Three steps to a page that's really yours." Find Your Page / Show It's Yours / Make It Yours                                                                                                                                                                                                                                                                           |                                                                                                                       |
| 4   | What you get (white)                     | "A page that works as hard as you do." 5 items                                                                                                                                                                                                                                                                                                                          | Two are marked ", on Starter and up"                                                                                  |
| 5   | Sample pages (off-white, new in PR #352) | "See what your page could look like." 3 cards: Storefront / Professional / Creative, each with "See the … Sample". Fine print: made up, and some features need a paid plan                                                                                                                                                                                              | Links to `/example/storefront`, `/example/professional`, `/example/creative`, which are the new chapters sample pages |
| 6   | Trust ladder (dark)                      | "Trust, earned in steps." Unclaimed / Claimed / Verified / Certified                                                                                                                                                                                                                                                                                                    |                                                                                                                       |
| 7   | Plans (off-white)                        | "Start free. Grow when you're ready." The shared `PricingPlans` component, then "Compare Every Plan" → `/pricing`                                                                                                                                                                                                                                                       | Prices, Coming Soon and the monthly/annual toggle all come from the live `plans` table                                |
| 8   | Closing (dark)                           | "Your page is waiting for you." plus the owner door again                                                                                                                                                                                                                                                                                                               | Photo: `crown-and-coil-studio.webp`                                                                                   |

Problems already visible (Software's read; the workshops may find more):

- The page is long, especially on a phone: 10,391px at 375, against 6,498px at 1280.
- Every section uses the same "eyebrow + h2 + list" pattern, so nothing stands out.
- There's no image of an actual Page until section 5, which is the most persuasive thing on the page.
- The headings are sentence-style with full stops, while the sitewide rule is Title Case.

## 3. Facts the copy must stay true to

`tests/for-business-copy.test.ts` pins these, so a rewrite that breaks one fails CI. New wording can rephrase them, but never contradict or overstate them.

| Fact                                                                                                                                                                                                                                                                                                   | Source                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Claiming and adding a business are free.                                                                                                                                                                                                                                                               | Plans; MESSAGING.md public value proposition                                |
| Review replies ("Reviews You Can Answer") and analytics ("See Who Finds You": views, saves and taps over the last 30 days) are **Starter and up**; Free gets neither.                                                                                                                                  | `lib/stripe/features.ts` (`review_response`, `analytics`)                   |
| More photos, a video and common questions are **Starter**. Social links are Starter too, so the Free contact row doesn't say "links".                                                                                                                                                                  | `features.ts` (`listing_video`, `social_links`)                             |
| AI: the first draft in `/add-business` is free (`aiOnboarding`). About text, search title and summary, Instagram captions and Explain My Numbers are Starter and up (`aiBeta`), with a quota of `aiQuota('starter')` / `aiQuota('growth')` every 30 days. Each line appears only while its flag is on. | `lib/stripe/features.ts`, `lib/env.ts`                                      |
| Which tiers are open comes from data. When Premium isn't open, the page says Starter (or Starter and Growth) is open and the rest open "once everything in them works".                                                                                                                                | `getPlanAvailability`, `lib/stripe/availability.ts`                         |
| Claims are checked by a real person.                                                                                                                                                                                                                                                                   | GATE-MODERATION                                                             |
| **Verified** is free for every owner: proof such as a business licence, checked by hand.                                                                                                                                                                                                               | founder 2026-10-03                                                          |
| **Certified** is earned: 5 or more reviews, a 3.5 average or better, 90 days since the claim, and complete details. It's automatic, and nobody can buy it.                                                                                                                                             | `.claude/rules/moderation-policy.md`, `lib/services/trust/certification.ts` |
| A business appears by name in The Collective once customers log 5 or more receipts with it.                                                                                                                                                                                                            | `lib/spend/aggregate-privacy.ts`                                            |
| The sample pages show a made-up business ("Test Business 123"). Their reviews and numbers are illustrative. The pages use the new chapters layout, which **live listings do not have yet**.                                                                                                            | ticket 204/206                                                              |
| No typed prices (`$` followed by a digit) and no em dashes anywhere in the file. No "Most popular" badge.                                                                                                                                                                                              | the copy test                                                               |
| No testimonials, owner quotes, counts of businesses or users, view or customer promises, or forecasts. None exist with evidence.                                                                                                                                                                       | `.claude/rules/no-fabrication.md`; Marketing proof audit                    |

## 4. Structure that stays

- **One owner door.** Every owner link sitewide lands on `/for-business#start`, which asks one question: is your business already listed? Find first (claiming avoids duplicates), then Add. Its wording and look can change; the anchor and the two destinations can't.
- **Plans** stays the shared `PricingPlans` component, the same one `/pricing` uses. A direction can change what sits around it and where it sits, but not the cards themselves.
- **The page stays server-rendered and dynamic.** Plan availability is read per request.
- **The sample pages** keep linking to `/example/<type>`. How they're shown is open: cards, a strip, one large sample with switches, or a live-looking preview.

## 5. Brand rules

- **Type:** Jost is the brand face. The listing pages are Jost only; the repo's body text is still Inter, so say if a direction wants Jost for body text here.
- **Gold** (`#c4a065` family) only on dark surfaces; **amber** on light surfaces.
- **Text:** a 14px floor; no grey lighter than `#6b6b6b` on light; every piece of text at least 4.5:1 contrast; one left edge per section.
- **Title Case** for headings, buttons, nav, tabs and labels (`docs/blacqlist/design/title-case.md`, guarded by `tests/title-case-guard.test.ts`). Sentences and owner text stay as written. The workshop should decide whether the h2s become Title Case headings or stay as sentences.
- **Mobile first at 375,** checked at 375/1024/1280.
- **Motion:** refined, and must respect reduced-motion settings.
- **Photos:** licensed only. Use `public/images/editorial/` (the current pool) and `public/images/example/` (the sample-page photos, Unsplash License). No stock faces presented as owners or testimonials.
- **Platform line:** "Find & Be Found." See MESSAGING.md §1 for where it may appear. Keep the campaign line ("Discover more. Support more. Circulate more.") off the site unless the founder extends it.

## 6. Founder decisions this workshop should surface

1. **Order and length:** what leads (the owner door, a sample page, or the value proposition), and what can be cut or folded together. Candidates: AI help into What You Get, How It Works into the hero.
2. **How the sample pages are shown,** and their wording.
3. **Heading style:** sentences or Title Case.
4. **The sample business name** "Test Business 123", which will show on the live site. A rename is a separate small change across the fixtures.
5. **Whether to mention the new layout:** the samples use chapters, but live listings don't yet. The copy must not promise it.

## 7. Hand-offs

- **Marketing → Creative and Software:** a copy deck per section (2–3 options for the hero, each heading and the CTAs). Each line is labelled and tied to a proof id or to a fact in §3.
- **Author OS → Marketing:** voice notes and line edits on the deck, checked against the founder profile. No new claims, no em dashes.
- **Creative → founder:** a Round 1 prototype artifact (private), with 2–3 directions and the wording options alongside.
- **Software:** relays the founder's picks, then builds the chosen page on `feat/206-for-business-samples` (PR #352 folds in), with tests, axe and brand checks, and a Preview link.
