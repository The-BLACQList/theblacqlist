# Ticket 072: Vendor storefront page — /[city-slug]/vendor/[listing-slug]

---

## Status

Draft

## Phase

Phase 13: Marketplace Foundation

## Priority

P3 — Low

## Estimate

L (4–8h)

## Feature Area

Marketplace

---

## Context

The vendor storefront is the public-facing BLACQList Page for `listing_type = 'vendor'` listings. It extends the base BLACQList Page (established by Tickets 020–024) with a products catalog section and vendor-specific details (fulfillment methods, ships nationally, minimum order). The vendor storefront IS the BLACQList Page for vendor listings — it shares the same route pattern `/[city-slug]/vendor/[listing-slug]` and inherits all existing page sections: hero, about, hours, contact, social, gallery, and services.

This ticket adds the marketplace-specific sections on top of the inherited base. The product grid fetches from `GET /api/listings/[id]/products` (Ticket 071). ISR 1h with `generateStaticParams` for all vendor slugs.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Vendor Storefront; `docs/blacqlist/architecture/api-contract.md` § Marketplace (Part C); `docs/blacqlist/architecture/architecture-decisions.md` ADR-010 (URL structure).

---

## User Story

As a visitor discovering a vendor on The BLACQList, I want to see the vendor's full profile and product catalog on a single page, so that I can assess the business and explore what they sell without leaving the platform.

---

## Scope

**In scope:**

- `app/[city-slug]/vendor/[listing-slug]/page.tsx` — Server Component; ISR 1h; `generateStaticParams` for all vendor listings
- `generateMetadata` for vendor pages: title `[Business Name] — [City] | The BLACQList`, description from `listing_details_business.description`, OG image from `cover_image_path`
- All base BLACQList Page sections (re-used from Tickets 021–024): hero (name, tagline, logo, cover image), about (description, founded year), hours, contact (phone, email, address), social links, gallery, services, sticky CTA bar, save button, share button
- **Vendor-specific section — Fulfillment Info:** rendered below the about section; fields from `listing_details_vendor` (Ticket 070): `fulfillment_methods` (array — e.g., "Shipping", "Local pickup", "Delivery"), `ships_nationally` (boolean — renders "Ships nationally" badge if true), `minimum_order_cents` (renders formatted currency if set, e.g., "Minimum order: $25")
- **Product Catalog section:** rendered below fulfillment info; section heading "Products"; product grid (2 columns mobile, 3 columns desktop); product cards (image, name, price formatted as USD, short description truncated at 80 chars, CTA button)
- Product CTA button: label is "Inquire" by default; if `listing_details_vendor.product_cta_label` is set, use that value
- Empty state for products: "No products listed yet. Check back soon." — no action required
- Loading state: skeleton grid (6 placeholder cards) shown while product data fetches
- Error state: "Couldn't load products." with a "Try again" button that re-fetches
- `generateStaticParams`: query `listings WHERE listing_type = 'vendor' AND status = 'published'`; return `[{ 'city-slug': city.slug, 'listing-slug': listing.slug }]`
- ISR revalidation: `revalidateTag(\`vendor-${listingId}\`)`is called by Ticket 073 mutations — this page uses`export const revalidate = 3600` at the route level

**Out of scope:**

- Product detail sub-pages (`/vendor/[slug]/products/[product-slug]`) — V2 per ADR-010
- Vendor cart / checkout — V2 (Stripe Connect not available at V1)
- Product inventory management UI — Ticket 073
- Admin product moderation — Ticket 074
- Product reviews — deferred

---

## Dependencies

| Dependency                                                | Type            | Status      |
| --------------------------------------------------------- | --------------- | ----------- |
| Ticket 071 — Products table and API endpoints             | Blocking ticket | Not started |
| Ticket 070 — Vendor listing extension table               | Blocking ticket | Not started |
| Ticket 020 — BLACQList Page data layer and route          | Blocking ticket | Not started |
| Ticket 021 — Hero, about, hours, contact, social sections | Blocking ticket | Not started |
| Ticket 022 — Gallery, services, CTA section               | Blocking ticket | Not started |
| Ticket 023 — SEO, OG image, JSON-LD                       | Blocking ticket | Not started |
| Ticket 024 — Save, share, analytics, sticky CTA           | Soft dependency | Not started |

---

## UX Notes

