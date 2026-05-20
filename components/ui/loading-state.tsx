import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ─── ListingCardSkeleton ───────────────────────────────────────────────────────
// Mirrors the EntityCard layout: cover image + content area
export function ListingCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-lg border border-pale-lavender overflow-hidden bg-white', className)}
    >
      {/* Cover image area */}
      <Skeleton className="aspect-video w-full rounded-none rounded-t-lg" />

      {/* Content area */}
      <div className="p-3 space-y-2">
        {/* Business name */}
        <Skeleton className="h-5 w-3/4" />
        {/* Category */}
        <Skeleton className="h-3 w-1/2" />
        {/* City */}
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

// ─── SectionSkeleton ──────────────────────────────────────────────────────────
// A block of text-line skeletons suitable for any body copy section
interface SectionSkeletonProps {
  lines?: number
  className?: string
}

export function SectionSkeleton({ lines = 3, className }: SectionSkeletonProps) {
  const lineCount = Math.max(1, lines)

  return (
    <div aria-hidden="true" className={cn('w-full', className)}>
      {/* Section title */}
      <Skeleton className="h-6 w-1/3 mb-4" />

      {/* Body lines */}
      <div className="flex flex-col gap-y-3">
        {Array.from({ length: lineCount }).map((_, i) => (
          <Skeleton key={i} className={cn('h-4', i === lineCount - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

// ─── HeroSkeleton ─────────────────────────────────────────────────────────────
// Mirrors the BLACQList Page hero: image area + entity name + tagline
export function HeroSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('w-full', className)}>
      {/* Hero image */}
      <Skeleton className="w-full h-[240px] md:h-[360px] rounded-lg" />

      {/* Entity name */}
      <Skeleton className="h-7 md:h-9 w-1/2 mt-4" />

      {/* Tagline */}
      <Skeleton className="h-4 w-1/3 mt-2" />
    </div>
  )
}

// ─── StatCardSkeleton ─────────────────────────────────────────────────────────
// Dashboard stat card: label + number + sub-label
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-lg border border-pale-lavender bg-white p-4', className)}
    >
      {/* Label */}
      <Skeleton className="h-3 w-24 mb-2" />
      {/* Number */}
      <Skeleton className="h-8 w-16" />
      {/* Sub-label */}
      <Skeleton className="h-3 w-20 mt-1" />
    </div>
  )
}
