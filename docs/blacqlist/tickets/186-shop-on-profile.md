# 186: The business's marketplace items on its own page ("Shop")

**Status:** In PR — stacked on 190 (#337) → 189 (#336) → 185 (#335). No migration. Merge needs the founder's OK. Scope notes: there was no shared price-label helper, so `lib/marketplace/priceLabel.ts` now serves the Shop and both marketplace cards (same wording as before). The loader uses `sellsPublicly` (Growth+) and `marketplaceOpen`; `growthIsOpen()` is not needed, because only a page already on Growth or Premium can show a Shop. The listing route renders per request, so new items show without a revalidate. The 2026-11-13 freeze line is stale.
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
