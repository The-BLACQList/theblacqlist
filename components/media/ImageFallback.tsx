import { cn } from '@/lib/utils'

interface Props {
  name: string
  categoryName?: string | null
  size?: 'hero' | 'card'
  className?: string
}

/**
 * F-1 "Monogram + Node Field" designed fallback (Living Commerce Index).
 * Replaces bare-initials placeholders wherever a listing has no verified
 * imagery: dark ground, sparse gold node field, monogram in a Q-style ring,
 * and the category named beneath so unclaimed covers still carry identity.
 * Never renders stock photography that could be mistaken for the business.
 */
export function ImageFallback({ name, categoryName, size = 'hero', className }: Props) {
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
          backgroundImage: [
            'radial-gradient(circle at 18% 32%, var(--color-gold) 1.5px, transparent 2.4px)',
            'radial-gradient(circle at 71% 58%, var(--color-gold) 1.5px, transparent 2.4px)',
            'radial-gradient(circle at 44% 82%, var(--color-gold) 1.5px, transparent 2.4px)',
            'radial-gradient(circle at 87% 22%, var(--color-gold) 1.5px, transparent 2.4px)',
            'radial-gradient(circle at 8% 75%, var(--color-gold) 1.5px, transparent 2.4px)',
          ].join(', '),
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
