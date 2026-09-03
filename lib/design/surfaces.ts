/**
 * Shared dark-surface treatments.
 *
 * The ember wash is the gold radial that sits on every `bg-deep-bg` tile in the
 * Living Commerce Index direction — city chapters, category bento, the Avenues.
 * It lives here so the three call sites can never drift apart.
 */
export const EMBER_WASH =
  'radial-gradient(120% 120% at 82% 18%, rgba(196,160,101,0.16), transparent 55%)'

/**
 * The picture region of a panel that has no photograph.
 *
 * `EMBER_WASH` used to serve this too, and at 0.16 alpha over `deep-bg` it was
 * right — because the scrim held near-black over the photographic tiles beside
 * it, so an unphotographed tile matched its neighbours. Removing the scrim broke
 * that match: the frames are now at full brightness and a 0.16 wash reads as a
 * void punched into the row `[Observed — headless bento capture at 1280,
 * 2026-08-09]`.
 *
 * So this is deliberately louder than the wash, and it is a **separate** token
 * rather than a bump to `EMBER_WASH`, because the other three consumers
 * (`TheAvenues`, `BlacqlightFeature`, `ShowcaseCarousel`) set gold and white
 * text directly on the wash — raising its alpha there would cut their contrast
 * to buy brightness on a surface that has no such problem. Here **nothing sits
 * on this gradient**: the tile's name and count ride the caption veil across the
 * bottom, so the region owes no ratio and is free to carry real color.
 *
 * The linear layer does the work — a graded charcoal ground so the tile has
 * depth instead of being flat black — and the radial puts the brand's gold in
 * the same top-right corner the wash uses, so a photo-less tile still reads as
 * the same family as a photographed one. Nine of twenty-five categories are
 * mapped, so this surface is permanent furniture, not a gap waiting to close.
 */
export const PHOTO_ABSENT =
  'radial-gradient(115% 115% at 78% 14%, rgba(196,160,101,0.34), rgba(196,160,101,0.06) 54%, transparent 78%), ' +
  'linear-gradient(158deg, #191620 0%, #0e0d12 58%, #08080a 100%)'

