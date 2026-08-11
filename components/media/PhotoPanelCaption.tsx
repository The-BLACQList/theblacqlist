import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PHOTO_PLATE_TINT, PHOTO_PLATE_VEIL } from '@/lib/design/surfaces'

interface Props {
  /** The caption's own padding and text-layout classes. */
  className?: string
  children: ReactNode
}

/**
 * The caption band of a photographic panel — a feathered, part-transparent veil
 * with the panel's text on top of it.
 *
 * Used by all three grounded surfaces (triptych, category bento, city tiles) so
 * the veil geometry can never drift between them. The tint and the ramp live in
 * `PHOTO_PLATE_TINT` / `PHOTO_PLATE_VEIL`; this component owns the *structure*
 * the ramp needs.
 *
 * **Why the veil is a sibling of the text rather than its background.** The ombre
 * is a `mask-image`, and a mask applies to an element's content as well as its
 * own painting — set it on the box that holds the words and the words fade with
 * it. So the veil is its own `aria-hidden` layer, absolutely positioned, and the
 * text rides above it in normal flow with `relative`.
 *
 * **The overhang is the effect.** `PHOTO_PLATE_VEIL` pins the veil to this box's
 * left, right and bottom edges but starts it above the top, so it reaches up into
 * the picture and dissolves there. Height therefore comes from the caption's own
 * content — a two-line category name grows the solid part of the band and the
 * feather rides up with it, which is why nothing here is a fixed pixel height.
 *
 * ## How a panel is assembled
 *
 * The panel is the positioning context; the frame fills it; an `aria-hidden`
 * spacer holds the picture's visible proportion open above the caption:
 *
 * ```tsx
 * <Link className="group relative flex flex-col overflow-hidden bg-deep-bg">
 *   <PhotoPanelGround src={photo} sizes="…" />
 *   <span aria-hidden className="block aspect-[16/9]" />
 *   <PhotoPanelCaption className="p-6">…</PhotoPanelCaption>
 * </Link>
 * ```
 *
 * The spacer replaces what used to be a `relative` wrapper *around* the frame,
 * and the swap is the reason the crop got better rather than worse. The frame
 * used to be confined to that wrapper — in the bento, a ~320×112 slot against a
 * 3:2 source, a ~47% vertical cut straight through faces. Filling the whole
 * ~320×190 panel makes the same crop ~11%. Every `PHOTO_FOCAL` value was tuned
 * against a harsher cut than it now runs at, which errs in the safe direction: a
 * position chosen to keep a head inside a 47% cut cannot push it out of an 11%
 * one.
 */
export function PhotoPanelCaption({ className, children }: Props) {
  return (
    <span className="relative block">
      <span
        aria-hidden="true"
        data-plate-veil
        className={PHOTO_PLATE_VEIL}
        style={{ background: PHOTO_PLATE_TINT }}
      />
      {/* `data-plate-veil` and `data-plate-caption` are the two hooks
          `scripts/measure-plate-contrast.ts` needs: hide the caption, keep the
          veil painted, and override the veil's alpha to sweep it. They are
          markup that exists for the measurement, and they stay — the alpha in
          `PHOTO_PLATE_TINT` is only defensible for as long as it can be
          re-measured. */}
      <span data-plate-caption className={cn('relative flex flex-col', className)}>
        {children}
      </span>
    </span>
  )
}
