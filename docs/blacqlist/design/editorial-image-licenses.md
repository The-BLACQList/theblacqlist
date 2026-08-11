# Editorial image licenses

**Status:** ✅ **Recorded.** All **twenty** photographs are cleared — the original
twelve, the six added on 2026-08-09 in PR #23, and the two added later the same day
to fill the last empty bento tiles.
**Last updated:** 2026-08-09

`.claude/rules/3d-assets.md` requires a recorded license per asset before it enters
the product: source, author, license name, and commercial-use confirmation.

**Source of record:** all twenty photographs were obtained through the founder's
**Canva Pro** subscription and are licensed under the **Canva Content License
Agreement (Pro content)** `[Decision — founder statement, 2026-08-09]`. The
statement was made twice: once about the original twelve, and again about the
staging-directory frames once they were selected — *"they still came from canva.
All of them."* The two later additions come out of the same staging directory and
are covered by the same statement.

That license permits commercial use without attribution, and it carries three
restrictions that bind how these files may be used here. They are written out in
[Canva Pro restrictions that bind us](#canva-pro-restrictions-that-bind-us) below —
read that section before placing any of these images on a new surface.

---

## The pool

**Twenty photographs**, from three selections.

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
`[Decision — founder statement, 2026-08-09]`.

**The two added after them** — `physician-portrait.webp` and `agency-desk.webp` —
came out of the same `BL-image-sourcing/` staging set, on the founder's later
instruction to fill the two photo-less bento tiles
`[Decision — founder, 2026-08-09: "I also want the two images back in the bento
area"]`. **`suit-and-ledger.webp` followed on 2026-08-10** from the same set, on
the founder's instruction to give `professional-services` its own frame
`[Decision — founder, 2026-08-10]`. Roughly seventeen frames in those directories
remain unselected and available; they are archived outside the repo (see below),
not deleted.

Re-run with `pnpm images:editorial` if the pool changes.

**Committed weight: 2.5 MB** `[Measured — du, 2026-08-10]` — `editorial/` 1.6 MB,
`cities/` 428 KB, `hero-bg.jpg` 450 KB. The six PR #23 frames cost ~830 KB; the
three bento-fill frames add 216 KB.

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

**Moved, not deleted — and the archive immediately earned its keep.** The two
remaining photo-less bento tiles, `healthcare` and `social-media-marketing`, were
filled later the same day from `BL-image-sourcing/health_professional2.png` and
`professional2.png`, both pulled straight out of the archive; `professional4.png`
followed the next day for `professional-services`. Roughly seventeen
unselected frames are still there. The `.gitignore` entries stay in place as a
standing guard in case a copy is dropped back into `public/` for another selection
pass.

---

## Inventory

All twenty share one provenance, so the license columns are uniform. They are
written per row anyway rather than collapsed into a note — `3d-assets.md` asks for
a record **per asset**, and a table that stays row-complete survives the pool being
split or added to later. That is exactly what happened, twice: the six PR #23 rows
and then the two bento rows both slotted in without reshaping the table.

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
| `physician-portrait.webp` | 74 KB | category bento — `healthcare` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `agency-desk.webp` | 69 KB | category bento — `social-media-marketing` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |
| `suit-and-ledger.webp` | 72 KB | category bento — `professional-services` | Canva Pro | Canva contributor — `[Unknown]`, see note | Canva Content License (Pro) | Yes, with restrictions below | No |

Rows 13–18 are the PR #23 additions and the last three are the bento fill. Only the
three `cities/` files live outside `public/images/editorial/`; the path column says
so where it applies. Sizes `[Measured — ls, 2026-08-09]`, except the last row
`[Measured — ls, 2026-08-10]`.

**All three bento-fill frames depict people** — a physician in a white coat, a
person working at a desk in an agency office, and a man in a suit reviewing
documents. Unlike the six PR #23 frames, which were deliberately people-free,
restriction 2 bites on these three. See
[Restriction 2 and the bento portraits](#restriction-2-and-the-bento-portraits).

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

## The two bento frames — `healthcare` and `social-media-marketing`

**Status: ✅ recorded.** Same Canva Pro provenance, same license, same three
restrictions `[Decision — founder statement, 2026-08-09]`.

These two tiles had been left on the `PHOTO_ABSENT` designed ground on the
`CATEGORY_PHOTOS` guard's own logic — *an unmatched photo is worse than an honest
designed tile*. The founder reversed that for these two specifically
`[Decision — founder, 2026-08-09: "I also want the two images back in the bento
area"]`, and the archive had matching frames, so the guard's condition was met
rather than overridden.

| File | Size | Source frame | Where used |
|---|---|---|---|
| `editorial/physician-portrait.webp` | 74 KB | `BL-image-sourcing/health_professional2.png` | Category bento — `healthcare` |
| `editorial/agency-desk.webp` | 69 KB | `BL-image-sourcing/professional2.png` | Category bento — `social-media-marketing` |

Sizes `[Measured — ls, 2026-08-09]`; both are well under the 150 KB budget ticket
113 sets. `agency-desk.webp` carries a `PHOTO_FOCAL` entry of `object-[50%_30%]`
to keep the subject's head inside the bento crop; `physician-portrait.webp` needs
none at the default.

With these two the category bento reached **9 of 9 photographic**, so
`PHOTO_ABSENT` renders nowhere on that grid today. It stays in `surfaces.ts`
because a new category, or a category whose frame is ever withdrawn, falls back to
it, and a fallback that only exists once it is needed is a fallback that does not
work.

Note what that sentence implies: the bento renders the **top nine categories by
live listing count**, so a frame added for a category outside the top nine is
mapped but not yet rendered. That is correct behaviour — the map is keyed on the
category slug, not on a grid position, and it starts working the day the category
ranks. `suit-and-ledger` is in exactly that position; see the section below.

---

## The `professional-services` frame — `suit-and-ledger`

**Status: ✅ recorded.** Same Canva Pro provenance, same license, same three
restrictions `[Decision — founder statement, 2026-08-09]`, added on the founder's
instruction `[Decision — founder, 2026-08-10: "add the image for Professional
Services in the bento area"]`.

| File | Size | Source frame | Where used |
|---|---|---|---|
| `editorial/suit-and-ledger.webp` | 72 KB | `BL-image-sourcing/professional4.png` | Category bento — `professional-services` |

Size `[Measured — ls, 2026-08-10]`; 1600×1067, WebP q82, well under the 150 KB
budget ticket 113 sets.

**It does not render yet, and that is expected.** The bento takes the top nine
categories by published-listing count, and `professional-services` currently sits
tenth `[Observed — local dev render, 2026-08-10]`:

| Rank | Category | Published listings |
|---|---|---|
| 1 | `food-dining` | 84 |
| 2 | `beauty-grooming` | 25 |
| 3 | `wellness-health` | 21 |
| 4 | `legal-financial` | 16 |
| 5 | `fashion-apparel` | 15 |
| 6 | `healthcare` | 11 |
| 7 | `arts-culture` | 11 |
| 8 | `social-media-marketing` | 10 |
| 9 | `retail-gifts` | 9 |
| **10** | **`professional-services`** | **7** |

Two listings short. The frame is mapped, committed, and inert until the category
ranks — at which point it appears with no further change. The category's only
current appearance on the homepage is the hero chip labelled "Professionals",
which carries no photograph.

Counts are from the local dev render against the configured Supabase project;
production counts may differ, and the rank is what matters, not the absolute
numbers.

**Why this frame and not the other four.** The archive holds five `professional*`
frames, all 1920×1280. Four were rejected because they read as a *specific*
profession rather than the catch-all this category has to cover:

| Frame | What it shows | Verdict |
|---|---|---|
| `professional1.png` | A dentist and a patient, blue gloves, hand mirror | Reads healthcare — already held by `physician-portrait` |
| `professional2.png` | Navy suit against a wall of bound volumes | **Already used** as `agency-desk` |
| `professional3.png` | Pinstripe suit beside a FOR SALE sign | Reads real estate, not the catch-all |
| `professional4.png` | Tan suit at a glass desk, pen over a bound document stack | **Selected** |
| `professional5.png` | The same shoot as 4, one step wider | Passed over — see below |

4 and 5 are the same subject in the same office minutes apart. The tighter of the
two was taken on crop grounds: every bento tile is far taller than the source's
3:2, so `object-cover` scales by height and discards **width**, and a subject that
fills more of the frame is the one that survives it.

**Reusing `melanin-law-group.webp` for this slug was never an option.** The
`CATEGORY_PHOTOS` docblock rules it out in its own words — two slugs pointing at
one file duplicates the frame in a single grid the day both categories rank, and
`legal-financial` and `professional-services` are exactly the pair most likely to
rank together.

**It is a bright frame**, which puts it in the `physician-portrait` hazard class —
blown-out windows behind the subject, a glass desk under him, and the caption
band's `text-xs` light-gold count line owes 4.5:1 as small text. It was measured
before it shipped rather than after; the figure is in `PHOTO_PLATE_TINT`'s note in
`lib/design/surfaces.ts`.

Restriction 2 is live on it — see
[Restriction 2 and the bento portraits](#restriction-2-and-the-bento-portraits),
which carries one extra condition specific to this frame.

### Restriction 2 and the bento portraits

`physician-portrait.webp` shows a physician; `agency-desk.webp` shows a person at
a desk; `suit-and-ledger.webp` shows a man in a suit reviewing documents. All
three are identifiable, so **restriction 2 — no implied endorsement by
recognizable individuals — is live on these three in a way it was not on the six
people-free PR #23 frames.**

What that rules out here, concretely:

- None may be placed beside a **named** business, practice, or agency in a way
  that reads as that business's staff, owner, or clinician. This is the same rule
  [Naming caution](#naming-caution) already imposes for brand reasons; the license
  reaches it independently.
- A category tile is a safe placement precisely because it names a **category**,
  not a business — "Healthcare · 11 businesses" makes no claim about who the person
  is. Moving any of these files to a surface that names an entity is a new
  decision, not a reuse.
- None belongs in a sensitive context — the healthcare frame in particular must
  not illustrate anything implying a medical condition, outcome, or claim.
- `suit-and-ledger.webp` carries one extra edge. It reads as an accountant or
  consultant at work, so it must not illustrate anything that would imply the
  person gives **financial, tax, or legal advice on our behalf**, and it must not
  appear next to a pricing, subscription, or money-movement surface where that
  reading is available. A category tile is not that surface.

Anyone adding a second placement for any of the three needs a recorded decision, on
the same footing as `soleil-kidswear.webp` below.

---

## Canva Pro restrictions that bind us

The Canva Content License is permissive on the two things we needed — **commercial
use is allowed and attribution is not required** — and restrictive on three things
that are live concerns for a business directory. These are conditions of the
license, not style preferences.

| # | Restriction | What it rules out here | Status |
|---|---|---|---|
| 1 | **No standalone redistribution.** The licensed file may be used *within* a design or product; it may not be offered as the file itself, resold, or made available for others to download as stock. | We may render these on pages. We may **not** ever hand one to a business owner as a cover image, seed one into `listings.cover_image_path`, or expose the pool through an "pick an image" picker in the owner dashboard. | ✅ Held — the owner-upload flywheel (Track 4) ships owners an *upload* path, never a library. |
| 2 | **No implied endorsement by identifiable people.** Content depicting recognizable individuals may not be used to suggest that person endorses a product, business, or viewpoint, and may not be used in a sensitive context. | We may **not** place a photo containing a person beside a named business in a way that reads as *that business's* staff, owner, or customers. | ✅ Held — and this is the second, independent reason for the rule already stated under [Naming caution](#naming-caution). The brand reason and the license reason land in the same place. The three frames where this restriction actually bites are the bento portraits — see [Restriction 2 and the bento portraits](#restriction-2-and-the-bento-portraits). |
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
   caption, no `title` attribute derived from the filename. Every editorial frame
   is placed with `alt=""` — `PhotoPanelGround` defaults to it — because the
   adjacent heading supplies the context and the photo is editorial, not
   documentary (`photographic-style-direction.md` §3). The city skylines are the
   one exception and pass an explicit `alt`, because there the photograph is
   informative and its subject is a real named place.

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
literal 16:9. All twelve original sources are 3:2, which is already the house ratio:
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
