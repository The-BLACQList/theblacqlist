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

/**
 * Five zones the node field draws from. Fixed zones keep the field balanced and
 * sparse whatever the seed is, and keep every node clear of the centre where the
 * monogram and category label sit. The seed only jitters within a zone.
 */
const NODE_ZONES: ReadonlyArray<{ x: [number, number]; y: [number, number] }> = [
  { x: [8, 30], y: [16, 38] },
  { x: [68, 92], y: [10, 32] },
  { x: [6, 26], y: [64, 86] },
  { x: [70, 92], y: [58, 84] },
  { x: [38, 60], y: [78, 92] },
]

/** Deterministic value in [min, max] from a seed and an axis label. */
function jitter(seed: string, key: string, [min, max]: [number, number]): number {
  return min + (hashString(`${seed}:${key}`) % (max - min + 1))
}

function nodeGradients(seed: string | null | undefined): string {
  return NODE_ZONES.map((zone, i) => {
    const x = seed ? jitter(seed, `x${i}`, zone.x) : Math.round((zone.x[0] + zone.x[1]) / 2)
    const y = seed ? jitter(seed, `y${i}`, zone.y) : Math.round((zone.y[0] + zone.y[1]) / 2)
    return `radial-gradient(circle at ${x}% ${y}%, var(--color-gold) 1.5px, transparent 2.4px)`
  }).join(', ')
}

/**
 * F-1 "Monogram + Node Field" designed fallback (Living Commerce Index).
 * Replaces bare-initials placeholders wherever a listing has no verified
 * imagery: dark ground, sparse gold node field, monogram in a Q-style ring,
 * and the category named beneath so unclaimed covers still carry identity.
 * Never renders stock photography that could be mistaken for the business.
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
      {/* Sparse gold node field — signature accent, never wallpaper */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: nodeGradients(seed),
          backgroundSize: isHero ? '340px 340px' : '210px 210px',
        }}
      />

      <div className="relative flex flex-col items-center gap-2">
        {/* Monogram in the Q-node ring */}
        <span
          className={cn(
            'relative flex items-center justify-center rounded-full border-2 border-gold font-headline text-gold select-none',
            isHero ? 'size-20 text-3xl' : 'size-14 text-xl'
          )}
        >
          {initials}
          {/* Q tail */}
          <span
            className={cn(
              'absolute bg-gold rounded-[2px] rotate-45',
              isHero
                ? 'w-5 h-[2.5px] -right-2 bottom-1.5'
                : 'w-3.5 h-[2px] -right-1.5 bottom-1'
            )}
          />
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