- **Screen:** Vendor Storefront — `docs/blacqlist/ux/mvp-screen-map.md` § Vendor Storefront
- **Route:** `/[city-slug]/vendor/[listing-slug]`
- **Entry points:** City page featured listings, search results, direct URL, homepage vendor cards
- **Exit points:** Product CTA button → vendor's external site or contact form (per `listing_details_vendor.product_cta_url`); sticky CTA bar → vendor's primary CTA; social links

**Page section order (top to bottom):**

1. Hero (cover image + logo + name + tagline + trust badge)
2. About + Fulfillment Info (side by side on desktop, stacked on mobile)
3. Hours + Contact (same row as base page)
4. Gallery (if images present)
5. **Product Catalog** (new section — full width below gallery)
6. Services (if applicable)
7. Social links
8. Sticky CTA bar (fixed bottom on mobile, inline on desktop)

**Product card layout (375px — 2 columns):**

```
┌──────────┐ ┌──────────┐
│ [image]  │ │ [image]  │
│ Name     │ │ Name     │
│ $XX.XX   │ │ $XX.XX   │
│ [Inquire]│ │ [Inquire]│
└──────────┘ └──────────┘
```

**Loading state:** 6 skeleton product cards in the same 2/3-column grid.

**Empty state:** Center-aligned in the product catalog section: "No products listed yet. Check back soon." — no icon or CTA needed.

**Mobile behavior:**

- Product grid: `grid-cols-2` at all mobile sizes; `grid-cols-3` at `lg:`
- Product card image: `aspect-square`, `object-cover`
- Fulfillment info: rendered as a simple tag/badge row (e.g., "Shipping", "Local pickup") — wraps to second line if needed
- Sticky CTA bar behavior is the same as base BLACQList Page

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Colors:** Amber Gold `#E2A428` for section headers and CTA buttons; Brand Black `#000000` for card name text; Charcoal `#595758` for price and description text; Cream `#FCFAF4` for page background
- **Typography:** Glacial Indifference Bold for section heading "Products"; Quicksand Bold Italic for product CTA button label; Lato Regular for product name and price
- **Product image container:** `aspect-square rounded-lg overflow-hidden bg-[#E9E9F7]` (Pale Lavender as placeholder background)
- **Product card:** `flex flex-col gap-2 p-3 rounded-lg border border-gray-100 bg-white` — minimal, clean
- **Price formatting:** `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price_cents / 100)`
- **Fulfillment badges:** `Badge` (shadcn/ui, `variant="outline"`) — one badge per fulfillment method; "Ships nationally" uses a filled Amber Gold badge
- **Minimum order:** Rendered as `text-sm text-[#595758]` below the fulfillment badges: "Minimum order: $XX"
- **Components to use:** shadcn/ui `Card`, `Badge`, `Button`, `Skeleton`; existing base-page section components from Tickets 021–022
- **States to implement:** Loading (skeleton grid), Empty (no products text), Error (with retry), Success (product grid)
- **`generateStaticParams` fallback:** `dynamicParams = true` so that new vendor slugs added after the last build are rendered on-demand then cached

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `listings`, `listing_details_business`, `listing_details_vendor`, `products`, `media_attachments`
- **Entities involved:** All of the above
- **Operations:** SELECT only (read-heavy ISR page)
- **Key queries:**
  1. Listing + details: same query as base BLACQList Page (reused from Ticket 020 data layer) — confirm it JOINs `listing_details_vendor` for vendor-type listings
  2. Products: `GET /api/listings/[id]/products` (Ticket 071 endpoint) — fetched in the page Server Component
