# 185: Logo on the page, a logo editor, cover upload, and the meter fixes

**Status:** In PR (branch `feat/185-logo-cover`, 2026-11-15). Scope as built: the cover upload (`BannerEditor`, `setBanner`) and the hours meter fix (`countOpenDays(details.hours)`) were already on main, so this PR is the logo half: the logo in the live hero (claimed pages only), a logo panel at the top of Photos, the logo meter item passing on `logo_path` instead of any photo, and the "Logo or Profile Photo" label. One server action, `setLogoAction`, both sets and removes the logo (null removes). The freeze line is stale: the freeze was lifted 2026-11-15.
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
