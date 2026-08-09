# Editorial image licenses

**Status:** ✅ **Recorded.** All **eighteen** photographs are cleared — the original
twelve plus the six added on 2026-08-09 in PR #23.
**Last updated:** 2026-08-09

`.claude/rules/3d-assets.md` requires a recorded license per asset before it enters
the product: source, author, license name, and commercial-use confirmation.

**Source of record:** all eighteen photographs were obtained through the founder's
**Canva Pro** subscription and are licensed under the **Canva Content License
Agreement (Pro content)** `[Decision — founder statement, 2026-08-09]`. The
statement was made twice: once about the original twelve, and again about the six
staging-directory frames once they were selected — *"they still came from canva.
All of them."*

That license permits commercial use without attribution, and it carries three
restrictions that bind how these files may be used here. They are written out in
[Canva Pro restrictions that bind us](#canva-pro-restrictions-that-bind-us) below —
read that section before placing any of these images on a new surface.

---

## The pool

**Eighteen photographs**, from two deliveries.

**The original twelve** arrived as 3840×2560 JPEGs (~5.7 MB each) in
`public/images/listings/`. They matched no live listing and were referenced by no
file `[Measured — repo grep, 2026-08-09]`. Under
[Decision 023](../../ops/decision-log.md), business cards get the generated F-1
abstract tile rather than stock photography, so this pool was repointed from a
dead listing-cover set to **page and editorial imagery**, which is the use
`photographic-style-direction.md` actually asks for.

They were optimized to 1600px-wide WebP in `public/images/editorial/` and the
68 MB of originals were deleted in the same commit. `public/images` went from
69 MB to 1.5 MB `[Measured — du, 2026-08-09]`.

**The six added in PR #23** did not come from `public/images/listings/`. They were
selected out of two staging directories the founder assembled separately —
`public/images/city-images/` (7 PNGs) and `public/images/BL-image-sourcing/`
(26 PNGs) — and are the same Canva Pro provenance as the twelve
`[Decision — founder statement, 2026-08-09]`. Roughly twenty frames in those
directories were **not** selected and remain available for a future category fill;
they are archived outside the repo (see below), not deleted.

Re-run with `pnpm images:editorial` if the pool changes.

**Committed weight after PR #23: 2.3 MB** `[Measured — du, 2026-08-09]` —
`editorial/` 1.4 MB, `cities/` 428 KB, `hero-bg.jpg` 452 KB. The six new frames
cost ~830 KB.

---

## The staging archive

The 33 unoptimized source PNGs — `BL-image-sourcing/` (26 frames, 123 MB) and
`city-images/` (7 frames, 36 MB) — **were moved out of the repo on 2026-08-09**
`[Decision — founder, 2026-08-09]` to `../blacqlist-image-archive/`, a sibling
folder outside version control.

They had been sitting inside `public/`, which meant that even though PR #23
git-ignored them, they still uploaded into every Vercel build context and partly
undid PR #20's 68 MB → 1.5 MB reduction. **`public/images` went 161 MB → 2.3 MB
on the move** `[Measured — du, 2026-08-09]`, and nothing that ships changed —
typecheck, lint, build, and the full test suite were re-run after the move to
prove it.

**Moved, not deleted.** Roughly twenty unselected frames are still good stock the
founder paid for, and `healthcare` and `social-media-marketing` remain unphotographed
in the category bento by design. If either is ever filled, the source is in the
archive. The `.gitignore` entries stay in place as a standing guard in case a copy
is dropped back into `public/` for another selection pass.

---

## Inventory

All eighteen share one provenance, so the license columns are uniform. They are
written per row anyway rather than collapsed into a note — `3d-assets.md` asks for
a record **per asset**, and a table that stays row-complete survives the pool being
split or added to later. That is exactly what happened: the six PR #23 rows below
the rule slotted in without reshaping the table.

| File | Size | Where used | Source | Author / rights holder | License | Commercial use | Attribution required |
|---|---|---|---|---|---|---|---|
| `afrofuturist-bookshop.webp` | 110 KB | `/about` hero + category bento — `books-publishing` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `sable-fitness-collective.webp` | 95 KB | `/about` pull band + category bento — `wellness-health` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `asha-osei-photography.webp` | 104 KB | homepage triptych — 01 Discover | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `calabash-candles.webp` | 53 KB | category bento — `retail-gifts` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `crown-and-coil-studio.webp` | 83 KB | category bento — `beauty-grooming` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `diaspora-creative-agency.webp` | 80 KB | homepage triptych — 03 Connect | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `melanin-law-group.webp` | 40 KB | category bento — `legal-financial` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `peach-and-rye-kitchen.webp` | 88 KB | homepage triptych — 02 Support | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `rooted-tech-solutions.webp` | 96 KB | category bento — `technology` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `soleil-kidswear.webp` | 37 KB | category bento — `childcare-family` **only** | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `ujima-construction.webp` | 83 KB | category bento — `construction-trades` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `zinga-interior-design.webp` | 147 KB | category bento — `home-living` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `bbq-plate.webp` | 137 KB | category bento — `food-dining` (feature tile) | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `hands-and-drums.webp` | 140 KB | category bento — `arts-culture` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `leather-and-denim.webp` | 131 KB | category bento — `fashion-apparel` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `cities/atlanta.webp` | 137 KB | city chapters (home) + `/cities` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `cities/houston.webp` | 143 KB | city chapters (home) + `/cities` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `cities/chicago.webp` | 142 KB | city chapters (home) + `/cities` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |

The last six are the PR #23 additions. They live in `public/images/cities/` rather
than `public/images/editorial/` where the path column says so; the other twelve are
all `editorial/`. Sizes `[Measured — ls, 2026-08-09]`.

**On the `[Unknown]` author.** Canva does not surface the individual contributor's
name on a Pro stock download, and the filenames here were assigned by us, not by
Canva — so the photographer is not recoverable from the files we hold. The
**licensor** is Canva, which is the party whose terms govern our use, and
attribution is not required, so nothing turns on the gap. It is marked `[Unknown]`
rather than left blank because that is the honest state, per
`.claude/rules/no-fabrication.md`.

**Confirmed: these are Canva stock, not Magic Media**
`[Decision — founder statement, 2026-08-09]`. The rows above stand as written, and
the consequence is that **restriction 2 below — no implied endorsement by
identifiable people — is in force**. It would have fallen away for AI-generated
content, where there is no model to release. It does not fall away here.

**"Unplaced — pool"** means the file is committed and optimized but rendered
nowhere. It is available for guides and BLACQLight once editorial content exists
— both tables are at **0 rows** `[Measured — psql prod, 2026-08-09]`.

---

## The six new frames — PR #23

**Status: ✅ resolved.** `[Decision — founder statement, 2026-08-09]` — *"they still
came from canva. All of them."* The six inherit the whole record above, including
all three restrictions. They are in the inventory table; this section stays for the
source-frame mapping and the rejection note below, which live nowhere else.

Six photographs were selected on 2026-08-09 — three city skylines and three
category frames — from two staging directories the founder assembled outside the
original pool: `public/images/city-images/` and `public/images/BL-image-sourcing/`.

| File | Size | Source frame | Where used |
|---|---|---|---|
| `cities/atlanta.webp` | 137 KB | `city-images/atl1.png` | City chapters (home) + `/cities` |
| `cities/houston.webp` | 143 KB | `city-images/hou2.png` | City chapters (home) + `/cities` |
| `cities/chicago.webp` | 142 KB | `city-images/chi1.png` | City chapters (home) + `/cities` |
| `editorial/bbq-plate.webp` | 137 KB | `BL-image-sourcing/food3.png` | Category bento — `food-dining` (feature tile) |
| `editorial/leather-and-denim.webp` | 131 KB | `BL-image-sourcing/fashion4.png` | Category bento — `fashion-apparel` |
| `editorial/hands-and-drums.webp` | 140 KB | `BL-image-sourcing/culture3.png` | Category bento — `arts-culture` |

Sizes are `[Measured — ls, 2026-08-09]`; every file is under the 150 KB budget
ticket 113 sets. The source PNGs are no longer in the repo — see
[The staging archive](#the-staging-archive).

**Restriction 2 has real teeth on this set.** All three category frames were chosen
to be **people-free** — a plate of food, a flat-lay of boots and denim, hands on
drums with no faces — so the identifiable-person restriction, which is now
confirmed to bind them, cannot actually bite. The three skylines contain no
identifiable people either. That is not luck: people-free frames are also the ones that survive a short
wide tile without decapitating anybody, so the crop constraint and the license
constraint select for the same photographs.

### Rejected: `chi2.png` — Cloud Gate

`city-images/chi2.png` is a photograph of **Cloud Gate** ("The Bean"), the sculpture
by **Anish Kapoor** in Millennium Park. It was the strongest Chicago frame on
composition and was **rejected on rights, not taste**.

Cloud Gate is a copyrighted sculpture, and its commercial photography rights have
been actively asserted — the artist has pursued commercial users of the work's
image. US architectural freedom-of-panorama does **not** extend to sculpture, so a
photograph of it used to promote a commercial platform is a different question from
a photograph of a skyline. `chi1.png` — an aerial of the Gold Coast and the
lakefront — carries no such encumbrance and was chosen instead.

Recorded here so nobody swaps it back in on the grounds that it is the better
picture. It is the better picture. `[Needs professional review]` if it is ever
genuinely wanted.

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
| 3 | **No use as a trademark or logo.** Licensed content may not be registered or used as a brand mark. | We may **not** build one of these into the BLACQList wordmark, favicon, app icon, or default site-wide OG image — a default OG image is close enough to a brand mark to stay clear of. Per-page editorial OG images are fine. | ✅ Held — brand marks are the five SVGs in `public/brand/`, all first-party. |

### The one frame depicting a minor

`soleil-kidswear.webp` shows a laughing child against a flat studio backdrop. It is licensed on the same terms as the other eleven, but it carries an extra placement rule that is ours, not Canva's.

[Decision — 2026-08-09] It appears on **`childcare-family` in the category bento and nowhere else on the site.** Not the triptych, not a hero, not an OG image, not a collection, not a marketing asset.

The reasoning: a child's likeness in a general brand slot invites the reading that the platform markets to or about children, which is a different product and a different regulatory posture (`data-privacy.md` flags anything touching under-18 users for COPPA). Confined to the one category the frame is literally about, it is descriptive rather than representative. Restriction 2 applies here with the same force as on the adult frames — it must never sit beside a named childcare business as that business's children.

Anyone adding a placement for this file needs a new decision, not a judgement call.

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