/**
 * The caption plate's tint — brand ground at partial alpha, so the photograph
 * reads **through** the band that carries the panel's text.
 *
 * `[Decision — founder, 2026-08-09: "what about if the current black area was an
 * overlay with a light ombre opacity to separate the words just enough, but I
 * can still see the picture through it"]`. This is the third state of this
 * surface, and the distinction between the three matters:
 *
 * | | What it covered | Why it went |
 * |---|---|---|
 * | `PHOTO_SCRIM` | the **whole frame**, to hold text set over the picture | darkened every photograph in the product |
 * | `PHOTO_PLATE` (solid) | a band **beside** the frame, opaque `deep-bg` | correct but flat — the picture stopped at a hard line |
 * | this | a band **over the bottom of** the frame, part-transparent, feathered | current |
 *
 * So the standing rule — *do not lay an overlay across a photograph to solve a
 * legibility problem* — is intact. Nothing covers the picture. What is veiled is
 * the caption band alone, and it is veiled to a **measured** alpha rather than a
 * chosen one.
 *
 * **What sets the alpha.** The count line is `text-xs`, so it is small text and
 * owes 4.5:1, not the 3:1 large-text allowance the white headline gets. Against
 * the worst pixel any frame puts under that line, the type's own color fixes the
 * floor for this number — it is arithmetic, not taste.
 * `scripts/measure-plate-contrast.ts` samples the real composited pixels rather
 * than assuming an opaque ancestor, and sweeps this alpha.
 *
 * | alpha | runs below floor | worst 4.5:1 run | margin |
 * |---|---|---|---|
 * | 0.82 | 0 | 8.43:1 | 87% |
 * | 0.70 | 0 | 5.68:1 | 26% |
 * | 0.68 | 0 | 5.24:1 | 16% |
 * | **0.67** | **0** | **5.08:1** | **13%** |
 * | 0.66 | 0 | 4.85:1 | 8% |
 * | 0.65 | 0 | 4.70:1 | 4% |
 * | 0.64 | 10 | 4.50:1 ✗ | — |
 * | 0.60 | 23 | 3.87:1 ✗ | — |
 *
 * `[Measured — scripts/measure-plate-contrast.ts, 310 runs × 2 routes × 375/640/
 * 768/1024/1280, 2026-08-10]`. 0.65 and 0.66 also clear every floor and are
 * rejected deliberately: a 4–8% margin is inside the range a different image
 * decode or a browser's text antialiasing can move. 0.67 clears by 13%, which is
 * the same discipline that previously chose 0.82 over 0.80 at 11%. **Never ship
 * the boundary value** — the lowest passing alpha is not the shippable one.
 *
 * **This number moved 0.82 → 0.67 because the type color moved, not because the
 * bar did.** `[Decision — founder, 2026-08-10: "Make the opacity even a bit
 * lighter … so the message of the image actually lands"]`. The old regime's
 * binding run everywhere was `text-gold` `#c4a065` at 11–12px, which needs ~0.79
 * over a pure-white ground pixel; the small accent runs are now
 * `text-light-gold` `#ffd867`, which needs ~0.64, and the one grey metro line on
 * `/cities` went `text-ink-soft` → `text-off-white` so it would not become the
 * new binding constraint in gold's place. The lever this file reserved
 * ("`text-light-gold` … is the lever if it ever has to be pulled … That is a
 * brand decision, not a contrast one") has now been pulled, by the founder.
 *
 * **The binding rows cluster, so this is a system answer rather than one
 * frame's.** At 0.67 the ten worst runs are the same `legal-financial` bento
 * tile's hover name and count line across all five widths, with `healthcare` (a
 * white coat under bright windows, the brightest ground in the set) just behind.
 * Swapping a frame will not buy further transparency here.
 *
 * **And the worst case is alpha-determined, not image-determined — which is why
 * adding a bright frame is safe.** Those binding runs sit on a *saturated* ground:
 * the worst pixel under the caption box is already pure `#ffffff`, which the veil
 * composites to `rgb(90,90,91)` (`255 − 247 × 0.67`). No photograph can be
 * brighter than white, so any frame with a blown highlight anywhere in its caption
 * band lands on exactly this floor and no frame lands below it. Computing that
 * bound directly over the source pixels — ignoring `backdrop-blur`, so it is
 * strictly conservative — gives **5.05:1** for `suit-and-ledger`,
 * `physician-portrait`, and `agency-desk` alike, against the harness's in-situ
 * **5.08:1** `[Measured — worst-pixel bound over the source WebPs + scripts/
 * measure-plate-contrast.ts, 2026-08-10]`. Two independent methods, one answer.
 * The practical rule: a new frame cannot regress this, but **lowering the alpha
 * moves every one of these rows at once.**
 *
 * **The reserve lever, still unpulled.** If this has to go lower, raise the
 * veil's `backdrop-blur-[6px]` to 8px and re-sweep. Blur is the second variable;
 * never move it and the alpha in the same pass.
 *
 * **Why `backdrop-blur` is load-bearing and not decoration.** Blur collapses the
 * local neighbourhood into an average, so a busy ground behind the text stops
 * having a worst pixel far from its mean. It buys real alpha back — the veil can
 * be more transparent for the same measured ratio — and it makes the feather
 * read as depth of field instead of as a smudge.
 */
export const PHOTO_PLATE_TINT = 'rgba(8,8,10,0.67)'

