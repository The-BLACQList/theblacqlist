# The Living Commerce Index — Design Direction

**Status:** Adopted (founder, 2026-08-06) · **Audience:** everyone touching public UI
**Companion:** `design-references.md` · sister-bundle prototypes in `prototypes/` (reference only)

The direction in one sentence: **full-color documentary photography framed by black and warm-cream
editorial surfaces, with precise gold nodes, rules, labels, and interaction states connecting the
experience.** Not a return to the old photographic site; not the current minimal directory. The
photography carries people, places, products, and culture; the black/cream/white/gold system
organizes it and makes the platform feel trustworthy, premium, and contemporary.

---

## The visual formula

| Layer | Presence | Purpose |
|---|---|---|
| Photography | 50–60% | Emotion, identity, credibility, cultural texture |
| Editorial/product layout | 25–35% | Hierarchy, usability, clarity |
| Gold-node graphics & data | 10–15% | Brand recognition, connection, intelligence |

The Gold Node Network is the **structure around** the photography, never a replacement for it.

## What the current refresh already gets right (keep)

Black navigation + gold Q · typography and spacing discipline · comprehensible interface · real
search/filtering · direct, warm, community-centered homepage language · restrained
black/cream/gold/gray palette that lets businesses be the visual focus.

**The problem:** the visual experience collapses after the homepage hero — white cards, empty
swatches, plain pills, placeholder initials, database-record listing cards, directory-profile
business pages. The photography reads as belonging to the hero, not the brand.

---

## Page-by-page direction

### Homepage (final section order)
1. Photographic hero with integrated search (real owner in their real environment; asymmetric crop;
   gradient only behind text; rotating by city/category/founder story/season)
2. **Discover / Support / Connect** → three large editorial photo panels (word, one sentence, gold
   node index, hover darken, arrow) — not white cards
3. Curated category image grid (8–12 documentary tiles, mixed proportions, count + node per tile)
4. Featured-business editorial spotlights (every 6th–8th listing becomes a large feature)
5. **Fresh Finds** — the newest listings in the index, ungated by tier. Replaced "Trending near
   you" (most-saved) [Decision — 2026-08-09]: `save_count` ordering on a thin engagement set
   surfaced the same handful every render and made a business that joined today invisible.
6. **City chapters** — photographic city cards (neighborhood imagery, counts, featured category,
   local BLACQLight story); coming-soon cities stay quiet/typographic
7. **"Your BLACQList Page" microsite showcase** — carousel of real page previews (restaurant w/
   menu, consultant w/ packages, creative w/ portfolio…): "More than a listing. Your official
   business home inside the Black commerce network."
8. Community impact / dollar-circulation data
9. BLACQLight founder feature (the editorial heart: large portraits, B&W + selective gold,
   pull quotes)
10. Business-owner CTA · photographic footer transition

"Find What You Need" becomes a split-screen module: changing photograph left; indexed discovery
paths right (01 Near You · 02 Open Now · 03 Highly Rated · 04 Newly Added · 05 Black-Woman-Owned ·
06 Community Favorites); hover changes the image.

**Tile 05 reads "Black-Woman-Owned," not "Women-Owned"** [Decision — founder, 2026-08-09]. That is
the actual facet — `/discover?attrs=black-woman-owned`, seeded at `supabase/seed.sql:630`. The
broader label would promise a set the filter does not return.

**Tile 01 "Near You" has no filter behind it** — `/discover` has no `lat`/`lng`/`radius` param, no
`distance` sort key, and no geolocation prompt `[Observed, 2026-08-09]`. Listings do carry lat/lng
from the N7 geocode pass, so the data exists, but the filter is a feature to build rather than a
link to write. Open founder call, tracked in `ops/next-actions.md`: build the radius filter, drop
to a five-tile module, or swap the tile for something that exists. **The module is not buildable
until that is settled.**

### Discovery / search
- **Claimed card:** 4:3 or 3:2 photograph · logo · name · category+city · verification ·
  short descriptor · open/closed · price range where apt · save · quick-view.
- **Unclaimed card:** never stock photography that could be mistaken for the business. Use the
  business's supplied logo, a branded category texture + monogram, a city/category pattern with a
  visible "Unclaimed" label, or a verified exterior. The initials fallback survives only as the
  lowest tier — recomposed with category iconography + a subtle node pattern.
- **Grid rhythm:** never 24 identical cards — standard cards + occasional wide features + founder
  spotlights + collection inserts + city rows.
- **Quick view:** side panel (image, intro, hours, top offerings, location, trust badge, actions)
  without losing results.

