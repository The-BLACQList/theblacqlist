import Image from 'next/image'
import { cn } from '@/lib/utils'
import { EMBER_WASH, PHOTO_FOCAL, PHOTO_SCRIM } from '@/lib/design/surfaces'

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
 * The ground layer of a dark editorial panel — the thing that sits behind the
 * text on the triptych, the category bento, and the city tiles.
 *
 * Two states, and the fallback is a first-class outcome rather than a
 * degradation: with a photograph it renders `fill` + `object-cover` under the
 * shared legibility scrim; without one it renders the ember wash exactly as
 * those panels did before photography existed. Most categories and most cities
 * will never have a photograph, by design — see `CATEGORY_PHOTOS`.
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
 * The parent must be `relative` and `overflow-hidden`, and must own the text
 * above this with `relative` so it stacks over the ground.
 *
 * The crop is not the caller's problem. Panels are much wider than the 3:2
 * sources, so `object-cover` throws away a third of the frame's height, and
 * centered that lands on faces. `PHOTO_FOCAL` holds the per-frame correction and
 * this component applies it — a consumer that adds a new photographic surface
 * inherits the right crop without knowing the map exists.
 */
export function PhotoPanelGround({ src, sizes, priority = false, alt = '' }: Props) {
  if (!src) {
    return (
      <span
        className="absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity duration-200"
        aria-hidden="true"
        style={{ background: EMBER_WASH }}
      />
    )
  }

  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn('object-cover', PHOTO_FOCAL[src])}
      />
      {/* Lightens on hover so the photograph steps forward — the same
          affordance the ember wash gives, expressed through the scrim. */}
      <span
        className={`absolute inset-0 ${PHOTO_SCRIM} group-hover:opacity-90 transition-opacity duration-200`}
        aria-hidden="true"
      />
    </>
  )
}
