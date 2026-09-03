import { cn, hashString } from '@/lib/utils'

interface Props {
  name: string
  categoryName?: string | null
  size?: 'hero' | 'card'
  /**
   * Stable per-record string (use the listing id) that varies the node field so
   * a grid of fallbacks does not read as repeated wallpaper. Omit for a fixed
   * arrangement — the layout is identical either way, only node placement moves.
   */
  seed?: string | null
  className?: string
}

/** The founder's node-network ground and monogram frame. */
const NODE_GROUND = '/brand/node-bg.webp'
const Q_FRAME = '/icons/q-frame.webp'

/**
 * How far the seed is allowed to move the crop, per axis, in percent.
 *
 * ⚠ Deliberately narrow, and the narrowness is the whole design. The artwork
 * carries a broad dark vignette at its centre — which is exactly the job the old
 * `NODE_ZONES` did by keeping every drawn node out of the middle, so the monogram
 * and the category label always sat on clean ground. Pushing the crop to the
 * edges would slide that vignette out from under the text and put a lit node
 * cluster behind it. 35–65% varies which part of the network each card shows
 * without ever losing the quiet centre.
 */
const CROP_RANGE: readonly [number, number] = [35, 65]

/** Deterministic value in [min, max] from a seed and an axis label. */
function jitter(seed: string, key: string, [min, max]: readonly [number, number]): number {
  return min + (hashString(`${seed}:${key}`) % (max - min + 1))
}

/**
 * Where to crop the node ground for this record.
 *
 * The seed exists so a grid of fallbacks does not read as repeated wallpaper.
 * One static image on every card is precisely that failure, so the artwork is
 * still seeded — the seed now moves the crop instead of moving drawn nodes.
 */
function groundPosition(seed: string | null | undefined): string {
  if (!seed) return '50% 50%'
  return `${jitter(seed, 'gx', CROP_RANGE)}% ${jitter(seed, 'gy', CROP_RANGE)}%`
}

/**
 * F-1 "Monogram + Node Field" designed fallback (Living Commerce Index).
 * Replaces bare-initials placeholders wherever a listing has no verified
 * imagery: dark ground, gold node network, monogram in the Q frame, and the
 * category named beneath so unclaimed covers still carry identity.
 * Never renders stock photography that could be mistaken for the business.
 *
 * **Both marks are now artwork, not CSS.** The ground was five seeded
 * `radial-gradient` dots and the frame was a `border-2` circle with a rotated
 * `<span>` for the Q tail — stand-ins drawn because the real assets did not
 * exist yet [Decision — founder, 2026-09-03]. `node-bg.webp` and
 * `q-frame.webp` are those assets. Do not redraw either in CSS.
 *
 * The ground needs no dimming: measured across all 1,196,400 pixels its 99th
 * percentile luminance is 0.0081, which is 15.5:1 against off-white — the
 * artwork is near-black everywhere except the node cores, and those are specks
 * `[Measured — sharp raw pixels, 2026-09-03]`. The old field carried
 * `opacity-30` because five hard gold dots at full strength read as decoration
 * competing with the monogram; this one does not have that problem.
 */
export function ImageFallback({ name, categoryName, size = 'hero', seed, className }: Props) {
  const initials = name
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()

  const isHero = size === 'hero'

  return (
    <div
      className={cn('absolute inset-0 bg-deep-bg flex items-center justify-center', className)}
      aria-hidden="true"
    >
      {/* Gold node network — signature accent, seeded so a grid never repeats */}
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url(${NODE_GROUND})`,
          backgroundPosition: groundPosition(seed),
        }}
      />

      <div className="relative flex flex-col items-center gap-2">
        {/* Monogram inside the Q frame.
            The asset is cropped square with the ring dead centre and the tail
            fully inside it, so ordinary flex centring lands the initials in the
            ring with no offsets to maintain — see the crop note in the PR.

            ⚠ The box is deliberately larger than the 80/56px ring it replaces,
            because the ring only occupies 80.8% of it (its hole, 65.8%). 96px
            draws a 77.6px ring and 64px draws a 51.7px one — within a couple of
            pixels of the drawn ring on both sides, so the artwork lands at the
            weight the layout was tuned for rather than 13% heavier.

            The card size is the constrained one: `CollectionBusinessCard` puts a
            card fallback in a 112×112 tile, so the whole stack — box + gap-2 +
            the ~14px label — has to fit 112px. At 64px it is 86px and breathes;
            at 80px it was 102px and crowded the tile edge to edge. */}
        <span
          className={cn(
            'flex items-center justify-center bg-contain bg-center bg-no-repeat font-headline text-gold select-none',
            isHero ? 'size-24 text-3xl' : 'size-16 text-lg'
          )}
          style={{ backgroundImage: `url(${Q_FRAME})` }}
        >
          {initials}
        </span>

        {categoryName && (
          <span className="font-subhead text-[10px] font-bold uppercase tracking-[0.16em] text-off-white/75">
            {categoryName}
          </span>
        )}
      </div>
    </div>
  )
}
