import { cn } from '@/lib/utils'

// The "Soon" marker beside a link to a feature that isn't open yet (ticket 122).
// The link still goes somewhere: proxy.ts shows the opening-soon cover there.

interface Props {
  /** `dark` for the header and other deep-bg surfaces, `light` for white ones. */
  tone?: 'dark' | 'light'
  className?: string
}

export function SoonPill({ tone = 'dark', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-px font-subhead text-[10px] font-semibold uppercase leading-4 tracking-[0.12em]',
        tone === 'dark' ? 'border-gold/50 text-gold' : 'border-charcoal/30 text-charcoal',
        className
      )}
    >
      Soon
    </span>
  )
}