/**
 * The veil element that paints `PHOTO_PLATE_TINT`.
 *
 * Absolutely positioned, and it extends **above** its caption box (`-top-14`)
 * into the picture, where the mask fades it out. That overhang is the ombre: the
 * band is solid enough to hold type where the type is, and dissolves into the
 * photograph above it with no edge to see.
 *
 * The ramp is a `mask-image` rather than a gradient background. That was
 * originally forced: the veil carried `backdrop-blur`, and a gradient background
 * would have faded the tint while the blur kept a hard rectangular top edge,
 * where the mask fades **both together**. The blur is gone now (below), so the
 * two approaches would be equivalent — the mask stays because it is already
 * correct and because it is what lets a blur come back without a rewrite.
 *
 * **There is no `backdrop-blur` on this veil, and its removal is the fix for a
 * real defect rather than a taste call.** It shipped at `backdrop-blur-[6px]`.
 * That is invisible on a soft, large subject — a plate of food, a portrait — and
 * it is *destructive* on a skyline, which is nothing but thin towers and window
 * grids. High-frequency detail is exactly what a blur removes, so on the three
 * city frames the band stopped reading as a photograph seen through a veil and
 * started reading as an opaque bar. The founder's report was that the city
 * panels "didn't get the same opacity treatment as the bento area" — the alpha,
 * the mask and the blur were in fact byte-identical on both surfaces
 * `[Measured — computed styles on / at 375/768/1280, 2026-08-10]`; it was the
 * blur's *effect* that was not identical, because the subjects are not
 * `[Observed — blur sweep at 0/2/3/4/6px over atlanta.webp, 2026-08-10]`.
 *
 * Removing it spends what this file previously held in reserve as the lever for
 * pushing the alpha lower, so the reserve is now the alpha itself. It cost
 * almost nothing to spend: the in-situ measurement *with* blur was 5.08:1 and
 * the worst-pixel bound computed over the source pixels *ignoring* blur was
 * 5.05:1, so the blur was carrying ~0.03:1 of the margin — and the harness
 * re-run after removal confirms it directly (see `PHOTO_PLATE_TINT`).
 *
 * **The ramp is anchored in pixels, not percentages, and that is a correctness
 * fix rather than a preference.** It first ran as `#000 58%, transparent 100%`,
 * which puts the feather at a fraction of the veil's own height — so the taller
 * the caption, the further *down into the text* the fade reached. The cities
 * feature tile has the tallest caption on the site (an eyebrow, a 40px name, a
 * count, a metro line) and its "Most active" eyebrow landed a third of the way
 * up the ramp at roughly 0.59 alpha, over a bright skyline: **3.87:1 against a
 * 4.5:1 floor** `[Measured — scripts/measure-plate-contrast.ts, 1280px,
 * 2026-08-09]`. `calc(100%-3.5rem)` is exactly the caption's top edge, because
 * `-top-14` is exactly 3.5rem, so the tint is now at full strength across every
 * pixel of text and the whole feather happens in the overhang above it. Caption
 * height stops being a variable in the contrast.
 *
 * `-webkit-mask-image` is duplicated deliberately — Safari still ships the
 * prefixed property for masks on composited layers.
 *
 * Consumers own the caption's padding; this token is the surface only.
 */
export const PHOTO_PLATE_VEIL =
  'absolute inset-x-0 bottom-0 -top-14 pointer-events-none ' +
  '[-webkit-mask-image:linear-gradient(to_top,#000_0%,#000_calc(100%-3.5rem),transparent_100%)] ' +
  '[mask-image:linear-gradient(to_top,#000_0%,#000_calc(100%-3.5rem),transparent_100%)]'