- **Vendor-specific fields from `listing_details_vendor`:** `fulfillment_methods` (array), `ships_nationally` (boolean), `minimum_order_cents` (integer, nullable), `product_cta_label` (text, nullable), `product_cta_url` (text, nullable)
- **RLS:** `anon` SELECT on published listings; product endpoint is also public — no auth required for this page
- **Migration required:** No — relies on Tickets 070 and 071 migrations
- **ISR tag:** Page uses `export const revalidate = 3600`; vendor product mutations in Ticket 073 call `revalidateTag(\`vendor-${listingId}\`)` — ensure the page's fetch calls include the tag: `fetch(..., { next: { tags: [\`vendor-${listingId}\`] } })`

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` § Marketplace (Part C)

**Endpoints consumed:**

- `GET /api/listings/[id]` (or equivalent data layer from Ticket 020) — base listing data including `listing_details_vendor` join
- `GET /api/listings/[id]/products` — product catalog; fetched with `{ next: { tags: [\`vendor-${listingId}\`], revalidate: 3600 } }`

**No auth required.** Both endpoints are public.

**Error handling:**

- If listing fetch fails or listing is not found: call Next.js `notFound()` — renders the branded 404 page (Ticket 019)
- If products fetch fails: render the error state in the Product Catalog section only; do not fail the entire page
- If products fetch returns empty array: render the empty state

---

## Implementation Notes

**Files to create:**

- `app/[city-slug]/vendor/[listing-slug]/page.tsx` — vendor storefront page; Server Component; ISR; `generateStaticParams` + `generateMetadata`
- `components/marketplace/ProductCatalogSection.tsx` — product grid section; receives `products: Product[]` prop; handles empty and error sub-states
- `components/marketplace/ProductCard.tsx` — individual product card: image, name, price, CTA button
- `components/marketplace/ProductCardSkeleton.tsx` — skeleton card for loading state
- `components/marketplace/FulfillmentInfo.tsx` — renders fulfillment badges, "ships nationally" badge, minimum order text

**Files to modify:**

- `lib/data/listings.ts` (or equivalent data layer file from Ticket 020) — ensure `getListingBySlug()` JOINs `listing_details_vendor` when `listing_type = 'vendor'`

**Key patterns:**

- Wrap `ProductCatalogSection` in its own `<Suspense>` boundary with `<ProductCatalogSkeleton>` as fallback, so the rest of the page renders immediately while products load
- Fetch the products inside `ProductCatalogSection` using a Server Component (not a Client Component) to keep the product data server-rendered
- Generate public URLs for product images at render time: `supabase.storage.from('listing-media').getPublicUrl(image.path)` — never store URLs in the DB or pass them from the API
- Format price: divide `price_cents` by 100 and format with `Intl.NumberFormat`; handle `price_cents = 0` as "Free"
- Re-use all existing base section components from Tickets 021–022 — do not rebuild them

**Do not:**

- Build a cart or checkout flow — this is display-only at V1
- Fetch products client-side on mount — use Server Component data fetching
- Persist CDN URLs — generate at render time from paths

---

## Acceptance Criteria

- [ ] Given a valid published vendor listing, navigating to `/[city-slug]/vendor/[listing-slug]` renders all base page sections (hero, about, hours, contact, gallery, services, sticky CTA) plus the vendor-specific sections
- [ ] Fulfillment Info section renders fulfillment method badges; "Ships nationally" Amber Gold badge renders when `ships_nationally = true`; "Minimum order: $XX" renders when `minimum_order_cents` is set
- [ ] Product Catalog section renders a grid of product cards with image, name, formatted price, and CTA button
- [ ] Given a vendor with `price_cents = 0`, the product card displays "Free" rather than "$0.00"
- [ ] Given a vendor with no active products, the Product Catalog section renders the empty state: "No products listed yet. Check back soon."
- [ ] Given the products API fails, the Product Catalog section renders the error state with a "Try again" button; the rest of the page renders normally
- [ ] Product cards display a loading skeleton grid (6 cards) while products are fetching
- [ ] `generateMetadata` returns the correct `title`, `description`, and OG image for the vendor listing
- [ ] `generateStaticParams` returns slugs for all published vendor listings
- [ ] Mobile at 375px: product grid renders as 2 columns; fulfillment badges wrap correctly; sticky CTA bar is visible
- [ ] Desktop: product grid renders as 3 columns
- [ ] Navigating to `/[city-slug]/vendor/[non-existent-slug]` renders the branded 404 page
- [ ] The page is ISR-cached; `export const revalidate = 3600` is set

---

## Failure States

| Failure                | Condition                                                                 | User sees                                                                    | Recovery                              |
| ---------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| Listing not found      | Slug does not exist or listing is not published                           | Branded 404 page (Ticket 019)                                                | Navigate back                         |
| Products API fails     | `GET /api/listings/[id]/products` returns error                           | Product Catalog section shows "Couldn't load products." + "Try again" button | Retry re-fetches the products section |
| No products            | Vendor has no active products                                             | "No products listed yet. Check back soon."                                   | No action needed                      |
| Product image missing  | Storage path exists but file deleted from bucket                          | Broken image; Pale Lavender placeholder background shows                     | No action (display-only)              |
| Vendor details missing | `listing_details_vendor` row not found (shouldn't happen post-Ticket 070) | Page renders without vendor section; no error thrown                         | N/A                                   |

---

## Edge Cases

- Vendor listing with `ships_nationally = false` and no `fulfillment_methods` — Fulfillment Info section is omitted entirely (do not render an empty section)
- Vendor listing with `minimum_order_cents = 0` — render "No minimum order" rather than "Minimum order: $0"
- Product with no images (empty `images` array) — render the Pale Lavender placeholder square; do not break layout
- Product `description` exceeds 80 characters — truncate to 80 chars with ellipsis in the card; full description available on future product detail page (V2)
- Vendor with 100 products (max per Ticket 073) — product grid paginates at 20; first page loads; "Load more" button (optional enhancement; if not built in this ticket, load all 100 in a single request with `limit=100`)
- `product_cta_label` is null — default CTA button label is "Inquire"
- `product_cta_url` is null — CTA button is disabled with tooltip "Contact this vendor to inquire"

---

## Accessibility Notes

- [ ] Product Catalog section heading `<h2>Products</h2>` — semantic heading hierarchy below the page `<h1>`
- [ ] Each product card has an accessible name: `aria-label="[Product name] — $[price]"` on the card container, or via heading structure within the card
- [ ] CTA buttons have descriptive labels: "Inquire about [product name]" (use `aria-label` if the visible label is just "Inquire")
- [ ] Loading skeleton cards: `aria-busy="true"` on the product grid container while fetching
- [ ] Fulfillment badges: role is decorative; plain text is sufficient
- [ ] "Ships nationally" badge: text label present — do not rely on color alone
- [ ] Error state "Try again" button is keyboard-reachable and has a descriptive label
- [ ] Product images: `alt` text set to product name; if no image, container has `aria-hidden="true"`

---

## QA Test Cases

| #    | Scenario                | Role      | Steps                                                                   | Expected result                                                                              |
| ---- | ----------------------- | --------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| QA-1 | Full vendor page        | Anonymous | Navigate to `/[city-slug]/vendor/[published-vendor-slug]` with products | All base sections render; Fulfillment Info renders; Product grid renders with correct prices |
| QA-2 | No products empty state | Anonymous | Navigate to vendor with no active products                              | Product Catalog section shows "No products listed yet. Check back soon."                     |
| QA-3 | Products API error      | Anonymous | Force API failure for product fetch                                     | Error state renders in Product Catalog; rest of page (hero, about, etc.) renders normally    |
| QA-4 | Mobile product grid     | Anonymous | Open vendor page at 375px                                               | Product grid is 2 columns; fulfillment badges wrap; sticky CTA bar is visible                |
| QA-5 | 404 for unknown slug    | Anonymous | Navigate to `/[city-slug]/vendor/does-not-exist`                        | Branded 404 page renders                                                                     |
| QA-6 | Ships nationally badge  | Anonymous | Open vendor with `ships_nationally = true`                              | Amber Gold "Ships nationally" badge visible in Fulfillment Info section                      |

---

## Security Notes

- Page is fully public — no auth required, no user-specific data rendered
- Do not render vendor owner email or phone number without checking `listing_details_business.show_contact` flag (inherited behavior from base page — confirm with Ticket 021 implementation)
- No mutations on this page — no CSRF surface

---

## Completion Checklist

- [ ] `app/[city-slug]/vendor/[listing-slug]/page.tsx` created with `generateStaticParams` and `generateMetadata`
- [ ] All base page sections render correctly for vendor listing type
- [ ] `FulfillmentInfo` component renders ships_nationally, fulfillment methods, minimum order
- [ ] `ProductCatalogSection` renders product grid, empty state, error state, loading skeleton
- [ ] `ProductCard` renders image (or placeholder), name, price, CTA button
- [ ] Price formatting: `price_cents = 0` renders "Free"
- [ ] `product_cta_label` null defaults to "Inquire"; `product_cta_url` null disables the button
- [ ] ISR `revalidate = 3600` set; product fetch tagged with `vendor-${listingId}`
- [ ] `generateStaticParams` returns all published vendor slugs
- [ ] All acceptance criteria verified
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] Mobile tested at 375px — 2-column grid, sticky CTA bar
- [ ] Keyboard navigation tested on product cards and CTA buttons
- [ ] Accessibility: headings, aria-labels, aria-busy on loading state
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
