import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  children: React.ReactNode
  level?: 2 | 3
  onDark?: boolean
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
  id?: string
}

export function SectionHeading({
  children,
  level = 2,
  onDark = false,
  subtitle,
  align = 'left',
  className,
  id,
}: SectionHeadingProps) {
  const headingClasses = cn(
    'font-headline font-bold leading-tight',
    level === 2 ? 'text-[22px] md:text-[28px]' : 'text-[18px] md:text-[20px]',
    onDark ? 'text-white' : 'text-brand-black',
    align === 'center' && 'text-center',
    className
  )

  const subtitleClasses = cn(
    'font-subhead text-sm md:text-base mt-1',
    onDark ? 'text-pale-lavender' : 'text-charcoal',
    align === 'center' && 'text-center'
  )

  const wrapperClasses = cn('flex flex-col', align === 'center' && 'items-center')

  if (level === 2) {
    return (
      <div className={wrapperClasses}>
        <h2 id={id} className={headingClasses}>
          {children}
        </h2>
        {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
      </div>
    )
  }

  return (
    <div className={wrapperClasses}>
      <h3 id={id} className={headingClasses}>
        {children}
      </h3>
      {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
    </div>
  )
}
