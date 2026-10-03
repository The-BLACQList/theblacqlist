# Build spec: My Account A, For Business A, The BLACQLight A

**Audience:** whoever builds these three pages (tickets 114 to 118), plus the founder for the open questions.
**Last updated:** 2026-10-03
**Source:** the founder's picks in [page-workshop-2026-10.md](page-workshop-2026-10.md). The canvas is https://claude.ai/artifact/FR7u4PbpommxxnefUyYqp2.
**Status:** Approved. `[Decision — founder, 2026-10-03]` "accept all recommendations" settled all five questions in §5.

The canvas boards are direction, not code. This spec turns each board into sections, the data each section reads, states, a mobile layout, and a clear line between what ships now and what waits.

---

## 0. Rules that apply to all three pages

| Rule | Where it comes from |
|---|---|
| No em dashes in any copy | founder voice rule |
| Say "the businesses on the list", not "Black-owned businesses", when you mean every listing | Black-Owned/Ally pivot (2026-07-07) |
| Say "spent", never "circulated" | `tests/spend-vocabulary.test.ts` |
| The Collective shows shoppers only in aggregate. A user may see their own spend; nobody else's | F-4 §2C, `data-privacy.md` |
| No invented numbers. Every figure comes from a query; if it can't be measured it isn't shown | `no-fabrication.md` |
| Certified copy = Verified + 5 published reviews + 3.5 average + 90 days since the first approved claim + complete details. It is automatic and can't be bought | `moderation-policy.md` |
| Plan names, prices and "Coming Soon" come from `lib/stripe/plans.ts` and `isPlanPurchasable()`, never typed into a page | `launch-readiness.md` |
| Every page is checked at 375px and 1280px, keyboard-only, and with the a11y e2e suite | QA rules |

No migration is needed for the MVP version of any page. The one schema idea (BLACQLight fields) is listed as a later, GATE-DATA ticket.

---

## 1. My Account A: "Your corner of The Collective"

**Route:** `app/account/page.tsx` (rewrite in place). The shell (`app/account/layout.tsx`, `AccountNav`) stays as it is.
**Who:** a signed-in shopper. An owner sees the same page, plus the existing "Manage my page" block in place of the claim prompt.
**Job:** "When I open my account, I want to see what I've done on the list and what needs me, so I can pick up where I left off."

### Sections, top to bottom

| # | Section | Reads | Notes |
|---|---|---|---|
| 1 | Greeting: "Welcome back, {name}." | `user.user_metadata.display_name` (already read) | Today it falls back to the part of the email before the @. Change that to plain "Welcome back." so no piece of the email shows on screen |
| 2 | **Needs your attention** (only when something needs action) | latest claim with status `pending` (query exists) | Moved up from its current spot. Copy: "Your claim for {business} is in review. We'll email you as soon as it's decided." + "View claim". Hidden when empty (no "nothing to do" card) |
| 3 | Stat strip (4) | saved count, reviews count, approved receipts count, approved spend | All four queries exist. The spend label reads "Spent, approved receipts only". When spend is 0, the 4th stat shows "$0" with "Track a receipt" as its link |
| 4 | **Your place in The Collective** | the user's approved `receipt_uploads` (`amount_cents, listing_id`), and the matched `listings` (`name, slug`, category) | See below |
| 5 | Recently saved (3 cards) | saves query (exists), plus `listings.trust_tier` and `listings.ownership_label` added to the select | Card line 2: "{category} · {neighborhood or city}". Line 3: "{Tier} · {Black-Owned or Ally}". Show the tier only when it is Claimed or higher; Unclaimed shows the label alone |
| 6 | Your activity / Your contributions | the counts the page already reads | Keep the current `RowLink` grids. Restyle only |
| 7 | Claim prompt (non-owners) or Manage my page (owners) | `ownedListing` (exists) | Prompt copy from the board: "Own a business? Claim your page. It's free. Keep your hours and story right, answer reviews, and see who finds you." Button: "Claim your business" → `/claim`. The photo is optional in MVP (see §5 Q4) |
| 8 | Footer links: Settings, Sign out | `signOutAction` (exists) | |

