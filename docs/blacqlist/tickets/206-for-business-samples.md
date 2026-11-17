# Ticket 206: Sample pages on For Business

**Asked:** founder, 2026-11-17: "Add nav/buttons to the examples on the For Business page as examples of what their pages could be."

**Gates:** GATE-DEPLOY (founder OK to merge). No migration, no env change, no data writes.

## What ships

- **For Business, new "Sample pages" section** between What You Get and the trust ladder: one card per layout (Storefront, Professional, Creative) with the sample's cover photo, who the layout is for, what the sample shows, and "See the {Layout} Sample". A line under the cards says the business, reviews and numbers are made up and that some features need a paid plan.
- **Sample banner:** "Get a Page Like This" after the notice, back to `/for-business#start`. The link guard lets it through by `data-example-allow-links`.
- **`/example` opens on production.** Ticket 184 kept it a 404 there; a For Business link to a 404 is worse. It stays out of search: `noindex, nofollow` in the layout, `/example/` disallowed in robots.txt, and on production the page leaves out the LocalBusiness JSON-LD so the live domain never describes a made-up business to search engines.

## Checked against seed-data-plan §10

§10 lists records not to seed into the production database. The sample pages are code fixtures, not database rows: nothing is written, no listing exists, search and the map never see them, and every page carries the non-dismissible "not a real business" banner. Licences: all 44 photos are Unsplash License (commercial use allowed); `example-image-licenses.md` now names the For Business use.

## Open for the founder

- **The name "Test Business 123"** now shows on the live site. A warmer sample name is a fixtures-wide rename (tests pin it); a separate small change if wanted.
- **The layout.** The samples show the chapters layout (ticket 204); live listings still use the stacked template. The copy says "could look like", not "will".