/**
 * Frame path → `object-position` class. Unlisted frames center normally.
 *
 * Keyed on the **photograph**, not the surface, because a subject's head sits in
 * the same place wherever the frame is used — one row fixes the triptych, the
 * bento, and any surface added later. `PhotoPanelGround` does the lookup itself,
 * so no consumer passes a focal point.
 *
 * **Why this exists.** Every source is 3:2 (the optimizer preserves it on
 * purpose so one file survives both a wide hero and a square card). The regions
 * that consume them are wider, so `object-cover` throws away height, and at the
 * default `50% 50%` it takes half of that off the top — exactly where faces are.
 * Three of these frames have hair touching the very top edge of the source
 * `[Observed — frames read at full size, 2026-08-09]`; centered, they crop
 * through the top of the head.
 *
 * **The caption plate cut the severity roughly in half.** When the text sat on
 * the picture, a panel had to be short and wide to stay legible — a bento tile
 * was ~2.25:1 and a city tile ~2.5:1, a ~33–41% vertical cut. Now the plate
 * carries the text and the picture is free to keep its own shape: the triptych
 * and city photo regions are a fixed `aspect-[16/9]` (1.78:1, a **~16% cut**)
 * and the bento's region takes whatever the fixed grid row leaves. So these
 * values are all now applied to a gentler crop than they were tuned against,
 * which errs safe in the one direction that matters — a value chosen to keep a
 * head inside a 41% cut cannot push it out of a 16% one.
 *
 * **Lower percentage shows more of the top.** With a total cut fraction `c` and
 * position `P`, the visible band is `[c·P, 1 − c·(1−P)]` — so `10%` is the
 * strongest head-preserving value and `55%` biases toward the bottom of the
 * frame. The bottom stays the cheap side to lose: it is the edge that meets the
 * caption plate.
 *
 * Values are literal strings so Tailwind can see them in the class scan. Do not
 * build them dynamically — an interpolated class is a class that never ships.
 *
 * Every value here was set by reading the source frame and then verified in a
 * render `[Observed — headless capture at 375/768/1280, 2026-08-09]`. Two
 * survived the render badly enough to be re-cut: `chicago` at 22% clipped an
 * antenna an eyeball estimate had put 2 points lower than it is, and
 * `asha-osei-photography` turned out to be unfixable by cropping at all. The
 * lesson is in both comments — read the frame, then check the render; the frame
 * alone will lie to you about a few points of position.
 *
 * 768 is the safe breakpoint by geometry, not by tuning: a triptych panel is
 * taller than it is wide there, so `object-cover` crops horizontally and the
 * full height of the frame survives regardless of what this map says.
 *
 * Five frames are deliberately absent: `soleil-kidswear` (subject sits at 24%
 * with clear space above), `physician-portrait` (hair starts at 11%, clearing a
 * centered crop by 5.5 points), `zinga-interior-design` and `calabash-candles`
 * (no people), and `leather-and-denim` (a flat-lay whose objects spread evenly,
 * so every crop composes). Centered is correct for all five; an entry would only
 * add noise.
 *
 * The city frames are here for the same reason with a different subject: a
 * skyline puts its tallest point near the top edge, so a centered crop takes the
 * tower tops off. Their values were set against the old ~41% cut and now run at
 * ~16%, so every antenna sits further inside the band than it was tuned to.
 *
 * Precedent: `HomeHero.tsx` already does this inline with `object-[center_20%]`.
 */
