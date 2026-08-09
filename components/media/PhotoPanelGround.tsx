import Image from 'next/image'
import { EMBER_WASH, PHOTO_SCRIM } from '@/lib/design/surfaces'

interface Props {
  /** Public path to the editorial photograph. Undefined → the ember wash. */
  src?: string | undefined
  /** Responsive width hint for next/image. Required when `src` is set. */
  sizes?: string
  priority?: boolean
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
 * Always decorative. The panel's own heading carries the meaning, so `alt` is
 * empty on purpose: a screen reader announcing a scene description here would
 * duplicate the link text with noise. It is also the guard against the naming
 * caution in `editorial-image-licenses.md` — the filenames are aspirational
 * business names we invented and must never reach the accessibility tree.
 *
 * The parent must be `relative` and `overflow-hidden`, and must own the text
 * above this with `relative` so it stacks over the ground.
 */
export function PhotoPanelGround({ src, sizes, priority = false }: Props) {
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
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
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
