import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

import { CTAButtonGroup } from '@/components/ui/cta-button-group'
import { cn } from '@/lib/utils'

interface EmptyStateAction {
  label: string
  href: string
}

interface EmptyStateProps {
  heading: string
  body?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  icon?: LucideIcon
  iconClassName?: string
  className?: string
  /** Heading level — use 1 when this is the primary content of the page, 2 (default) when embedded in a section */
  level?: 1 | 2 | 3
}

export function EmptyState({
  heading,
  body,
  action,
  secondaryAction,
  icon: Icon,
  iconClassName,
  className,
  level = 2,
}: EmptyStateProps) {
  const Heading = `h${level}` as 'h1' | 'h2' | 'h3'

  return (
    <div className={cn('flex flex-col items-center text-center py-16 px-4 gap-4', className)}>
      {Icon && <Icon className={cn('size-12 text-charcoal', iconClassName)} aria-hidden="true" />}

      <Heading className="font-headline text-xl md:text-2xl text-brand-black">{heading}</Heading>

      {body && <p className="font-body text-base text-charcoal max-w-sm">{body}</p>}

      {action && <CTAButtonGroup primary={action} align="center" stackOnMobile={false} />}

      {secondaryAction && (
        <Link
          href={secondaryAction.href}
          className="font-subhead text-sm text-amber-gold hover:underline min-h-[44px] inline-flex items-center"
        >
          {secondaryAction.label}
        </Link>
      )}
    </div>
  )
}