### Section 4 in detail

- **Heading:** "You've spent ${total} with {n} businesses on the list."
  - `n` counts distinct matched `listing_id`s.
  - Receipts with no `listing_id` count toward the dollar total but not toward `n`. They show as a separate line: "${x} at places not on the list yet".
  - This matches how `lib/spend/personal-spend.ts` already treats unmatched money.
- **Body:** "Each approved receipt adds your spend to The Collective. Only you see this view. On the public map, members show up together, never one by one."
- **Buttons:** "Open The Collective" (`/flow-map`), "Track a receipt" (`/account/receipts/new`).
- **Ego network:**
  - "You" sits at the center, with up to 8 businesses around it. Each one is labeled "{category} · ${amount}" and linked to its page.
  - If there are more than 8, show "+{k} more" linking to `/account/spending`.
  - Build it as a static SVG computed on the server: a ring layout with no physics and no client JS.
  - Under it, a visually hidden `<ul>` lists the same businesses and amounts as the screen-reader version. The SVG is `aria-hidden`.
- **Privacy:** the query is filtered to `user_id = auth user` under the RLS that already exists. The panel is the user's own data, so the 5-person cohort rule for public views does not apply. Never reuse this component on a public surface.
- **Empty state (no approved receipts):**
  - Heading: "You're not in The Collective yet."
  - Body: "Track a receipt from a business on the list. Once it's approved, your spend shows up here and joins everyone else's on the map."
  - Button: "Track a receipt".
  - Show the SVG with only the "You" dot.
- **Pending only:** if the user has pending receipts but none approved, add the line "{n} receipts waiting for review."

### States

| State | Behavior |
|---|---|
| Loading | Keep the existing route `loading.tsx`. Add skeletons shaped like the stat strip and the Collective panel |
| Error | If one query fails, that section renders its own "Couldn't load this. Try again" line (a link that reloads the page). The rest of the page still renders. No section throws |
| New user (nothing at all) | Greeting, stats at 0, the Collective empty state, the "Recently saved" empty state ("Save places you want to try. They'll show up here." + "Discover businesses"), then the claim prompt |

### Mobile (375px)

- One column, in this order: attention, stats (2×2 grid), Collective panel, recently saved, activity/contributions, claim prompt.
- The ego network shrinks to the panel width with the ring at 6 nodes max; the rest go into "+k more".
- Buttons are full width, at least 44px tall.

### Not in this ticket

- Recommended and Recently viewed content on the overview. They have their own pages in the nav.
- Monthly charts. They live on `/account/spending`.
- Any new nav items. The nav keeps "Community spend"; renaming it to "The Collective" is a one-line follow-up and can go in this PR if the founder wants it (§5 Q5).

---

## 2. For Business A: "Documentary"

**Route:** `app/(public)/for-business/page.tsx` (rewrite). It stays a Server Component. Pricing reuses the existing client component.
**Who:** a business owner, usually on a phone, often arriving from a flyer, a search, or their own unclaimed page.
**Job:** "When I find my business on the list, I want to know what claiming gets me and what it costs, so I can decide in a minute."

### Sections

