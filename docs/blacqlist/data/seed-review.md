# Seed data — founder review

**Purpose.** Before the production seed, every listing must be confirmed **real, currently operating, genuinely Black-owned, and OK to be listed publicly.** The directory listings were researched from third-party sources (press roundups, directories, the businesses' own sites), so this is the human verification pass.

**How to use.**
1. Open `seed-review.csv` in Google Sheets (File → Import → Upload).
2. Work top-down — within each city, rows with **unsourced fields come first**, then the most-flagged. The entries whose facts are least established are at the top.
3. Use the **Verify (Google Maps)** link in each row to confirm the business exists and is open in one click.
4. For each row set **Keep / Edit / Remove** and add a note.
   - **Keep** means "I looked at the drafted values and they are right." On an `assumed-contact` row that is a confirmation, and it clears the block — so don't Keep a row you only skimmed.
   - **Edit** — put the corrected value in the note as `field: value` (e.g. `address_line_1: 4325 Degnan Blvd`). Only the fields you name are treated as sourced.
   - **Remove** — the business is closed, not real, or shouldn't be listed.
5. When done, the decisions drive `npx tsx scripts/apply-seed-review.ts`, which rewrites `scripts/data/listings-*.json` before the production seed (board card 093). Re-run `npx tsx scripts/build-seed-review.ts` any time to regenerate this sheet from the current data.

**Flag legend** (a row may carry more than one):
- `assumed-contact` — **the important one.** One or more fields on this row were drafted from recall rather than read off a source. The **Unsourced fields** column names which. These rows sort to the **top of each city**, ahead of every other flag, and the seed is hard-blocked until each one is decided. See the accuracy note below.
- `metro-area` — the listed city isn't the canonical city (e.g. a Decatur/East Point business tagged to Atlanta). Decide: keep under the metro, relabel, or remove.
- `no-website` — no website **or** Instagram to verify against. Confirm it exists and is current.
- `no-address` — no street address (often online-only). Fine for online brands; confirm it's not a closed storefront.
- `duplicate` — another listing **in the same city** has a near-identical name (after normalizing case/punctuation/suffixes). Check whether it's the same business entered twice, or two genuinely different businesses.

### How accurate are the unsourced fields?

Measured, not guessed. Twelve drafted addresses were checked against live sources on 2026-08-13 and **six were wrong** — but not evenly:

| Tier | Sampled | Wrong | How it fails |
|---|---|---|---|
| Rows already flagged uncertain | 6 | 4 (67%) | Wrong neighbourhood, wrong city, or a since-moved location |
| Random mid-tier rows | 6 | 2 (33%) | Street number drifts; the street and ZIP are right |

**Read that as: treat every `assumed-contact` address as unconfirmed, not as probably-fine.** A street number that is close but wrong drops a map pin on the wrong building, which is worse than no pin. Landmark businesses are the most reliable; the less press a business has, the more the drafted address drifts.

**Counts (generated from the current seed files):**

| City | Total | assumed-contact | metro-area | no-website/social | no-address | duplicate |
|---|---|---|---|---|---|---|
| Atlanta | 151 | 0 | 19 | 6 | 15 | 0 |
| Houston | 51 | 0 | 3 | 1 | 4 | 0 |
| Chicago | 52 | 0 | 0 | 2 | 5 | 0 |
| Los Angeles | 42 | 0 | 3 | 4 | 7 | 0 |
| Washington DC | 41 | 0 | 0 | 10 | 1 | 0 |
| New Orleans | 42 | 0 | 1 | 3 | 0 | 0 |

**Total listings:** 379 · **rows with at least one flag:** 78 · **rows with unsourced fields:** 0

## Category coverage (launch gate: ≥ 3 per city)

Categories below the threshold need more listings (or a decision to merge/drop the category) before launch. Each city is measured against **the categories that city actually uses** — not against the 22-category union across all six files, which would flag every category a city has simply chosen not to enter. A city with few categories can read clean here and still be too narrow, so check the "categories present" count as well as the thin list.

- **Atlanta** — 21 categories present; below 3: `automotive` (1), `education-tutoring` (1), `events-entertainment` (1), `nonprofits-community-orgs` (1), `home-living` (2), `real-estate` (2)
- **Houston** — 14 categories present; below 3: `arts-culture` (1), `construction-trades` (1), `events-entertainment` (1), `retail-gifts` (1), `technology` (1), `books-publishing` (2), `fashion-apparel` (2), `healthcare` (2)
- **Chicago** — 19 categories present; below 3: `construction-trades` (1), `education-tutoring` (1), `fashion-apparel` (1), `legal-financial` (1), `photography-videography` (1), `professional-services` (1), `real-estate` (1), `technology` (1), `creative-media` (2), `events-entertainment` (2), `home-living` (2)
- **Los Angeles** — 10 categories present; below 3: `creative-media` (1), `home-living` (1), `legal-financial` (1), `wellness-health` (1), `beauty-grooming` (2), `fashion-apparel` (2), `retail-gifts` (2)
- **Washington DC** — 8 categories present; below 3: `retail-gifts` (1), `books-publishing` (2), `events-entertainment` (2), `fashion-apparel` (2)
- **New Orleans** — 9 categories present; below 3: `education-tutoring` (1), `retail-gifts` (1), `spiritual-community` (1), `wellness-health` (1), `books-publishing` (2), `fashion-apparel` (2)

> The flags only surface rows that *need a closer look* — an unflagged row still needs a yes/no on "real, current, Black-owned, OK to list," it's just lower-risk. The sheet makes that judgment fast; the judgment itself is yours.
