# Editorial image licenses

**Status:** ⛔ **Incomplete — blocks merge of the image PR.**
**Last updated:** 2026-08-09

`.claude/rules/3d-assets.md` requires a recorded license per asset before it enters
the product: source, author, license name, and commercial-use confirmation. The
founder's note that these are *"stock images"* establishes that they are usable;
it is not that record. **Fill the blank cells below before this PR merges.**

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

Fill **Source**, **Author / rights holder**, **License**, and **Commercial use**.
`Where used` and `Size` are already measured — leave them.

| File | Size | Where used | Source | Author / rights holder | License | Commercial use | Attribution required |
|---|---|---|---|---|---|---|---|
| `afrofuturist-bookshop.webp` | 110 KB | `/about` hero | | | | | |
| `sable-fitness-collective.webp` | 95 KB | `/about` pull band | | | | | |
| `asha-osei-photography.webp` | 104 KB | unplaced — pool | | | | | |
| `calabash-candles.webp` | 53 KB | unplaced — pool | | | | | |
| `crown-and-coil-studio.webp` | 83 KB | unplaced — pool | | | | | |
| `diaspora-creative-agency.webp` | 80 KB | unplaced — pool | | | | | |
| `melanin-law-group.webp` | 40 KB | unplaced — pool | | | | | |
| `peach-and-rye-kitchen.webp` | 88 KB | unplaced — pool | | | | | |
| `rooted-tech-solutions.webp` | 96 KB | unplaced — pool | | | | | |
| `soleil-kidswear.webp` | 37 KB | unplaced — pool | | | | | |
| `ujima-construction.webp` | 83 KB | unplaced — pool | | | | | |
| `zinga-interior-design.webp` | 147 KB | unplaced — pool | | | | | |

**"Unplaced — pool"** means the file is committed and optimized but rendered
nowhere. It is available for guides and BLACQLight once editorial content exists
— both tables are at **0 rows** `[Measured — psql prod, 2026-08-09]`.

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
   F-1 tile instead.
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