| # | Section | Content / data | Notes |
|---|---|---|---|
| 1 | Hero (dark) | Eyebrow "For business owners". h1 "Your page. Your story. Your customers." Body "Claim your page on The BLACQList, keep it right, and see who finds you. Free to start, and open to every business, labeled Black-Owned or Ally." Buttons: "Claim your page" (`/claim`), "List a new business" (`/add-business`) | Photo on the right on desktop and below the text on mobile. The image is priority-loaded with `next/image` and a real alt text. The h1 renders as text first (LCP) |
| 2 | How it works: "Three steps to a page that's really yours." | Find your page / Show it's yours / Make it yours (board copy) | An ordered list (`<ol>`). Step 2 says "We check it by hand". That is true today (GATE-MODERATION) |
| 3 | What you get: "A page that works as hard as you do." | 5 items from the board, plus a product screenshot | "See who finds you" must match `lib/stripe/features.ts`: `analytics` is Starter (tier 1), so Free gets none. That item reads "See who finds you, on Starter and up." The screenshot is a real capture of a listing page, never a mock with fake numbers |
| 4 | Trust ladder: "Trust, earned in steps." | Unclaimed, Claimed, Verified, Certified, with the moderation-policy copy | Subhead: "Customers see your badge on every search. Badges are earned, never sold." (§5 Q1) |
| 5 | Plans: "Start free. Grow when you're ready." | `<PricingPlans availability={await getPlanAvailability(supabase)} />`, the same component `/pricing` uses | One source of truth: the monthly/annual toggle, prices, savings % and Coming Soon all come with it. Add "Compare every plan" → `/pricing`. No "Most popular" badge (§5 Q2) |
| 6 | Closing band | "Your page is waiting for you." / "Claiming is free and takes a few minutes. You can upgrade any time, or never." + the two hero buttons | |

### Trust ladder copy (final)

| Tier | Line |
|---|---|
| Unclaimed | "Listed from public info. Nobody has claimed it yet." |
| Claimed | "An owner claimed it and we approved the claim." |
| Verified | "The owner sent documents and we checked them by hand. Available on Starter and up." |
| Certified | "Earned over time: 5 or more reviews, a 3.5 average or better, 90 days since the claim, and complete details. It's automatic. Nobody can buy it." |

### States

- The page is static except for plan availability.
- If `getPlanAvailability` fails it already fails closed: every paid tier shows "Coming Soon". The page must never show a buy button it can't honor.
- No empty states.

### Mobile (375px)

- The hero photo sits under the buttons and is cropped to 4:3.
- Steps stack vertically. The ladder becomes a vertical list with the tier name and its line.
- Plans stack, using the component's existing mobile layout.

### Not in this ticket

- New photography. It ships with the best licensed photo already in `public/images/editorial/`, or a placeholder held behind the founder's pick (§5 Q4).
- Testimonials. There are none yet, and inventing them is fabrication.
- Any change to `/pricing` itself.

---

## 3. The BLACQLight A: "Cover story"

**Routes:** `app/(public)/blacqlight/(index)/page.tsx` and `app/(public)/blacqlight/[slug]/page.tsx`.
**Who:** a shopper or a curious visitor who came for a story and may leave for a business.
**Job:** "When I read about a founder, I want to go straight to their business, so the story turns into a visit."

### What the table has, and what the board wants

| Board element | Source today | MVP plan |
|---|---|---|
| Kind label (Founder story, Profile, Movement, Guide) | `tags` | The first tag that matches a known kind; otherwise no label. A small `lib/editorial/kind.ts` map |
| Read time | `body` | Computed: words ÷ 230, rounded up, minimum 1 |
| Cover photo | `cover_image_path` | Resolve like other covers. No cover means a type-only lead (no stock photo) |
| Photo credit / caption | not stored | **Defer.** Show no caption until there's a column (§5 Q3). Licensing for the current images is tracked in `editorial-image-licenses.md` |
| Pull quote | not stored | Use the first `> ` blockquote in the body, which `EditorialRichTextDisplay` already renders. The index pull-quote band only shows when the lead story has one |
| Featured businesses ("From the directory", "Featured in this story") | not stored, and **not linkable today**: `EditorialRichTextDisplay` renders no links, and the seeded bodies contain none `[Observed, 2026-10-03]` | Two ways, see §5 Q3. **Option A (no migration):** teach the renderer markdown links `[text](/{citySlug}/{entityType}/{listingSlug})` (internal paths only), then derive featured businesses from those links, published listings only. Existing stories show no directory strip until an editor adds links, and editing a live story is GATE-PUBLISH. **Option B:** an `editorial_article_listings` join table (ticket 118, GATE-DATA) plus a picker in the admin form |

