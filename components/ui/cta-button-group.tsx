import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CTAButton {
  label: string
  href: string
  external?: boolean
}

interface CTAButtonGroupProps {
  primary: CTAButton
  secondary?: CTAButton
  align?: 'left' | 'center'
  stackOnMobile?: boolean
  /**
   * Surface the group sits on.
   * - `dark` (default): gold primary + white-outline secondary — for dark hero / sections.
   * - `light`: amber primary + ink-outline secondary — for white / off-white sections.
   */
  tone?: 'dark' | 'light'
  className?: string
}

export function CTAButtonGroup({
  primary,
  secondary,
  align = 'left',
  stackOnMobile = true,
  tone = 'dark',
  className,
}: CTAButtonGroupProps) {
  const containerClasses = cn(
    'flex',
    stackOnMobile ? 'flex-col md:flex-row' : 'flex-row',
    'gap-3',
    align === 'center' && 'items-center justify-center',
    className
  )

  const primaryClasses =
    tone === 'light'
      ? 'bg-amber text-white hover:bg-amber/90' // 5.16:1 on white
      : 'bg-gold text-brand-black hover:bg-light-gold' // gold on dark, 8.2:1

  const secondaryClasses =
    tone === 'light'
      ? 'border border-brand-black/30 text-brand-black bg-transparent hover:bg-brand-black/5'
      : 'border border-white/50 text-white bg-transparent hover:bg-white/10'

  return (
    <div className={containerClasses}>
      <Button
        asChild
        className={cn(
          'font-body font-bold rounded-full px-6 py-2.5 text-base transition-colors min-w-[140px] min-h-[44px] h-auto',
          primaryClasses
        )}
      >
        <Link
          href={primary.href}
          {...(primary.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {primary.label}
        </Link>
      </Button>

      {secondary && (
        <Button
          asChild
          className={cn(
            'rounded-full px-6 py-2.5 text-base transition-colors min-h-[44px] h-auto',
            secondaryClasses
          )}
        >
          <Link
            href={secondary.href}
            {...(secondary.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {secondary.label}
          </Link>
        </Button>
      )}
    </div>
  )
}
