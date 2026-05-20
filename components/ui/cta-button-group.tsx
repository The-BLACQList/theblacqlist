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
  className?: string
}

export function CTAButtonGroup({
  primary,
  secondary,
  align = 'left',
  stackOnMobile = true,
  className,
}: CTAButtonGroupProps) {
  const containerClasses = cn(
    'flex',
    stackOnMobile ? 'flex-col md:flex-row' : 'flex-row',
    'gap-3',
    align === 'center' && 'items-center justify-center',
    className
  )

  return (
    <div className={containerClasses}>
      <Button
        asChild
        className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-6 py-2.5 text-base transition-colors min-w-[140px] min-h-[44px] h-auto"
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
          className="border border-white/50 text-white bg-transparent hover:bg-white/10 rounded-full px-6 py-2.5 text-base transition-colors min-h-[44px] h-auto"
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