### BLACQList Pages → business microsites
Anatomy: ① immersive 55–70vh hero (logo, name, category, city, status, one-line proposition,
business-defined primary CTA — View Menu / Book / Shop / Request Consultation / View Portfolio /
Buy Tickets — with BLACQList controls visible but secondary) · ② sticky internal nav (Overview ·
Menu/Services · Gallery · Reviews · About · Visit · Updates — only tabs with content; mobile =
scrollable tabs + persistent bottom CTA) · ③ quick-info rail (open, address, price, rating,
verification, fulfillment options, accessibility) · ④ **featured offerings first — what the
business sells, visually, never a paragraph** · ⑤ two-column editorial story (photo + origin/
mission/quote; not everything in bordered white cards) · ⑥ type-specific content (below) ·
⑦ gallery mosaic → full-screen · ⑧ dedicated Trust panel (claimed/verified, last update, reviews,
report correction, methodology) — aside on desktop, collapsible on mobile; trust never interrupts
the business story · ⑨ rich Visit section (map, exterior, hours, parking, accessibility, contact,
directions, CTA) · ⑩ contextual related (nearby, similar, complements, same collection).

The page must say: *"You have arrived at this business's official home inside The BLACQList."*

### Page archetypes (shared header/trust/type/node language; content sets the center of gravity)

| Archetype | For | Emphasis |
|---|---|---|
| **Commerce** | restaurants, retail, food, products | what can be bought (menu, collections, delivery) |
| **Service** | salons, consultants, lawyers, wellness, professionals | services, team, pricing, booking |
| **Portfolio** | creatives, studios, media, agencies | projects, visuals, capabilities, inquiries |
| **Experience** | venues, events, travel, culture | schedule, tickets, gallery, visitor details |
| **Opportunity** | employers, jobs, programs, education | openings, requirements, deadlines, applications |

### Claimed / unclaimed / verified tiers
Unclaimed: attractive but visibly limited (basic hero, verified imagery only, essentials, claim
CTA). Claimed: the complete mini-website. Verified/enhanced: verification module, richer layouts/
media, featured offerings, custom lead/booking actions, insights. **Essential information is never
hidden behind a tier — paid value is presentation, media, conversion tools, analytics.**

---

## Photography direction

Feel: documentary, proud, current, warm, locally grounded, culturally specific; professional
without corporate, aspirational without luxury cosplay.

Minimum mix for a strong claimed page: hero/environment 1 · founder/team 1 · product/service 2 ·
interior/exterior 1 · community/process 1.

Grade (consistent): warm skin tones · deep but detailed blacks · muted background saturation ·
controlled highlights · slight warmth in neutrals · **no heavy orange filter, no artificial gold
glow**. B&W reserved for editorial/historical/BLACQLight.

## Gold Node Network discipline

Appears: at photo edges, behind maps, in section transitions, around verification badges, as
hotspots, in loading/empty states, in charts, as subtle crops inside category tiles.
**Never:** dense node lines over faces or products; network as universal background. The Q Node is
the signature; the supporting network stays quiet.

## Performance guardrails (non-negotiable)

Responsive AVIF/WebP · exactly one preloaded hero image · lazy galleries · blur/neutral
placeholders · explicit dimensions · mobile crops · owner focal points · CDN transforms · no
autoplay hero video on mobile by default · adaptive contrast scrims · existing homepage/listing
LCP-INP budgets hold (Lighthouse mid-tier before/after every phase).

## Implementation phases (adopted order)

1. **Photographic system** — ratios, focal points, fallbacks, overlays, crops, compression, alt text
2. **Discovery cards** — the largest immediate improvement platform-wide
3. **Business microsite shell** — hero, sticky tabs, rail, offerings, gallery, trust, visit
4. **Category-specific modules** — food, professional services, beauty/wellness, retail, creative
5. **Homepage refresh** — built on real listing imagery, not marketing-only assets
6. **Owner editor upgrades** — focal point, hero choice, gallery order, menu/service items, tab
   config within guardrails, section reorder, device preview, primary CTA

*Sequencing note (2026-08-06): the Professional (Service) and Creative (Portfolio) templates are
being built first in this style as the proof pages — they double as the Additional Page Templates
card. Job/Opportunity is deferred pending its entity-type migration.*

## First proofs

One highly photographic **Service** page (professional) and one **Portfolio** page (creative) —
testing whether the system is both culturally rich and operationally useful without drifting back
into visual inconsistency. (The direction doc's original proposal — restaurant + professional —
lands at phase 3 when the Commerce microsite shell is built.)
