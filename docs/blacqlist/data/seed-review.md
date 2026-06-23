# Seed data — founder review

**Purpose.** Before the production seed, every listing must be confirmed **real, currently operating, genuinely Black-owned, and OK to be listed publicly.** The directory listings were researched from third-party sources (press roundups, directories, the businesses' own sites), so this is the human verification pass.

**How to use.**
1. Open `seed-review.csv` in Google Sheets (File → Import → Upload).
2. Work top-down — rows are **sorted with the most-flagged first** within each city, so the riskiest entries are at the top.
3. Use the **Verify (Google Maps)** link in each row to confirm the business exists and is open in one click.
4. For each row set **Keep / Edit / Remove** and add a note.
5. When done, the **Remove** + **Edit** rows drive a cleanup pass on `scripts/data/listings-*.json` before the production seed (board card 093). Re-run `npx tsx scripts/build-seed-review.ts` any time to regenerate this sheet from the current data.

**Flag legend** (a row may carry more than one):
- `metro-area` — the listed city isn't the canonical city (e.g. a Decatur/East Point business tagged to Atlanta). Decide: keep under the metro, relabel, or remove.
- `no-website` — no website **or** Instagram to verify against. Confirm it exists and is current.
- `no-address` — no street address (often online-only). Fine for online brands; confirm it's not a closed storefront.
- `duplicate` — another listing **in the same city** has a near-identical name (after normalizing case/punctuation/suffixes). Check whether it's the same business entered twice, or two genuinely different businesses.

**Counts (generated from the current seed files):**

| City | Total | metro-area | no-website/social | no-address | duplicate |
|---|---|---|---|---|---|
| Atlanta | 151 | 19 | 6 | 15 | 0 |
| Houston | 51 | 3 | 1 | 4 | 0 |
| Chicago | 51 | 1 | 1 | 5 | 0 |

**Total listings:** 253 · **rows with at least one flag:** 54

## Category coverage (launch gate: ≥ 3 per city)

Categories below the threshold need more listings (or a decision to merge/drop the category) before launch. Coverage is measured against the **21 categories observed in the seed data** — a category present in no city at all won't appear here, so cross-check against the full category taxonomy when topping up.

- **Atlanta** — below 3: `automotive` (1), `education-tutoring` (1), `events-entertainment` (1), `nonprofits-community-orgs` (1), `home-living` (2), `real-estate` (2)
- **Houston** — below 3: `automotive` (0), `creative-media` (0), `education-tutoring` (0), `nonprofits-community-orgs` (0), `photography-videography` (0), `professional-services` (0), `real-estate` (0), `arts-culture` (1), `construction-trades` (1), `events-entertainment` (1), `retail-gifts` (1), `technology` (1), `books-publishing` (2), `fashion-apparel` (2), `healthcare` (2)
- **Chicago** — below 3: `automotive` (0), `nonprofits-community-orgs` (0), `construction-trades` (1), `education-tutoring` (1), `fashion-apparel` (1), `legal-financial` (1), `photography-videography` (1), `professional-services` (1), `real-estate` (1), `technology` (1), `creative-media` (2), `events-entertainment` (2), `home-living` (2)

> The flags only surface rows that *need a closer look* — an unflagged row still needs a yes/no on "real, current, Black-owned, OK to list," it's just lower-risk. The sheet makes that judgment fast; the judgment itself is yours.