export const PHOTO_FOCAL: Readonly<Record<string, string>> = {
  // The one frame no crop can fully save: the red headwrap runs off the top
  // edge of the *source*, so some contact with the panel's top edge is in the
  // photograph rather than in the crop. 0% is the floor and is strictly better
  // than any higher value at every width — it spends the whole vertical cut on
  // the bottom, which is the edge that meets the caption plate.
  '/images/editorial/asha-osei-photography.webp': 'object-[50%_0%]',
  // Hair at the top edge, face 12–33% — the most aggressive bias in the set.
  '/images/editorial/melanin-law-group.webp': 'object-[50%_10%]',
  '/images/editorial/rooted-tech-solutions.webp': 'object-[50%_12%]',
  // Two subjects at different heights: the trainer's headband is at the top
  // edge, the seated woman's face runs to ~90%. 15% keeps both inside the band.
  '/images/editorial/sable-fitness-collective.webp': 'object-[50%_15%]',
  '/images/editorial/afrofuturist-bookshop.webp': 'object-[50%_15%]',
  // Two people, the higher head at ~11%.
  '/images/editorial/diaspora-creative-agency.webp': 'object-[50%_30%]',
  '/images/editorial/crown-and-coil-studio.webp': 'object-[50%_32%]',
  // Locs top out at ~7%, the highest head in the set. At the bento's ~11% cut a
  // centered crop puts the band top at 5.5% — inside by 1.5 points, which is
  // exactly the margin the `chicago` mistake proved an eyeball estimate can
  // swallow. 30% halves it to 3.3%. `physician-portrait` needs no entry for the
  // same arithmetic run the other way: its hair starts at 11%, so centered
  // clears by 5.5 points.
  '/images/editorial/agency-desk.webp': 'object-[50%_30%]',
  // Head at 17%; the pot below sits nearest the plate, so biasing up costs little.
  '/images/editorial/peach-and-rye-kitchen.webp': 'object-[50%_40%]',
  // Hard hat at 16%.
  '/images/editorial/ujima-construction.webp': 'object-[50%_40%]',

  // No people in these two, so the rule is "keep the subject whole" rather than
  // "keep the head". The plate of ribs spans 26–85%, low in the frame, so this
  // is the one entry in the set that biases *down*.
  '/images/editorial/bbq-plate.webp': 'object-[50%_55%]',
  // Hands and forearms occupy the top third and the drum head anchors the
  // bottom; centered clips the raised hand that makes it read as drumming.
  '/images/editorial/hands-and-drums.webp': 'object-[50%_38%]',

  // Skylines. Each value is set from the highest structure in the frame. They
  // were tuned against the pre-plate city tile (~2.53:1, a ~41% cut, centered
  // landing at [20.5%, 79.5%] and shearing the tower tops); the photo region is
  // now 16/9, so the same values run at a ~16% cut with more headroom, not less.
  // Bank of America Plaza's spire sits at ~11%.
  '/images/cities/atlanta.webp': 'object-[50%_25%]',
  // Antenna at ~11%, the bronze-glass tower that carries the frame at ~14%.
  '/images/cities/houston.webp': 'object-[50%_25%]',
  // Aerial: the Hancock antenna tips at ~7% and the beach anchors the bottom.
  // At a ~41% cut, 15% puts the band top at 6.1% — inside the antenna. 22% read
  // plausible against an eyeballed ~9% and clipped it.
  '/images/cities/chicago.webp': 'object-[50%_15%]',
  // The three below are not the same problem as the three above, and copying
  // 25% into them would have been the `chicago` mistake made a second time.
  // None is a tower-topped skyline: DC is a low horizontal city under a very
  // tall sunset sky, so a top-weighted crop returns mostly cloud and loses the
  // dome; New Orleans puts its skyline band at ~34% with the river below it,
  // so biasing up crops the water that says "New Orleans" and still doesn't
  // gain a subject. Both sit slightly below centre on purpose.
  '/images/cities/dc.webp': 'object-[50%_45%]',
  '/images/cities/new-orleans.webp': 'object-[50%_45%]',
  // Los Angeles is the only one of the three that behaves like the set above —
  // the US Bank Tower crown is the highest structure at ~17%, well clear of
  // Atlanta's ~11% spire, so it needs a gentler bias than 25%.
  '/images/cities/los-angeles.webp': 'object-[50%_30%]',

  // Discover banners. Different geometry from everything above: the frame is a
  // wide letterbox (~1280×300 at desktop) rather than a portrait-ish panel, so
  // `object-cover` crops *vertically* and hard, and the type sits over the
  // lower two thirds. Each value keeps the subject clear of that type band
  // rather than clear of the top edge.
  '/images/editorial/categories/brick-and-mortar.webp': 'object-[50%_35%]',
  '/images/editorial/categories/restaurants.webp': 'object-[50%_50%]',
  '/images/editorial/categories/products-and-services.webp': 'object-[50%_50%]',
  // Faces highest in the set — heads near the top of the frame, so bias up.
  '/images/editorial/categories/professionals.webp': 'object-[50%_30%]',
  '/images/editorial/categories/creatives.webp': 'object-[50%_40%]',
  '/images/editorial/categories/events.webp': 'object-[50%_45%]',
  '/images/editorial/categories/jobs.webp': 'object-[50%_35%]',
}

