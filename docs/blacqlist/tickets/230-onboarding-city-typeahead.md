# Ticket 230: Type any US city in onboarding

**Phase:** V1.5 · **Priority:** P2 · **Status:** In review (draft PR)
**Depends on:** none.
**Gates:** GATE-DATA (one migration plus loading the US places list; staging first, after the founder's OK; production with the merge). GATE-DEPLOY (draft PR only). GATE-COMMS (a privacy notice email only if the founder wants one).

**Decision record (founder, 2026-11-15):**

1. "When onboarding for Where are you based, User should be able to type and field should auto fill using geo information for the US, not just our few options."
2. **Where the suggestions come from:** our own US list, loaded from public Census data and served from our server. Nothing a person types goes to an outside company.
3. **"Use My Location":** yes, add the button.
4. **How:** built as a draft PR.

Ticket 142's "no suggestions while typing" applies to the map search box and Nominatim. It is unchanged. This ticket doesn't use Nominatim.

---

## Why

Step 1 of onboarding, "Where Are You Based?", was a dropdown of the few BLACQList cities plus "All cities / National". Most people live somewhere else, so most people skipped it or picked a city that isn't theirs, and `profiles.city_id` told us little.

## Scope

**In**

- `us_places`: 32,107 US places (50 states, DC and Puerto Rico) from the Census 2024 Gazetteer, with Vintage 2024 population for incorporated places. Names are cleaned ("Abbeville city" → "Abbeville") and the consolidated city-counties use their common name ("Nashville", "Louisville", "Honolulu"). One place per label, so the list never shows the same words twice.
- `profiles.home_place_geoid`: the place someone picked. `profiles.city_id` is still set when the place is one of our active cities.
- `suggest_us_places()`: names that start with the text first, then a word inside the name ("honolulu" finds "Honolulu"; "ventura" finds "San Buenaventura (Ventura)"). A state after a comma narrows it ("Houston, T"); a state without a comma also works ("austin tx"). Our active cities come first, then larger places.
- `nearest_us_place()`: the place a point is most likely in, within 30 miles. Each place counts as a circle the size of its land area, so midtown Manhattan answers New York, not Hoboken (whose centre point is nearer).
- `GET /api/places/suggest?q=` (2 to 60 characters, 60 a minute per IP, up to 8 answers) and `GET /api/places/nearest?lat&lng` (20 a minute per IP, never cached). Neither logs the query or the coordinates.
- `CityCombobox` in onboarding step 1: type, pick with mouse or keys, the pick becomes a chip with a clear button, "No US city found" when nothing matches. "Use My Location" rounds to 2 decimals in the browser (about a kilometre) and fills the chip. If location is off or fails, it says "Type your city instead."
- Privacy policy Section 2: one line for the home city and the location button.

**Out**

- Showing or editing the home place anywhere after onboarding (account settings). Nothing reads `home_place_geoid` yet.
- Using the home place to sort search or the home page.
- Places outside the US.
- Population for CDPs (unincorporated places). They sort after places that have one.

## Acceptance criteria

1. Typing "deca" lists Decatur places with their states; picking "Decatur, GA" and finishing saves `home_place_geoid = 1322052`.
2. "Houston" lists "Houston, TX" first. "Mound Bayou" is found.
3. Picking one of our active cities also sets `city_id` as before.
4. Arrow keys, Enter and Escape work; the list is announced to screen readers; every button is at least 44px tall.
5. "Use My Location" fills the chip with the nearest place; when permission is refused, typing still works and the field says so.
6. Skip and Next still work with nothing picked. A bad or unknown place is ignored and onboarding still completes.
7. If the migration isn't applied yet, the field shows no suggestions and onboarding still completes.

## Data

- Built by `scripts/geo/build-us-places.ts` from the two Census files (URLs in the script header), into `data/geo/us-places.csv` (1.6 MB, source columns only; label and search text are worked out on load).
- Loaded by `pnpm seed:us-places`: upserts on `geoid`, never deletes, safe to run again. A remote run needs `--yes`; production also needs `--production`.

## Tested

- Unit: the name clean-up, the build and CSV round trip, the data file (32,107 places, one per label), both routes (validation, limits, rounding, errors) and the save (place, active city, unknown place).
- Database, on a throwaway Postgres 14 with the full list loaded: the migration runs twice cleanly; "deca" → Decatur, GA first (our active city); "houston" → Houston, TX first; "Houston, T", "austin tx", "honolulu", "st louis" and "mound bayou" all land; nearest answers New York, Decatur, Atlanta, Houston, Chicago, Los Angeles, Mound Bayou and Anchorage for points inside them, and nothing mid-ocean; the anon role can call both functions; an unknown GEOID can't be saved. Suggest runs in about 6 ms, nearest in about 1 ms.
- Not run: the Playwright pass (Docker didn't answer, so no local Supabase). The preview walk after the staging load covers it.

## Order at merge

1. Staging: migration, then `pnpm seed:us-places --yes` (after the founder's OK).
2. Try it on the PR preview (previews use staging).
3. Production with the merge: migration, then the load with `--yes --production`.

## Founder calls at merge

- Whether the privacy line moves the "Last updated" date (`lib/legal/policyUpdate.ts`), and whether a notice email goes out (GATE-COMMS).
