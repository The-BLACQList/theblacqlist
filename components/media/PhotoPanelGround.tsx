import Image from 'next/image'
import { cn } from '@/lib/utils'
import { PHOTO_ABSENT, PHOTO_FOCAL } from '@/lib/design/surfaces'

interface Props {
  /** Public path to the editorial photograph. Undefined → the ember wash. */
  src?: string | undefined
  /** Responsive width hint for next/image. Required when `src` is set. */
  sizes?: string
  priority?: boolean
  /**
   * Defaults to `""` — decorative, which is right for every editorial frame.
   * Pass a description only when the photograph carries meaning the panel's own
   * text does not, as the city skylines do.
   */
  alt?: string
}

/**
 * The picture of a dark editorial panel — it fills the whole panel on the
 * triptych, the category bento, and the city tiles, with the caption band
 * veiling its bottom edge.
 *
 * Two states, and the fallback is a first-class outcome rather than a
 * degradation: with a photograph it renders `fill` + `object-cover`; without one
 * it renders `PHOTO_ABSENT`, a designed gold-and-charcoal panel. Every tile
 * currently rendered has a photograph, but most of the twenty-five categories
 * never will — see `CATEGORY_PHOTOS` — so the unphotographed tile has to hold a
 * row on its own merits, not look like a frame that failed to load.
 *
 * **Nothing is laid across the photograph.** No scrim, no wash, no tint. It used
 * to carry `PHOTO_SCRIM`, because the text sat on top of the frame and small
 * gold type owes 4.5:1 against a ground the component cannot know. The fix was
 * to move the text off the picture and onto its own caption band, which removes
 * the reason the scrim existed rather than tuning it.
 *
 * That band now overlaps the bottom of the frame at a part-transparent,
 * feathered alpha (`PHOTO_PLATE_TINT` / `PHOTO_PLATE_VEIL`), so a strip of the
 * photograph reads through it. **That is not a scrim returning.** The rule it
 * replaced is still the rule: do not darken a picture to rescue type laid over
 * it. A caption band whose alpha is set by measuring the pixels it actually
 * covers is a different object from a gradient held across the whole frame on
 * the hope that the ratio lands. If a new surface wants type on open picture,
 * the answer is still to give it a band, not to tint the frame.
 *
 * Decorative by default. The panel's own heading carries the meaning, so `alt`
 * is empty unless a caller says otherwise: a screen reader announcing a scene
 * description on an editorial frame would duplicate the link text with noise. It
 * is also the guard against the naming caution in `editorial-image-licenses.md`
 * — those filenames are aspirational business names we invented and must never
 * reach the accessibility tree.
 *
 * The city tiles are the deliberate exception and pass a real `alt`. A skyline
 * is informative rather than decorative, and the filenames are plain place
 * names, so nothing has to be hidden. Default to empty; opt in.
 *
 * **The parent is the whole panel, not a sub-region.** It must be `relative` and
 * `overflow-hidden`; the frame fills it edge to edge and the caption sits over
 * the bottom of it via `PhotoPanelCaption`. Panels still size themselves the way
 * they always did, but with an `aria-hidden` spacer rather than a wrapper — see
 * that component for why the swap is what makes the crop better rather than
 * worse.
 *
 * The crop is not the caller's problem. A panel is wider than the 3:2 source, so
 * `object-cover` throws away height, and centered that lands on faces.
 * `PHOTO_FOCAL` holds the per-frame correction and this component applies it — a
 * consumer that adds a new photographic surface inherits the right crop without
 * knowing the map exists.
 */
export function PhotoPanelGround({ src, sizes, priority = false, alt = '' }: Props) {
  if (!src) {
    return (
      // Full strength at rest. The old 0.7 base made sense when a scrim held
      // the photographic tiles down to meet it; against undimmed frames it just
      // reads faint. Hover lifts rather than reveals.
      <span
        className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.04]"
        aria-hidden="true"
        style={{ background: PHOTO_ABSENT }}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // A slow push-in on hover is the affordance the scrim used to give by
      // lightening. It is `motion-safe:` only — under prefers-reduced-motion
      // the frame is simply static, which is a real alternative rather than a
      // disabled effect, and it is why headless captures read unscaled.
      className={cn(
        'object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.04]',
        PHOTO_FOCAL[src]
      )}
    />
  )
}