### Index sections

| # | Section | Notes |
|---|---|---|
| 1 | Header | Eyebrow "Stories from the list", h1 "The BLACQLight", dek "The people behind the businesses, the movements around them, and guides to spending on purpose." |
| 2 | Lead story | The newest published article. Large image (or type-only), kind, headline, subtitle as the dek, "By {author} · {n} min read", "Read the story". The whole card is one link; the inner text is not a second link |
| 3 | Pull quote band | Only when the lead story's body has a blockquote. Attribution: the article title, linked |
| 4 | More stories | The next 3 (with "All stories" when there are more than 4). Reuse `BlogPostCard`, adding `kind` and `readMinutes` props |
| 5 | From the directory | The businesses linked from the 4 stories on the page (deduped, max 6). Chip: "{name} · {category}". Hidden when there are none |

### Article page changes

- Add the kind label, the read time, and the cover figure.
- Add a "Featured in this story" card for each linked business (max 3): name, category · city, tier · ownership label, and "Visit their page".
- Keep "More stories" and "Explore businesses".
- Body measure is about 65ch, as `EditorialRichTextDisplay` already does.

### States

| State | Behavior |
|---|---|
| 0 articles | Keep "Stories coming soon" (exists) |
| 1 article | Lead only. No "More stories", no "All stories" |
| 2–4 articles | Lead plus 1–3 cards |
| Load failure | The index shows "Couldn't load stories. Try again" instead of the empty state. Today a failed query and "no stories" look the same; fix that |
| Loading | The existing `loading.tsx` is reshaped to a lead block plus 3 cards |

### Mobile (375px)

- The lead image sits above the text at 4:3; headline size uses `clamp()`.
- Cards stack. Directory chips wrap.

### Not in this ticket

- Category or kind filter pages, search, and pagination beyond "All stories" (fewer than 10 stories exist).
- Editing `AdminEditorialForm`. Nothing new to edit until ticket 118.

---

## 4. Build order and PRs

| Ticket | PR | Depends on | Size |
|---|---|---|---|
| [114](../tickets/114-my-account-a.md) My Account A | one draft PR | — | M |
| [115](../tickets/115-for-business-a.md) For Business A | one draft PR | — (Q1, Q2 answered) | S |
| [116](../tickets/116-blacqlight-index-a.md) BLACQLight index A | one draft PR, together with 117 | — | M |
| [117](../tickets/117-blacqlight-article-a.md) BLACQLight article page | same PR as 116 | 116's helpers | S |
| [118](../tickets/118-editorial-article-fields.md) Editorial fields (photo credit, linked businesses) | later, GATE-DATA | 116/117 shipped | S |

Each PR is a draft against `main`, with typecheck, lint, unit tests and build all green, and a Preview check at 375px and 1280px. Nothing merges without the founder.

---

## 5. Founder decisions

`[Decision — founder, 2026-10-03]` "accept all recommendations." Each answer below is the recommendation as written.

| # | Question | Decision |
|---|---|---|
| Q1 | The board said "Nobody can buy one." Starter gates the **Verified** *check* (`verified_badge: 1` in `lib/stripe/features.ts`), so that is only fully true of Certified | Subhead: **"Customers see your badge on every search. Badges are earned, never sold."** The Verified line adds "Available on Starter and up." |
| Q2 | "Most popular" on Starter | **No badge.** We have no numbers behind it |
| Q3 | How stories link to businesses | **Option A now** (markdown links in the body, internal listing paths, published listings only). **Option B later** (ticket 118, GATE-DATA). Adding links to the live stories is GATE-PUBLISH |
| Q4 | Photos for the For Business hero and the account claim prompt | A licensed photo already in `public/images/editorial/` for the Preview. The founder picks the final one at the Preview check |
| Q5 | Rename the account nav item "Community spend" to "The Collective" | **Yes**, in the 114 PR |
