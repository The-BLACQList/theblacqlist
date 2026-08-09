# Editorial image licenses

**Status:** ✅ **Recorded — clears the merge block on the image PR.**
**Last updated:** 2026-08-09

`.claude/rules/3d-assets.md` requires a recorded license per asset before it enters
the product: source, author, license name, and commercial-use confirmation.

**Source of record:** all twelve photographs were obtained through the founder's
**Canva Pro** subscription and are licensed under the **Canva Content License
Agreement (Pro content)**
`[Decision — founder statement, 2026-08-09]`.

That license permits commercial use without attribution, and it carries three
restrictions that bind how these files may be used here. They are written out in
[Canva Pro restrictions that bind us](#canva-pro-restrictions-that-bind-us) below —
read that section before placing any of these images on a new surface.

---

## The pool

Twelve photographs, delivered as 3840×2560 JPEGs (~5.7 MB each) in
`public/images/listings/`. They matched no live listing and were referenced by no
file `[Measured — repo grep, 2026-08-09]`. Under
[Decision 023](../../ops/decision-log.md), business cards get the generated F-1
abstract tile rather than stock photography, so this pool was repointed from a
dead listing-cover set to **page and editorial imagery**, which is the use
`photographic-style-direction.md` actually asks for.

They were optimized to 1600px-wide WebP in `public/images/editorial/` and the
68 MB of originals were deleted in the same commit. `public/images` went from
69 MB to 1.5 MB `[Measured — du, 2026-08-09]`.

Re-run with `pnpm images:editorial` if the pool changes.

---

## Inventory

All twelve share one provenance, so the license columns are uniform. They are
written per row anyway rather than collapsed into a note — `3d-assets.md` asks for
a record **per asset**, and a table that stays row-complete survives the pool being
split or added to later.

| File | Size | Where used | Source | Author / rights holder | License | Commercial use | Attribution required |
|---|---|---|---|---|---|---|---|
| `afrofuturist-bookshop.webp` | 110 KB | `/about` hero | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `sable-fitness-collective.webp` | 95 KB | `/about` pull band | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `asha-osei-photography.webp` | 104 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `calabash-candles.webp` | 53 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `crown-and-coil-studio.webp` | 83 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `diaspora-creative-agency.webp` | 80 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `melanin-law-group.webp` | 40 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `peach-and-rye-kitchen.webp` | 88 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `rooted-tech-solutions.webp` | 96 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `soleil-kidswear.webp` | 37 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `ujima-construction.webp` | 83 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `zinga-interior-design.webp` | 147 KB | unplaced — pool | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |

**On the `[Unknown]` author.** Canva does not surface the individual contributor's
name on a Pro stock download, and the filenames here were assigned by us, not by
Canva — so the photographer is not recoverable from the files we hold. The
**licensor** is Canva, which is the party whose terms govern our use, and
attribution is not required, so nothing turns on the gap. It is marked `[Unknown]`
rather than left blank because that is the honest state, per
`.claude/rules/no-fabrication.md`.

**If these are Canva AI-generated images rather than Canva stock**, one cell
changes: source becomes *Canva Magic Media*, and the "identifiable people"
restriction below falls away (there is no model to release). Everything else —
commercial use, no attribution, the standalone-redistribution ban — holds either
way. Say the word and I'll correct the row; the merge does not wait on it.

**"Unplaced — pool"** means the file is committed and optimized but rendered
nowhere. It is available for guides and BLACQLight once editorial content exists
— both tables are at **0 rows** `[Measured — psql prod, 2026-08-09]`.

---

## Canva Pro restrictions that bind us

The Canva Content License is permissive on the two things we needed — **commercial
use is allowed and attribution is not required** — and restrictive on three things
that are live concerns for a business directory. These are conditions of the
license, not style preferences.

| # | Restriction | What it rules out here | Status |
|---|---|---|---|
| 1 | **No standalone redistribution.** The licensed file may be used *within* a design or product; it may not be offered as the file itself, resold, or made available for others to download as stock. | We may render these on pages. We may **not** ever hand one to a business owner as a cover image, seed one into `listings.cover_image_path`, or expose the pool through an "pick an image" picker in the owner dashboard. | ✅ Held — the owner-upload flywheel (Track 4) ships owners an *upload* path, never a library. |
| 2 | **No implied endorsement by identifiable people.** Content depicting recognizable individuals may not be used to suggest that person endorses a product, business, or viewpoint, and may not be used in a sensitive context. | We may **not** place a photo containing a person beside a named business in a way that reads as *that business's* staff, owner, or customers. | ✅ Held — and this is the second, independent reason for the rule already stated under [Naming caution](#naming-caution). The brand reason and the license reason land in the same place. |
| 3 | **No use as a trademark or logo.** Licensed content may not be registered or used as a brand mark. | We may **not** build one of these into the BLACQList wordmark, favicon, app icon, or default site-wide OG image — a default OG image is close enough to a brand mark to stay clear of. Per-page editorial OG images are fine. | ✅ Held — brand marks are the five SVGs in `public/images/`, all first-party. |

**Two standing conditions on the license itself:**

- **It is tied to the Canva Pro subscription.** Canva's terms treat content already
  used in completed work differently from new downloads, but the safe operating
  assumption is that **if Pro lapses, no new Pro content gets pulled into the
  product**. Existing placements are the founder's call to re-verify at that point.
  `[Assumption — not verified against the current agreement]`
- **Verify before a materially new use.** Canva revises the Content License
  Agreement periodically. This record reflects it as understood on **2026-08-09**;
  before using these images in a materially different way — print, paid media, a
  packaged download, anything commercial beyond web page decoration — re-read the
  current agreement at `canva.com/policies/content-license-agreement`.
  `[Needs professional review]` if the answer is not obvious from the text.

---

## Naming caution

Every filename reads as a business name (`melanin-law-group`,
`peach-and-rye-kitchen`). **None of these correspond to a real listing in the
directory** `[Measured — psql prod, 2026-08-09]`. They are generic editorial
photographs that were named aspirationally when the listing-cover strategy was
still live.

Two consequences that hold regardless of what the license record says:

1. **Never render one of these next to a named business.** A photo captioned or
   positioned as *that* storefront misrepresents the business — the exact failure
   `living-commerce-index.md:63` rules out and the reason business cards use the
   F-1 tile instead. Restriction 2 above reaches the same rule from the license
   side, so this holds on two independent grounds.
2. **These filenames must not leak into user-visible text** — no alt text, no
   caption, no `title` attribute derived from the filename. Both placed images
   carry `alt=""` because the adjacent heading supplies the context and the photo
   is editorial, not documentary (`photographic-style-direction.md` §3).

---

## Placement decisions

Two deviations from the approved plan's Track 3, both deliberate:

| Surface | Plan said | What shipped | Why |
|---|---|---|---|
| `/for-business` | Place a photo | **No photo** | `photographic-style-direction.md` Priority 6 specifies a *"Product screenshot or mockup"* for this slot, not a licensed photograph. Substituting stock there would violate the doc's own spec for the surface. Left for a real product shot. |
| `/collections` | Place a photo | **Image slot wired, no value written** | Priority 4 is *"1 photo per collection"* — that lives in `collections.cover_image_path`, a production DB write and therefore **GATE-DATA**. `CollectionCard` now renders a 3:2 `CoverImage` that reads the column and falls back to the F-1 tile; the founder fills the column through `/admin/collections`, where the form field already exists. |

Homepage hero (Priority 1) was already done before this work —
`public/images/hero-bg.jpg`, wired in `components/home/HomeHero.tsx`.

---

## Aspect ratio

The optimizer preserves the native **3:2** rather than cropping to the plan's
literal 16:9. All twelve sources are 3:2, which is already the house ratio:
`photographic-style-direction.md` specifies *"Photo-first cards at 3:2 ratio"*,
and the shipped `hero-bg.jpg` is 3:2 at 1920×1280. Slots needing another shape
crop with CSS `object-cover` at render time, so one file serves a wide hero and a
square card without baking a crop decision into the asset.

---

## Delivered bytes

`next/image` re-encodes to WebP/AVIF at serve time regardless of source format,
so this optimization buys **repo weight and build input size, not delivered
bytes**. The user-facing win is that 68 MB no longer sits in the repo and in
every clone, CI checkout, and Vercel build context.
