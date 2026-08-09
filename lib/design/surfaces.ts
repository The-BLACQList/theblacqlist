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
 * Legibility scrim laid over a photographic panel ground. Heavier at the bottom
 * because every panel that uses one sets its text with `justify-end`.
 *
 * This is the token named in photographic-style-direction.md — reuse it rather
 * than authoring a gradient per surface, or the panels drift apart the way the
 * ember wash did before it moved here.
 *
 * Slightly heavier than the value the doc quotes (`from-black/80 via-black/40
 * to-transparent`). Rendered against the real frames, the bright ones — the
 * commercial kitchen on the Support panel, the salon on `beauty-grooming` —
 * left the gold index number and the body line sitting on near-white at the
 * mid-stop `[Observed — headless capture at 375/768/1280, 2026-08-09]`. The
 * `to-black/10` floor also keeps a fully-lit frame from blowing out at the top
 * of a short tile.
 */
export const PHOTO_SCRIM = 'bg-gradient-to-t from-black/85 via-black/50 to-black/10'

/**
 * Category slug → editorial photograph.
 *
 * Deliberately partial. Nine of the twenty-five top-level categories have a
 * photograph with real depth behind it; the other sixteen render the ember wash
 * and are *supposed to*. Do not fill the rest for uniformity — an unmatched
 * photo is worse than an honest designed tile
 * (`photographic-style-direction.md` §"Specificity over stock").
 *
 * The bento renders the top nine categories by live listing count, so which of
 * these appear changes with the data. That is the point: the map is keyed on
 * category, not on position, so it degrades on its own. Today four of the nine
 * rendered tiles are photographic `[Observed — local render against prod-shaped
 * seed, 2026-08-09]`; the rest are the wash.
 *
 * `melanin-law-group` is keyed to `legal-financial` rather than the broader
 * `professional-services`: the frame is a man reading documents in an office,
 * which is specifically legal/financial rather than the catch-all. It is mapped
 * once, not to both — two slugs pointing at one file duplicates the frame in a
 * single grid the day both categories rank.
 *
 * `food-dining` is the largest tile and has no photograph. The pool holds one
 * food frame and it carries the Support panel above, where it does more work.
 * A tile is allowed to be the biggest and still be the ember wash — that is
 * cheaper than stretching an unrelated frame across it.
 *
 * `childcare-family` is the single permitted placement of the frame depicting a
 * minor [Decision — 2026-08-09]. It does not go anywhere else on the site.
 *
 * The three triptych photographs are intentionally absent — both components
 * render on the homepage inside one scroll, and a repeated frame reads as a bug.
 */
export const CATEGORY_PHOTOS: Readonly<Record<string, string>> = {
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