/**
 * City slug → skyline photograph. Same contract as `CATEGORY_PHOTOS`:
 * deliberately partial, and an unmapped city renders the ember wash as a
 * first-class outcome rather than a missing image.
 *
 * Keyed on the full slug (`atlanta-ga`), not the bare city name, because that is
 * what `cities.slug` holds (`supabase/seed.sql:87`) and what both consumers
 * already have in hand.
 *
 * The mapped set is exactly the cities we have licensed skyline photography for
 * — nothing more. It used to coincide with the `is_active = true` set, but that
 * was a coincidence and never a rule: activating a city does not give it a
 * photograph. Washington DC, Los Angeles and New Orleans spent months on the
 * wash for exactly that reason and joined the map on 2026-09-03, when the
 * founder confirmed their photographs carry the same license as the original
 * three `[Decision — founder, 2026-09-03]`. That is still the only way in: a
 * city gets a frame when its photo is licensed and art-directed into
 * `PHOTO_FOCAL`, and until then the wash is the finished look, not a gap.
 * Do not stretch one of these six across a seventh city.
 *
 * Unlike the editorial frames these are informative, so consumers pass a real
 * `alt` — see `PhotoPanelGround`.
 */
export const CITY_PHOTOS: Readonly<Record<string, string>> = {
  'atlanta-ga': '/images/cities/atlanta.webp',
  'houston-tx': '/images/cities/houston.webp',
  'chicago-il': '/images/cities/chicago.webp',
  'washington-dc': '/images/cities/dc.webp',
  'los-angeles-ca': '/images/cities/los-angeles.webp',
  'new-orleans-la': '/images/cities/new-orleans.webp',
}

