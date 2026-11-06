# 180: Remove the Cities page and the home page Cities section

**Status:** Draft PR, waiting for the founder's merge word
**Follows:** nothing, this stands alone
**Area:** `/cities`, the home page, the site header

## Why

The founder: "Let's remove the 'Cities' page and home page banner."

The banner is the "Cities / Your city's index" photo rail on the home page. It is the only city section there.

## What changes

**The page**

- `/cities` is gone, and so is the Cities link in the header and the mobile menu.
- `/cities` now sends people to `/discover`, so old links and search results don't hit the 404 page.
- The breadcrumb on a city page now reads Discover, then the city, and links to `/discover`.

**The home page**

- The Cities photo rail is gone, along with the query and counts that only it used.
- Fresh Finds keeps its city join, because its links need it.

**What stays**

- Every city stays live. `/discover/{city}`, the sitemap, the map city tabs, the Discover city filter, search and Cue don't change.
- All six skyline photos stay in `public/images/cities/`, with their license entries. Only the code that pointed at them is gone.
- `cities` stays in the assistant's reserved routes, because the path still redirects and is never a city.
- No database change and no migration.

**Tests and scripts**

- The e2e specs that read a city from `/cities` now use `atlanta-ga`, a seeded city, as `e2e/launch-gates.spec.ts` does.
- `e2e/route-guards.spec.ts` now checks that `/cities` lands on `/discover`.
- The contrast scripts no longer visit `/cities`.

## Worth knowing

City pages lose both of their direct links. People still reach them through the Discover city filter, the map tabs, Cue, search and listing pages. Google still finds them through the sitemap, but fewer internal links can soften their search ranking a little.
