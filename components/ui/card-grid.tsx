import { cn } from '@/lib/utils'

interface CardGridCols {
  base?: number
  sm?: number
  lg?: number
  xl?: number
}

type GapSize = 'sm' | 'md' | 'lg'

interface CardGridProps {
  children: React.ReactNode
  cols?: CardGridCols
  gap?: GapSize
  className?: string
}

// Static lookup tables — dynamic class construction is not used to ensure
// Tailwind v4 includes all referenced utilities in the output bundle.
const BASE_COLS_MAP: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

const SM_COLS_MAP: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}

const LG_COLS_MAP: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
}

const XL_COLS_MAP: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
}

const GAP_MAP: Record<GapSize, string> = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
}

export function CardGrid({
  children,
  cols = { base: 1, sm: 2, lg: 3 },
  gap = 'md',
  className,
}: CardGridProps) {
  const baseColClass =
    cols.base !== undefined ? (BASE_COLS_MAP[cols.base] ?? 'grid-cols-1') : 'grid-cols-1'

  const smColClass = cols.sm !== undefined ? (SM_COLS_MAP[cols.sm] ?? '') : ''

  const lgColClass = cols.lg !== undefined ? (LG_COLS_MAP[cols.lg] ?? '') : ''

  const xlColClass = cols.xl !== undefined ? (XL_COLS_MAP[cols.xl] ?? '') : ''

  return (
    <div
      className={cn(
        'grid',
        baseColClass,
        smColClass,
        lgColClass,
        xlColClass,
        GAP_MAP[gap],
        className
      )}
    >
      {children}
    </div>
  )
}
