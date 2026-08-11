# Photographic Style Direction — The BLACQList

**Created:** 2026-05-11
**Status:** Design direction — approved for implementation
**Applies to:** Platform shell, homepage, discovery, editorial, and business listing pages

---

## The Problem with the Current Build

The MVP shell is currently built with solid-color section backgrounds and typographic hierarchy alone. It reads as professional and well-structured — but it is missing the emotional register that made the original theblacqlist.com stand out. The original site was _felt_ before it was _read_. Visitors encountered real people, real food, real storefronts, real community — and that photography did the selling.

The new version has the typographic bones and the brand system. What it lacks is the visual heat that says: **these are real businesses, run by real people, worth your real dollars.**

This document defines where photography enters the build, what it looks like, and how to implement it technically without breaking the design system or introducing performance regressions.

---

## Photography Philosophy

The BLACQList is not a Yelp. It is not a generic business directory. It is a cultural artifact — a living document of Black economic presence in America.

The photography should communicate:

- **Specificity over stock.** A real barber at work in a real shop in Atlanta. Not a generic "diverse small business" stock photo with perfect lighting and no soul.
- **People and presence, not just products.** The owner's hands. A customer's face. The community around the business. Businesses are run by people — show them.
- **Warmth over slickness.** Rich, warm color grading. Golden hour light when it exists. Deep Browns, golds, and greens in the color palette that echo the brand's amber-gold without being matchy.
- **Documentary over promotional.** A restaurant in service: the kitchen, the plating, the dining room full. Not a sterile product shot.
- **Scale and ambition.** These businesses deserve the same editorial treatment as any feature in a premium lifestyle magazine. Full bleed. Big. Confident.

---

## Color Grading Direction

The brand's amber-gold (`#E2A428`) and deep background (`#19191E`) should feel at home with the photography — not fight it. Aim for:

- Warm midtones and highlights (golds, siennas, warm whites)
- Deep, rich shadows rather than crushed black
- High saturation in food, flowers, and textiles
- Skin tones always exposed for accuracy — never underexposed, never orange
- Avoid: cold/blue cast, desaturated "documentary grey," overly bright studio-white environments

When in doubt, a photo should feel like it belongs in **Essence**, **The Root**, or a NAACP Image Award campaign — not in a SaaS product marketing page.

---

## Where Photography Goes

### Priority 1 — Homepage Hero (Highest Impact)

**Current state:** Solid `#19191E` (`deep-bg`) background with large type and two CTAs. Clean but cold.

**Direction:** Replace the solid background with a full-bleed editorial photo as the hero background. The text and CTAs remain exactly where they are — the photo sits behind them with a dark gradient overlay to maintain legibility.

**Implementation pattern:**

```tsx
<section className="relative bg-deep-bg overflow-hidden" aria-labelledby="hero-heading">
  {/* Background photo */}
  <div className="absolute inset-0 z-0">
    <Image
      src="/images/hero-bg.jpg"
      alt=""  {/* Decorative — described by heading text */}
      fill
      className="object-cover object-center"
      priority
      sizes="100vw"
    />
    {/* Gradient overlay: dark left (for text), lighter right */}
    <div
      className="absolute inset-0 bg-gradient-to-r from-deep-bg/90 via-deep-bg/70 to-deep-bg/40"
      aria-hidden="true"
    />
  </div>

  {/* Content layer — unchanged from current */}
  <Container className="relative z-10 py-20 md:py-28">
    {/* ... existing hero text and CTAs ... */}
  </Container>
</section>
```

**Photo spec:**

- Dimensions: minimum 2400×1200px; export at 90% quality JPEG
- Subject: a vibrant, busy Black-owned business scene — full restaurant dining room in service, a barbershop with customers, a beauty salon with a stylist at work; a market with vendor stalls
- Focal point: left-center or center — leave the right third relatively open for the gradient fade
- Avoid: wide-open negative space backgrounds (the text needs contrast); single-subject portraits (too narrow); anything that looks like a headquarters lobby

