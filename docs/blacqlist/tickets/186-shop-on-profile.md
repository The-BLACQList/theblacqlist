# 186: The business's marketplace items on its own page ("Shop")

**Status:** Planned — from the 184 plan, founder 2026-11-13. Not started. Own branch and draft PR off `origin/main` once 184 has merged; **no merge before Wed 18 Nov 2026** (launch merge freeze).
**Follows:** 184 (`EntityShopSection`, `entity.shop`), marketplace (`/vendors/[slug]`)
**Area:** business pages, marketplace
**Gates:** none for the code. The section is behind `canAccess(tier, 'storefront')` and the `marketplaceOpen` flag (plus `growthIsOpen()` from `lib/marketplace/entitlements.ts` if that still applies), so it shows nowhere until the flag is on.

## Why

Products and services live only at `/vendors/[slug]`. A café with merch or a studio with prints has a shop the profile never mentions.

## What changes

- `lib/marketplace/profileShop.ts` (server-only), modelled on the vendor page's service-client read: active products and services by `listing_id`, at most 6 each, mapped to `EntityShopItem` with `resolveRemoteImage` and the existing price-label helper; item hrefs `/marketplace/products|services/{global_slug}`; "Shop all" → `/vendors/{slug}`.
- The loader fills `entity.shop` only when `sectionAllowed('shop')` holds; the registry entry already exists.

## Checks

- Mapper and gate unit tests; e2e with the flag forced on shows the section and its "Shop all" link.
