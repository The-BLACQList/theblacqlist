# 185: Logo on the page, a logo editor, cover upload, and the meter fixes

**Status:** Planned — from the 184 plan, founder 2026-11-13. Not started. Own branch and draft PR off `origin/main` once 184 has merged; **no merge before Wed 18 Nov 2026** (launch merge freeze).
**Follows:** 184 (sample pages: `EntityLogo`, `entity.logo`)
**Area:** business pages, the owner editor (`PageFinishView#photos`, `MediaGrid`)
**Gates:** none. No migration, no env change; `logo_path` already exists on `listings`.

## Why

The logo is stored (`listings.logo_path`, upload role `logo`) and never rendered. The dashboard has no logo editor, and a cover can only be picked from gallery photos. Three meter bugs make the strength meter lie: `lib/ai/checklist.ts` passes the logo item on any gallery photo; its hours item reads `listing_hours` while the editor writes `listing_details_business.hours`; `components/listings/finish/StrengthMeter.tsx` labels the logo item "A photo".

## What changes

- Loader (`lib/listings/entityPage.ts`): `logo = trust_tier !== 'unclaimed' && logo_path ? { src: resolveMediaPath(logo_path), alt: `${name} logo` } : null` — the same claimed-only rule the map pins use (`app/api/map/listings/route.ts`). `TemplateHero` already renders `EntityLogo` when `entity.logo` is set.
- Actions `lib/actions/dashboard/setLogo.ts` and `removeLogo.ts` (owner check, user client, write `listings.logo_path`). Check first that the owner-guard trigger does not freeze `logo_path`; `setCoverImage` is the precedent.
- `components/dashboard/LogoUploader.tsx` under `#photos`, posting to `/api/upload` with `media_role=logo`; a cover upload control in `MediaGrid` (`media_role=cover` → `setCoverImage`). Logo and cover uploads never appear in the gallery.
- The three meter fixes above.

## Checks

- Action tests: owner check, path shape, removal clears the column.
- Loader hides the logo on an unclaimed listing.
- e2e: an owner uploads a logo and sees it in the hero; the meter's logo item passes only with a logo.
