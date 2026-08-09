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
 * on this gradient**: the tile's name and count are on `PHOTO_PLATE` below it,
 * so the region owes no ratio and is free to carry real color.
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
 * The caption plate — a solid band of brand ground that carries a photographic
 * panel's text **beside** the photograph rather than on top of it.
 *
 * This replaces `PHOTO_SCRIM`, and the replacement is a direction change, not a
 * tuning pass `[Decision — founder, 2026-08-09]`. Every scrim shape we tried
 * was a trade between legibility and the frame: the panels are much wider than
 * their 3:2 sources and set their text with `justify-end`, so the text block ran
 * from the bottom padding up past halfway, and covering it meant holding
 * near-black across two thirds of the picture. That cleared the floor — gold
 * 5.12–7.46:1, white 10.07:1+ `[Measured — headless capture at 375/768/1280,
 * 2026-08-09]` — at the cost of darkening every photograph in the product.
 *
 * **The constraint was never the photograph; it was small gold type on an
 * unknown ground.** The count line is `text-xs`, so it is small text and owes
 * 4.5:1, not the 3:1 large-text allowance the white headlines get — and no
 * gradient can promise a ratio over a frame whose brightest pixel is unknown.
 * Move that line onto `deep-bg` and the problem stops existing:
 *
 * | Foreground on `--color-deep-bg` (#08080a) | Ratio | Owes | Margin |
 * |---|---|---|---|
 * | gold `#c4a065` | **8.16:1** | 4.5:1 (small text) | 1.81× |
 * | white | **20.01:1** | 3:1 (large text) | 6.67× |
 * | ink-soft `#b5b5b7` | **9.78:1** | 4.5:1 (small text) | 2.17× |
 *
 * `[Measured — scripts/measure-panel-contrast.ts, 144 text spans across / and
 * /cities at 375/768/1280, 2026-08-09]` — zero below floor, worst margin 1.81×.
 * These hold at every width, on every tile, forever, because the ground is a
 * constant instead of a photograph. The picture above the plate then carries
 * **nothing**: no wash, no gradient, no tint.
 *
 * The border is the whole visual join. A crisp hairline reads as an editorial
 * caption bar; a soft fade would just be a small scrim, which is the thing we
 * removed. Consumers own their own padding — the token is the surface only.
 */
export const PHOTO_PLATE = 'bg-deep-bg border-t border-white/10'

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
 * Four frames are deliberately absent: `soleil-kidswear` (subject sits at 24%
 * with clear space above), `zinga-interior-design` and `calabash-candles` (no
 * people), and `leather-and-denim` (a flat-lay whose objects spread evenly, so
 * every crop composes). Centered is correct for all four; an entry would only
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
 * Three of the thirteen seeded cities are mapped, and they are exactly the three
 * with `is_active = true` — the launch chapters (`supabase/seed.sql:85-101`).
 * The other ten are `launch_phase = 'v1'` and do not render a tile until they go
 * live, so there is nothing to photograph for them yet. When one opens, it gets
 * a frame or it gets the wash; do not stretch one of these three across it.
 *
 * Unlike the editorial frames these are informative, so consumers pass a real
 * `alt` — see `PhotoPanelGround`.
 */
export const CITY_PHOTOS: Readonly<Record<string, string>> = {
  'atlanta-ga': '/images/cities/atlanta.webp',
  'houston-tx': '/images/cities/houston.webp',
  'chicago-il': '/images/cities/chicago.webp',
}

/**
 * Category slug → editorial photograph.
 *
 * Deliberately partial. Twelve of the twenty-five top-level categories have a
 * photograph with real depth behind it; the other thirteen render the ember wash
 * and are *supposed to*. Do not fill the rest for uniformity — an unmatched
 * photo is worse than an honest designed tile
 * (`photographic-style-direction.md` §"Specificity over stock").
 *
 * The bento renders the top nine categories by live listing count, so which of
 * these appear changes with the data. That is the point: the map is keyed on
 * category, not on position, so it degrades on its own. Today seven of the nine
 * rendered tiles are photographic `[Observed — local render against prod-shaped
 * seed, 2026-08-09]`; the rest are the wash.
 *
 * `melanin-law-group` is keyed to `legal-financial` rather than the broader
 * `professional-services`: the frame is a man reading documents in an office,
 * which is specifically legal/financial rather than the catch-all. It is mapped
 * once, not to both — two slugs pointing at one file duplicates the frame in a
 * single grid the day both categories rank.
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
 * Two of the nine rendered tiles stay on the wash on purpose, and neither is a
 * gap waiting to be closed. Nothing in the pool honestly depicts
 * `social-media-marketing`. Every `healthcare` candidate fails on its own terms:
 * the four portraits put a head at the top edge against cold clinical white that
 * fights `bg-deep-bg` and the gold type, and the fifth is a dental procedure —
 * unpleasant at homepage scale and off-brand teal.
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
}
