# 198: Service-area list for businesses without an address

**Status:** Stub — founder 2026-11-13. Not on the sample page; needs a decision before it is built.
**Follows:** 184, 190
**Area:** business pages (the Visit block)

**Problem.** `service_area` and `traveling` listings have no address, so the Visit block is nearly empty, and nothing tells a visitor whether the business comes to their part of town.

**Proposed shape.** `listing_service_areas(listing_id, city_id | zip, sort_order)`; "We serve: Decatur, East Point, …" under the hours; the mini map (190) draws the served cities as pins or a hull when there is no address.

**Depends on.** 184, 190. **Gate.** GATE-DATA for the migration.