**Responsive behavior:** `object-cover` with `object-center` handles all viewport sizes. On mobile the photo fills the section; the overlay ensures text contrast at all widths.

---

### Priority 2 — Business Listing Cards on Discover / Search

**Current state:** Listing cards likely render business name, category, and city with an icon or color swatch placeholder.

**Direction:** Every listing card that has a cover image should lead with that image. The card becomes photo-forward: image on top, text metadata below. Cards without photos fall back to a solid deep-bg with the business initials or a category-specific icon.

**Card layout:**

```
┌────────────────────────────────────────┐
│                                        │
│         Cover photo (3:2 ratio)        │
│         with gradient at bottom        │
│                                        │
├────────────────────────────────────────┤
│  [Category badge]                      │
│  Business Name                         │
│  City · State                          │
│  [Trust badge]     [Save button]       │
└────────────────────────────────────────┘
```

**Implementation pattern (image portion):**

```tsx
<div className="relative aspect-[3/2] w-full overflow-hidden rounded-t-xl bg-deep-bg">
  {coverImageUrl ? (
    <Image
      src={coverImageUrl}
      alt={`${businessName} storefront`}
      fill
      className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center bg-deep-bg">
      <span className="font-headline text-4xl text-white/20">{businessName.charAt(0)}</span>
    </div>
  )}
  {/* Subtle bottom gradient for text legibility if overlaying text on image */}
  <div
    className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/40 to-transparent"
    aria-hidden="true"
  />
</div>
```

**The hover scale effect** (`group-hover:scale-105`) creates the editorial zoom-on-hover common to high-quality photo grids — it adds energy without animation frameworks.

---

### Priority 3 — Business Entity Page Hero

**Current state:** The entity page has `EntityPageHero` and the architecture already references `cover_image_path`. Based on the design system doc, the hero is designed for a full-bleed photo with dark overlay.

**Confirm these are implemented:**

- [ ] Hero uses `next/image` with `fill` and `object-cover` for the cover image
- [ ] A dark gradient overlay (`from-deep-bg/80 via-deep-bg/50 to-transparent`) sits between the photo and the business name/CTA text
- [ ] When `cover_image_path` is null: fallback is solid `#19191E`, not a broken layout
- [ ] The `EntityMediaGallery` section uses a dark background (`bg-deep-bg`) as the design system specifies — it should feel like a curated editorial spread, not a thumbnail grid

**For the gallery specifically:**

```
Layout: Masonry or bento-style grid at desktop widths
- First image: spans 2 columns (largest; editorial anchor)
- Remaining images: 1 column each
- On mobile: single column, all images same size
- Between images: 4px gap (tight, editorial, not card-like)
- No captions, no borders, no rounded corners on gallery images
  (straight edges reinforce the editorial print feel)
```

---

### Priority 4 — Collection Feature Images

**Current state:** The `/collections` index page and collection detail pages likely display collection names as text with color backgrounds.

**Direction:** Each published collection should have a hero/feature image — a single editorial photo that captures the mood of the collection. "Atlanta's Best Brunch Spots" → warm, golden hour restaurant interior. "Black-Owned Bookstores" → intimate shop with warm lighting and shelves of books.

**Collections index card:**

```tsx
<Link
  href={`/collections/${collection.slug}`}
  className="group relative block aspect-video overflow-hidden rounded-2xl bg-deep-bg"
>
  {collection.coverImageUrl && (
    <Image
      src={collection.coverImageUrl}
      alt=""
      fill
      className="object-cover transition-transform duration-500 group-hover:scale-105"
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  )}
  {/* Bottom overlay — collection name reads over any photo */}
  <div
    className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
    aria-hidden="true"
  />
  <div className="absolute bottom-0 left-0 p-5">
    <p className="font-subhead text-xs text-amber-gold uppercase tracking-widest mb-1">
      Collection
    </p>
    <h3 className="font-headline text-xl text-white">{collection.name}</h3>
    <p className="font-body text-sm text-white/70 mt-1">{collection.listingCount} businesses</p>
  </div>
</Link>
```

