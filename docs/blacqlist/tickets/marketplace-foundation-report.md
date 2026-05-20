# Marketplace Foundation — Build Report

**Built:** 2026-05-11
**Status:** Complete (pending pnpm tsc + lint verification)

---

## What Was Built

A CTA-based marketplace foundation for The BLACQList. Vendors list products and services with outbound links to their external stores and booking pages. No payment processing. No checkout. No Stripe Connect.

---

## Files Created

### Schema

| File                                                            | Description                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260511000002_marketplace_foundation.sql` | Creates `marketplace_products` and `marketplace_services` tables, RLS policies, indexes, triggers |

### Type Additions

| File                    | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `lib/supabase/types.ts` | Added `marketplace_products` and `marketplace_services` table types |

### Server Actions

| File                                       | Description                                              |
| ------------------------------------------ | -------------------------------------------------------- |
| `lib/actions/marketplace/createProduct.ts` | Create product, ownership verify, global slug generation |
| `lib/actions/marketplace/updateProduct.ts` | Update product, ownership via inner join, revalidatePath |
| `lib/actions/marketplace/createService.ts` | Create service, same pattern as product                  |
| `lib/actions/marketplace/updateService.ts` | Update service, same pattern                             |

### API Routes

| File                                     | Description                                                    |
| ---------------------------------------- | -------------------------------------------------------------- |
| `app/api/marketplace/cta-click/route.ts` | Fire-and-forget CTA click tracker, inserts to analytics_events |

### Components

| File                                     | Description                                                          |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `components/marketplace/CTAButton.tsx`   | Client component — tracks CTA click via sendBeacon, renders as `<a>` |
| `components/marketplace/ProductCard.tsx` | Product grid card — image, price, Shop Now CTA                       |
| `components/marketplace/ServiceCard.tsx` | Service grid card — delivery icon, price, Book Now/Request Quote CTA |
| `components/marketplace/ProductForm.tsx` | Client form — create/edit products, useActionState                   |
| `components/marketplace/ServiceForm.tsx` | Client form — create/edit services, useActionState                   |

### Public Pages

| File                                                | Description                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `app/(public)/marketplace/page.tsx`                 | Hub — hero, featured products, featured services, vendor CTA     |
| `app/(public)/marketplace/products/page.tsx`        | Products index                                                   |
| `app/(public)/marketplace/products/[slug]/page.tsx` | Product detail — lookup by global_slug                           |
| `app/(public)/marketplace/services/page.tsx`        | Services index                                                   |
| `app/(public)/marketplace/services/[slug]/page.tsx` | Service detail — lookup by global_slug                           |
| `app/(public)/vendors/[slug]/page.tsx`              | Vendor storefront — all active products + services for a listing |

### Dashboard Pages

| File                                               | Description                                          |
| -------------------------------------------------- | ---------------------------------------------------- |
| `app/dashboard/products/page.tsx`                  | Products list — owner's products across all listings |
| `app/dashboard/products/new/page.tsx`              | New product form                                     |
| `app/dashboard/products/[productId]/edit/page.tsx` | Edit product form                                    |
| `app/dashboard/services/page.tsx`                  | Services list                                        |
| `app/dashboard/services/new/page.tsx`              | New service form                                     |
| `app/dashboard/services/[serviceId]/edit/page.tsx` | Edit service form                                    |

### Admin Pages

| File                             | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| `app/admin/marketplace/page.tsx` | Admin overview — stats by status, recent products/services tables |

### Files Modified

| File                                        | Change                                |
| ------------------------------------------- | ------------------------------------- |
| `components/dashboard/DashboardSidebar.tsx` | Added Products and Services nav items |
| `components/admin/AdminSidebar.tsx`         | Added Marketplace nav item            |

---

## Permission Model

- **Public access:** Only `status = 'active'` products/services on `status = 'published'` listings are visible
- **Owner access:** Owners see all their own products/services (any status) via RLS
- **Dashboard guard:** `requireOwner()` — must be authenticated and own at least one listing
- **Admin access:** `requireAdmin()` + serviceClient — sees all records bypassing RLS

---

## Security Notes

- Ownership is double-verified in server actions: RLS policy AND explicit listing ownership check
- `serviceClient` (service role) is used only for insert/update after ownership is confirmed in the session client
- CTA click tracker validates entity_type against an enum and requires `https://` or `http://` destination URL
- No raw DB errors exposed in action return values

---

## Dependencies on Admin

No admin approval is required to activate a product or service at MVP. Vendors set `status = 'active'` themselves. Admin can audit via `/admin/marketplace`.

If a moderation workflow is needed in V2, add a `moderation_status` column and wire into the moderation queue pattern used for claims.

---

## Next Recommended Tickets

1. **Marketplace search + category filtering** — Add search input and category facets to index pages
2. **Image upload** — Replace URL field with Supabase Storage direct upload in dashboard forms
3. **Service package options** — Add `package_options jsonb` display to service detail page
4. **Vendor page integration** — Wire `/vendors/[slug]` link into entity page trust section (below bio)
5. **Marketplace analytics** — Add CTA click counts to vendor dashboard and admin marketplace page
