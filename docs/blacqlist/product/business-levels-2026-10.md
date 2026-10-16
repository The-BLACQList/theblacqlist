# Business levels: Growers, Makers, Suppliers, Local businesses

**Audience:** founder, and whoever builds on this next (The Collective team included).
**Status:** draft, 2026-10-16. The alignment table below needs founder sign-off before the migration runs on staging.
**Ticket branch:** `feat/business-levels`

---

## Why

Shoppers can already filter by what a business is (category) and where it works (storefront, online, mobile). They can't filter by where it sits in the supply chain. We want that ahead of The Collective, which maps how money moves between farms, makers, suppliers and the shops people walk into.

The Collective docs already define these levels (flow map vision §1, workshop round 14). This feature puts the same levels on every listing now, so the filter works today and The Collective reads the same columns later.

## The four levels

| Key | Filter label | Card pill | What it means |
|---|---|---|---|
| `grower` | Growers & raw goods | Grower | You grow, raise or harvest the raw material: farms, gardens, ranches, fisheries. |
| `maker` | Makers | Maker | You make the product yourself: food producers, artisans, designers who produce their own line. |
| `supplier` | Suppliers | Supplier | You sell to other businesses: wholesale, distribution, supplies, equipment. |
| `local` | Local businesses | (none) | You serve shoppers directly: shops, restaurants, salons, services. Online shops count. This is the default and goes unsaid. |

### Rules

- Every listing has **one main level** and can add **extras**. A bakery that also wholesales is `local` with `supplier` as an extra. The filter matches either.
- Levels are a **separate filter**, not new categories. The category tree stays as it is.
- Each category sets a **default level** and the **levels it allows**. Owners only see the level question when their category allows more than one.
- Cards show a quiet pill only for Grower, Maker or Supplier. Local goes unsaid, the same rule as Black-Owned.
- Creators, events and jobs keep `local` and never see the question in practice, since their categories allow `local` only.

## Category alignment (needs sign-off)

A child category inherits its parent's allowed levels and default unless it's listed under "Child overrides".

| Parent category | Allowed levels | Default | Child overrides |
|---|---|---|---|
| Agriculture & Sustainability | grower, maker, supplier, local | local | Farms & Farm Stands → **grower**; Urban Farming & Community Gardens → **grower**; Organic & Natural Products → **maker** |
| Food & Dining | grower, maker, supplier, local | local | none |
| Fashion & Apparel | maker, supplier, local | local | none |
| Home & Living | maker, supplier, local | local | none |
| Retail & Gifts | maker, supplier, local | local | Handmade & Artisan Goods → **maker**; Candles & Home Fragrance → **maker** |
| Beauty & Grooming | maker, supplier, local | local | none |
| Wellness & Health | maker, supplier, local | local | none |
| Books & Publishing | maker, supplier, local | local | none |
| Arts & Culture | maker, supplier, local | local | none |
| Construction & Trades | maker, supplier, local | local | Carpentry & Woodworking → **maker** |
| Automotive | supplier, local | local | none |
| Pet Services | supplier, local | local | none |
| Events & Entertainment | supplier, local | local | none |
| Technology | supplier, local | local | none |
| Healthcare | supplier, local | local | none |
| Professional Services | local | local | none |
| Legal & Financial | local | local | none |
| Education & Tutoring | local | local | none |
| Childcare & Family | local | local | none |
| Spiritual & Community | local | local | none |
| Staffing & Workforce | local | local | none |
| Social Media & Marketing | local | local | none |
| Photography & Videography | local | local | none |
| Creative & Media | local | local | none |
| Travel & Transportation | local | local | none |
| Creators & Influencers | local | local | none |

A category added later (by admin or migration) starts as `local` only, allowing `local`. Change it in Supabase Studio.

## What it looks like

- **Discover filter:** a "Level" section right under Type, outside "More filters". All four levels always show with counts, including 0. Picking more than one matches any of them. URL: `/discover?level=supplier,maker`.
- **Empty result:** when a level filter returns nothing: "No suppliers listed yet. Know one? Add them so shoppers can find them." with "Add a business" and "Browse every business".
- **A bad level in the URL** (`?level=suplier`) comes back empty, never as the whole directory. The search API answers 400.
- **Cards and page hero:** "Grower", "Maker" or "Supplier" as a quiet outline pill after the category chip.
- **Business page:** extras show as "Also: Supplier".
- **Add a business:** a "What's your main role?" step right after the category step, with the allowed levels as cards and the default picked. Skipped (and left out of "Step x of y") when the category allows one level. The server checks the pick and falls back to the category default, so it never blocks a new page.
- **Finish / edit page:** a "Your role" section with the main level and extras, shown only when the category allows more than one level. It does not count against the plan's attribute limit.

## Data

- `categories.default_level`, `categories.allowed_levels`
- `listings.primary_level`, `listings.extra_levels`
- A trigger fills `primary_level` from the category when an insert leaves it empty, so imports and seed scripts need no changes.
- Both search functions take `p_levels text[]`. `facet_counts` always returns all four `level` rows (zeros included), counting a listing once per level it has. That lets the sidebar tell a real 0 from a database that predates the migration.
- A level filter is a deep filter: if the database can't apply it, the page says "filters unavailable" rather than retrying without it.
- Level columns are never part of the main listing or category selects. They are read on their own (`lib/listings/levelRows.ts`) and fail soft, so a database without the migration still shows every business, just with no pills, no Level section and no role step.
- Migration: `supabase/migrations/20261017000000_business_levels.sql` (GATE-DATA: staging, then prod before merge).

## Out of scope

- Supplier relationships and confirmed links between businesses.
- B2B matching and procurement.
- The Collective map reading the levels.
- Per-sector words ("Food suppliers").
- Pricing changes.

## Open items

1. **Sign off the alignment table** above, in particular:
   - Should Travel & Transportation allow `supplier` (Freight & Logistics sells to businesses)?
   - Should Plant Shops & Nurseries default to `grower`?
   - Should Food & Dining's Bakeries default to `maker`? Today it stays `local` with maker allowed.
2. Existing listings all get their category's default. Owners of handmade, candle, carpentry, farm and organic-products pages will see a pill appear. Do we tell them?
3. Admin edits go through Supabase Studio for now. An admin control can come later if needed.