This turns a flat text list into a magazine-grade editorial index.

---

### Priority 5 — Homepage City Tiles

**Current state:** Cities are plain white bordered boxes with city name and state abbreviation.

**Direction:** City tiles can become photo-forward — a recognizable image of the city skyline, a neighborhood scene, or a famous local landmark as a background with text overlaid. This is a significant upgrade that communicates geographic scale.

**Phased approach:**

- **Phase A (now):** Keep the current white-box tiles. They work. Don't block launch on this.
- **Phase B (V1):** Replace with photo tiles using the same overlay pattern as collections. Source 12 city photos from a paid stock library or through community submissions.

#### ✅ Shipped — PR #23, 2026-08-09

Phase B landed for **three of thirteen cities**, not twelve: Atlanta, Houston, and
Chicago — the three with live listings. The other ten stay on the ember wash **by
design, not by shortfall**, and `PhotoPanelGround` decides per tile by looking up
`CITY_PHOTOS[city.slug]`, so a city opening later becomes photographic the moment a
frame is added to the map and never before. A mixed grid is the intended end state
here for the same reason it is on the category bento.

Both consumers ground identically — `components/home/CityChapters.tsx` and
`app/(public)/cities/page.tsx`.

**Alt text names the city** (`alt="Atlanta skyline"`), which is the deliberate
*opposite* of the editorial panels' `alt=""`. Those are empty because their
filenames are invented aspirational business names that must never reach the
accessibility tree (see [Naming caution](editorial-image-licenses.md#naming-caution));
a skyline carries no such problem and the photograph is informative.

---

### Priority 6 — About Page

**Current state:** Likely text-only with section backgrounds.

**Direction:** The About page should include:

1. **Full-bleed hero photograph** — the BLACQList team, a community event, or a powerful editorial shot of a Black-owned business in full swing
2. **Inline pull photo** — a portrait-oriented photo mid-page to break up the text rhythm, floated right on desktop, full-width on mobile
3. **Community collage section** — a grid of 4–6 community/business photos at the bottom, similar to the media gallery pattern on business pages

---

### Priority 7 — For-Business Page

**Current state:** Marketing page aimed at business owners.

**Direction:** This page sells the product to business owners — it should show them what their page will look like. The most persuasive element is a mockup or real screenshot of a well-photographed BLACQList Page. Include:

- A hero with a "before/after" implication: worn website or Google Business listing → polished BLACQList Page
- At minimum, a screenshot or mockup of a completed BLACQList Page with a real cover photo
- Testimonial photos: headshots or portraits of business owners who have claimed pages

---

## Overlay Patterns Reference

Use these four overlay patterns consistently across the site. Never invent a new gradient per component.

| Name              | CSS                                                             | Use for                                                     |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| **Dark full**     | `bg-gradient-to-t from-black/80 via-black/40 to-transparent`    | Text at bottom of photo: collection cards                   |
| **Dark left**     | `bg-gradient-to-r from-deep-bg/90 via-deep-bg/70 to-deep-bg/40` | Text left-aligned over wide photos: homepage hero           |
| **Dark vignette** | `bg-gradient-to-br from-black/60 via-transparent to-black/60`   | Full-screen section heroes with centered text               |
| **Subtle scrim**  | `bg-black/30`                                                   | Light tinting when photo is already dark; card hover states |

All overlays use `aria-hidden="true"`. They are purely decorative.

### Grounded panels carry a feathered caption band — `PHOTO_PLATE_TINT` / `PHOTO_PLATE_VEIL`

**None of the four patterns above apply to a grounded panel.** The triptych, the
category bento, and the city tiles leave the picture itself untouched. Their text
rides a band across the bottom of the frame that is part-transparent and fades
upward into the photograph — `PHOTO_PLATE_TINT` (the color) and
`PHOTO_PLATE_VEIL` (the geometry and ramp) in `lib/design/surfaces.ts`, assembled
by `components/media/PhotoPanelCaption.tsx`.

This surface has been through three states in one day and the differences are the
whole point:

| | What it covered | Why it moved on |
| --- | --- | --- |
| `PHOTO_SCRIM` | the **whole frame**, to hold text set over the picture | darkened every photograph in the product |
| `PHOTO_PLATE` (solid) | a band **beside** the frame, opaque `deep-bg` | correct, but flat — the picture stopped at a hard line |
| `PHOTO_PLATE_TINT` + `_VEIL` | a band **over the bottom of** the frame, part-transparent, feathered | current |

The first move was a direction change rather than a tuning pass `[Decision —
founder, 2026-08-09: "i hate the black overlay on every picture"]`. `PHOTO_SCRIM`
existed because grounded panels are short and wide, so their text block ran from
the bottom padding up past halfway and covering it meant holding near-black
across two thirds of every frame. It cleared the floor and darkened every
photograph in the product to do it.

The second move recovered the picture the solid plate was hiding `[Decision —
founder, 2026-08-09: "what about if the current black area was an overlay with a
light ombre opacity to separate the words just enough, but I can still see the
picture through it"]`. **The standing rule survives it intact** — nothing is laid
across a photograph to solve a legibility problem. What is veiled is the caption
band alone, and it is veiled to a measured alpha rather than a chosen one.

**The constraint was never the photograph; it was small gold type on an unknown
ground.** The count line is `text-xs`, so it owes **4.5:1** where the 19–40px
white headlines get the 3:1 large-text allowance. The solid plate answered that
by making the ground a constant — gold **8.16:1**, white **20.01:1**, ink-soft
**9.78:1** on `deep-bg` `[Measured — scripts/measure-panel-contrast.ts, 144 text
spans, 2026-08-09]`. A translucent band gives that constant back up, so the ratio
returns to being per-frame and has to be measured as pixels rather than derived
from a token.

`scripts/measure-plate-contrast.ts` does that: it hides only the caption text,
leaves the veil and its blur painted, screenshots at 1:1, and composites each
run's own color over **every** pixel under it, keeping the worst. It sweeps the
alpha in the same pass:

| `PHOTO_PLATE_TINT` alpha | runs below floor | worst gold |
| --- | --- | --- |
| 0.88 | 0 | 6.16:1 |
| **0.82 (shipped)** | **0** | **5.00:1** |
| 0.80 | 0 | 4.70:1 |
| 0.78 | 3 | 4.35:1 ✗ |
| 0.76 | 8 | 4.03:1 ✗ |

`[Measured — scripts/measure-plate-contrast.ts, 123 text runs × 2 routes ×
375/768/1280, 2026-08-09]`. 0.80 passes too and was not taken: it clears by 4%,
inside the range a different image decode or text antialiasing can move, where
0.82 clears by 11%.

Four consequences worth knowing before you touch a grounded panel:

1. **The crop got gentler twice.** Text off the frame dropped the vertical cut
   from 33–41% to ~16%; filling the whole panel behind the caption dropped the
   bento's from ~47% to ~11%. Every `PHOTO_FOCAL` value below is applied to a
   milder crop than it was tuned against — the safe direction.
2. **The ramp is anchored in pixels, not percentages.** Anchored at 58% of the
   veil's own height, a tall caption pushed the fade down into its own first
   line: the cities feature tile's "Most active" eyebrow measured **3.87:1** over
   a bright skyline `[Measured — 1280px, 2026-08-09]`. `calc(100%-3.5rem)` is the
   caption's exact top edge, so caption height stops being a variable.
3. **`backdrop-blur` is load-bearing.** It collapses the local neighbourhood into
   an average, so a busy ground stops having a worst pixel far from its mean.
   That buys real alpha back for the same measured ratio. Removing it is a
   contrast change, not a style change.
4. **The picture must lead the caption.** The band is content-height, so a
   two-line name grows it; size fixed grid rows against the *worst* tile, not the
   typical one.

**If type on a panel is hard to read, do not reach for more alpha first.**
Re-measure, check the ramp anchor, and only then consider the type — swapping the
count line to `text-light-gold` `#ffd867` buys about 15 points of transparency
and is the lever of last resort.

### Panels with no photograph — `PHOTO_ABSENT`

Most categories and most cities will never have a frame, so the unphotographed
tile is permanent furniture, not a gap. It renders `PHOTO_ABSENT`: a graded
charcoal ground with the brand's gold lifted into the same top-right corner the
ember wash uses, so it reads as the same family as a photographed tile.

**As of 2026-08-09 it renders nowhere** — the category bento is 9 of 9
photographic and every live city has a skyline. It stays in `surfaces.ts` anyway:
the next category added, or any frame withdrawn on a rights question, falls
straight onto it, and a fallback written only once it is needed is a fallback that
does not work.

It is deliberately louder than `EMBER_WASH` and kept as a **separate** token.
The wash's other three consumers (`TheAvenues`, `BlacqlightFeature`,
`ShowcaseCarousel`) set gold and white text directly on it, so raising its alpha
would cut their contrast to buy brightness on a surface that has no such problem.
Nothing sits on `PHOTO_ABSENT`, so it owes no ratio and is free to carry color.
`[Observed — the 0.16 wash read as a void once the scrim came off and the frames
beside it went to full brightness, 2026-08-09]`

### Focal points — `PHOTO_FOCAL`

`object-cover` centers by default, which is wrong for a short wide tile: a 3:2
source in a 2.2:1 tile loses ~16% off the top, and that is exactly where faces sit.

`PHOTO_FOCAL` in `lib/design/surfaces.ts` maps **frame path → `object-position`
class**, and `PhotoPanelGround` looks it up itself. Keyed on the photograph rather
than the surface, because a face sits in the same place wherever the frame is used
— so one map correction fixes every surface at once and no call site changes.

Two rules that are easy to get wrong:

1. **Lower percentages preserve heads.** With a total vertical cut `c` and an
   `object-position` y-fraction `P`, the visible band is `[c·P, 1 − c·(1−P)]`. A
   lower `P` spends more of the cut on the bottom, which the scrim covers anyway.
2. **Do not re-crop the source files.** The optimizer deliberately preserves the
   native 3:2 so one file serves a wide hero and a square card
   ([Aspect ratio](editorial-image-licenses.md#aspect-ratio)). The fix belongs at
   render time.

Values must be **literal strings** so Tailwind's class scan can see them — an
interpolated class is a class that never ships. Set each value by reading the
source frame, then verify it in a real render; the frame alone will mislead you by
a few points of position.

---

## Technical Implementation Rules

### 1. Always Use `next/image`

Never use `<img>` tags for editorial photography. `next/image` provides:

- Automatic WebP/AVIF conversion
- Responsive `srcset` generation
- Lazy loading by default
- Core Web Vitals-safe LCP when `priority` is set on above-fold images

```tsx
// Hero and first visible images — add priority
<Image src="..." alt="..." fill priority className="object-cover" />

// Below-fold images — lazy load by default (no priority prop needed)
<Image src="..." alt="..." fill className="object-cover" />
```

### 2. `sizes` Attribute Is Required on `fill` Images

Without `sizes`, Next.js Image serves oversized files. Every `fill` image needs it:

```tsx
// Full-width section: hero, collections hero
sizes = '100vw'

// Half-width at desktop: two-column layouts
sizes = '(max-width: 768px) 100vw, 50vw'

// Third-width at desktop: three-column grids
sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
```

### 3. Alt Text Rules for Photography

| Image type            | Alt text rule                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Decorative background | `alt=""` — do not describe it; it adds noise to screen readers                              |
| Business cover photo  | `alt="{businessName} storefront"` or `alt="{businessName}"`                                 |
| People/team photos    | Describe who is in the image: `alt="Chef Marcus Williams plating a dish at his restaurant"` |
| Gallery images        | `alt=""` if decorative; short description if informational                                  |
| Hero/editorial photos | `alt=""` if the nearby heading text describes the context                                   |

### 4. Supabase Storage Paths in `next.config.ts`

All business photos are stored in Supabase Storage. Confirm `remotePatterns` allows the Supabase project URL:

```ts
// next.config.ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/**",
    },
  ],
}
```

Without this, Next.js Image will refuse to optimize Supabase-hosted photos and return an error.

### 5. No Intrinsic Dimensions on `fill` Images

When using `fill`, the parent container controls the dimensions — not the image. Always set the parent to `relative` with an explicit `aspect-ratio` or `height`:

```tsx
{
  /* ✓ Correct */
}
;<div className="relative aspect-[3/2] overflow-hidden">
  <Image src="..." fill className="object-cover" />
</div>

{
  /* ✗ Wrong — fill with no parent height constraint */
}
;<div className="relative">
  <Image src="..." fill className="object-cover" />
</div>
```

### 6. Skeleton States for Photos

Every photo container should show a skeleton while loading. The skeleton background should match the section's dominant color expectation:

```tsx
<div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-charcoal/20 animate-pulse">
  {/* Image renders on top once loaded */}
  <Image ... />
</div>
```

---

## Photography Source Strategy

### For Soft Launch (Immediate)

Use a curated set of **licensed stock photos** for the homepage hero and any page that requires photography before real community photos exist. Quality over quantity — one excellent licensed photo per section is better than multiple mediocre ones.

**Recommended sources:**

- **Unsplash for Business** — paid license; rich editorial quality; good coverage of food, beauty, and retail
- **Getty Images / iStock** — broad commercial catalog; search for "Black-owned business", "Atlanta restaurant", "Black entrepreneur"
- **TONL** and **Nappy** — stock libraries specifically curated for diversity and authentic Black representation
- **Canva Pro** — if the team already has a subscription

**What to license for soft launch (minimum set):**

1. Homepage hero — 1 wide editorial shot of a Black-owned business in full service (restaurant or barbershop preferred)
2. Collections index placeholder — 4–6 category/mood photos
3. About page hero — 1 community or team photo

### For V1 (Community-Sourced)

As businesses claim and complete their listings, their cover photos become the photography. The platform becomes self-photographing — every new cover image adds to the visual richness of the discover and search pages. This is the flywheel: better photography drives more business claims, which creates more photography.

Actively support this by:

- Making cover photo upload the first-emphasized step in the owner dashboard
- Showing the AI page optimization checklist item "Cover image uploaded (8 points)" prominently
- Providing minimum photo specs in the upload UI: "1200×800px minimum for best quality"

---

## Sections That Stay Color-Only (No Photography)

Not every section should have photography. These sections intentionally remain color-block:

| Section                                              | Why                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| ~~Homepage feature trio (Discover / Support / Connect)~~ | **Amended 2026-08-09 — see below. Now photographic.**                |
| ~~Categories grid~~                                  | **Amended 2026-08-09 — see below. Now photographic where mapped.**       |
| The Avenues band                                     | 120px tall across six columns — a photo at that size is texture, not an image, and two photographic bands stacked flattens the hierarchy the triptych above it owns |
| Legal pages (Privacy, Terms, Cookies)                | Documents — clean white background is correct                            |
| Dashboard and admin                                  | Application UI — photography adds cognitive load to functional screens   |
| Auth pages (sign-in, sign-up)                        | Focused task completion; photography is a distraction here               |
| Footer                                               | Dark solid background; photography would undermine legibility            |

The deep-bg on the "Your BLACQList Page" and final CTA sections is a deliberate choice — the brand's cinematic authority comes from the dark surface itself, not from a photo. Do not add photography to those sections.

> **Note on the token:** this document elsewhere calls deep-bg `#19191E`. The value that actually ships is **`#08080a`** (`--color-deep-bg`, `app/globals.css:17`). The hex here predates the token; the token is authoritative.

### Amendment — 2026-08-09: the trio and the bento take photography

[Decision — 2026-08-09] Rows 1 and 2 above are overridden. Both surfaces now render a licensed editorial photograph via `PhotoPanelGround`, with the panel's text on the feathered caption band rather than over the picture.

**Why the original reasoning didn't hold.** Row 1 argued photography would compete with the typography. In practice the trio's three panels were the largest dark voids on the homepage and read as unfinished — the typography wasn't competing with anything, it was carrying a blank ground alone. Row 2 argued photography would be too noisy at small tile sizes; moving the text off the picture resolves that, and the feature tile is not small.

**The standing principle is unchanged.** "Specificity over stock" still governs: a photograph goes on a tile only where a real frame fits the subject. Fourteen of twenty-five top-level categories are mapped and the other eleven keep the ember wash **permanently**. A mixed grid is still the intended end state for the full category list — do not fill the remainder for visual uniformity, and do not stretch a frame to fit a category it does not depict.

**Amended 2026-08-09 (PR #23):** three more frames were added — `food-dining`, `fashion-apparel`, `arts-culture` — taking the *rendered* bento from 4 of 9 photographic to 7 of 9. All three picks are people-free, which is what lets them survive a short wide tile.

**Amended again, same day:** `healthcare` and `social-media-marketing` were filled from the staging archive `[Decision — founder, 2026-08-09: "I also want the two images back in the bento area"]`, taking the rendered bento to **9 of 9**. The note that previously sat here argued both should stay on the wash, and its objection was sound rather than obsolete — every healthcare candidate was a head-at-top portrait or a cold clinical frame, and nothing in the *pool* depicted marketing honestly. What changed is the source: `physician-portrait` and `agency-desk` came out of the archive, not the pool, and the crop got gentler (~11% cut, down from ~47%) once the frame filled the whole panel. `physician-portrait` is still the brightest ground under the gold count line anywhere in the set — check it first whenever `PHOTO_PLATE_TINT` moves. Both depict identifiable people, so restriction 2 of the Canva license is live on them; see `editorial-image-licenses.md`.

**Rows 3–6 stand.** Legal, dashboard/admin, auth, and footer remain photo-free for the reasons given.

**Where the map lives:** `CATEGORY_PHOTOS` in `lib/design/surfaces.ts`. Alt text is empty on every editorial photo in both surfaces — the panel heading carries the meaning, and empty alt is also what keeps the invented filenames out of the accessibility tree (see the naming caution in `editorial-image-licenses.md`). The city skylines are the exception: they pass an explicit `alt` because there the photograph is informative and names a real place.

---

## Implementation Priority Order

| Priority | Section                         | Complexity                                                 | Photo type needed                |
| -------- | ------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| 1        | Homepage hero                   | Low — add one `Image` + overlay to existing JSX            | 1 licensed editorial photo       |
| 2        | Business entity page hero       | Confirm `EntityPageHero` already implements this correctly | Uses listing cover photos        |
| 3        | Discover / search listing cards | Medium — card component refactor to image-first layout     | Uses listing cover photos        |
| 4        | Collections index cards         | Medium — collection card component                         | 1 photo per collection           |
| 5        | About page                      | Low — add hero image + inline pull photo                   | 1–2 licensed or community photos |
| 6        | For-business page               | Medium — add mockup/screenshot visual                      | Product screenshot or mockup     |
| 7        | City tiles on homepage          | ✅ Shipped PR #23 — `PhotoPanelGround` + `CITY_PHOTOS`      | 3 city photos (live cities only) |

---

## Before / After Comparison

| Location               | Current                      | Target                                                                    |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Homepage hero          | Dark text on `#19191E` solid | Editorial photo with dark-left gradient overlay; text unchanged           |
| Discover listing cards | Text cards with color accent | Photo-first cards at 3:2 ratio; business name + city below                |
| Collections index      | Text list or text cards      | Photo cards with bottom gradient overlay and collection name              |
| Business page hero     | `EntityPageHero` on deep-bg  | Full-bleed cover photo with overlay; design system already specifies this |
| About page             | Text on cream/white sections | Full-bleed hero photo; inline pull photo mid-page                         |