/**
 * Category slug → editorial photograph.
 *
 * Deliberately partial. Fifteen of the twenty-five top-level categories have a
 * photograph with real depth behind it; the other ten render the ember wash
 * and are *supposed to*. Do not fill the rest for uniformity — an unmatched
 * photo is worse than an honest designed tile
 * (`photographic-style-direction.md` §"Specificity over stock").
 *
 * The bento renders the top nine categories by live listing count, so which of
 * these appear changes with the data. That is the point: the map is keyed on
 * category, not on position, so it degrades on its own. Today all nine rendered
 * tiles are photographic `[Observed — local render against prod-shaped seed,
 * 2026-08-09]`, which is a fact about the current data rather than a target —
 * the tenth-ranked category tomorrow may well have no frame, and that tile is
 * not broken when it arrives.
 *
 * `melanin-law-group` is keyed to `legal-financial` rather than the broader
 * `professional-services`: the frame is a man reading documents in an office,
 * which is specifically legal/financial rather than the catch-all. It is mapped
 * once, not to both — two slugs pointing at one file duplicates the frame in a
 * single grid the day both categories rank.
 *
 * `professional-services` therefore gets its own frame, `suit-and-ledger`
 * [Decision — founder, 2026-08-10]. The archive offered five candidates and four
 * were rejected for reading as a *specific* profession rather than the catch-all:
 * a dentist with a patient (that is `healthcare`, already held by
 * `physician-portrait`), a man against a wall of bound legal volumes (that is
 * `legal-financial`, already held), and a man beside a FOR SALE sign (real
 * estate, which is not this category). The two survivors are the same shoot one
 * step apart; the tighter of the two was taken, because every bento tile is far
 * taller than the source's 3:2 and the crop comes off the *width* — a subject
 * that fills more of the frame is the one that survives it.
 *
 * It is a bright frame — blown-out windows behind the subject and a glass desk
 * under him — which puts it in the same hazard class as `physician-portrait`
 * below. It was measured before it shipped rather than after — see the figure in
 * `PHOTO_PLATE_TINT`'s note.
 *
 * One property of this row that is worth writing down before someone reads it as
 * a defect: "Professional Services" is long enough to wrap to two lines under
 * `line-clamp-2` at 375 and 768, which grows the caption box, lifts the veil, and
 * covers more of the frame than its single-line neighbours. That is the label's
 * length, not the frame's fault, and it is already the shipped behaviour of
 * `social-media-marketing` ("Social Media & Marketing") on the same grid
 * `[Observed — local dev render at 375, 2026-08-10]`. It needs no special
 * handling here; it is only surprising if you meet it on this tile first.
 *
 * The three newest frames — `bbq-plate`, `leather-and-denim`, `hands-and-drums`
 * — are named for what they show rather than for a business, because none of
 * them depicts one. That is deliberate and worth keeping: the older filenames
 * are invented aspirational business names, which is exactly why
 * `PhotoPanelGround` forces `alt=""` on them.
 *
 * All three are also people-free, which is not a coincidence. A frame with no
 * head in it survives a short wide tile at any focal point, and it sidesteps the
 * Canva identifiable-people restriction entirely. `food-dining` is the feature
 * tile at two columns by two rows, so it needed exactly that.
 *
 * `childcare-family` is the single permitted placement of the frame depicting a
 * minor [Decision — 2026-08-09]. It does not go anywhere else on the site.
 *
 * `healthcare` and `social-media-marketing` were the last two rendered tiles on
 * the wash, and they are now filled from the archive rather than the existing
 * pool [Decision — founder, 2026-08-09: "I also want the two images back in the
 * bento area"]. The note that used to sit here argued against filling them, and
 * the objection it raised is real rather than obsolete: `physician-portrait` is
 * a head near the top edge over a white coat and bright windows, which is the
 * brightest ground under the gold count line anywhere in the set. It is the
 * frame most likely to fail the caption band's contrast floor, so it is the one
 * to check first whenever `PHOTO_PLATE_TINT` moves. `agency-desk` is the
 * honest read of a marketing professional at work; it is deliberately not
 * `diaspora-creative-agency`, which fits the category conceptually but already
 * carries triptych panel 03 in the same scroll.
 *
 * Both are named for what they show rather than for a business, like the three
 * frames above them and unlike the older nine.
 *
 * The three triptych photographs are intentionally absent — both components
 * render on the homepage inside one scroll, and a repeated frame reads as a bug.
 */
export const CATEGORY_PHOTOS: Readonly<Record<string, string>> = {
  'food-dining': '/images/editorial/bbq-plate.webp',
  'fashion-apparel': '/images/editorial/leather-and-denim.webp',
  'arts-culture': '/images/editorial/hands-and-drums.webp',
  'beauty-grooming': '/images/editorial/crown-and-coil-studio.webp',
  'legal-financial': '/images/editorial/melanin-law-group.webp',
  technology: '/images/editorial/rooted-tech-solutions.webp',
  'home-living': '/images/editorial/zinga-interior-design.webp',
  'construction-trades': '/images/editorial/ujima-construction.webp',
  'retail-gifts': '/images/editorial/calabash-candles.webp',
  'childcare-family': '/images/editorial/soleil-kidswear.webp',
  'wellness-health': '/images/editorial/sable-fitness-collective.webp',
  'books-publishing': '/images/editorial/afrofuturist-bookshop.webp',
  healthcare: '/images/editorial/physician-portrait.webp',
  'social-media-marketing': '/images/editorial/agency-desk.webp',
  'professional-services': '/images/editorial/suit-and-ledger.webp',
}
