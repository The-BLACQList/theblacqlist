import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface CategoryTile {
  name: string
  slug: string
  count: number
}

interface Props {
  categories: CategoryTile[]
}

/**
 * Bento category grid with live counts — the biggest category earns the big
 * tile (editorial hierarchy, not decoration). Designed dark/gold surfaces
 * until commissioned category photography lands (LCI phase: photography is
 * the founder's sourcing lane; we never substitute stock).
 */
export function HomeCategories({ categories }: Props) {
  if (categories.length === 0) return null
  const [feature, ...rest] = categories
  if (!feature) return null

  return (
    <section aria-labelledby="categories-heading" className="bg-off-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
          Explore by category
        </p>
        <h2 id="categories-heading" className="font-headline text-[26px] md:text-[32px] text-brand-black">
          What are you looking for?
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[110px] md:auto-rows-[130px] gap-2.5 mt-6">
          {[feature, ...rest.slice(0, 6)].map((category, i) => (
            <Link
              key={category.slug}
              href={`/discover?category=${category.slug}`}
              className={cn(
                'group relative flex flex-col justify-end rounded-xl bg-deep-bg p-4 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
                i === 0 && 'col-span-2 row-span-2'
              )}
            >
              <span
                className="absolute inset-0 opacity-[0.22] group-hover:opacity-[0.35] transition-opacity duration-200"
                aria-hidden="true"
                style={{
                  backgroundImage: [
                    'radial-gradient(circle at 24% 30%, var(--color-gold) 1.4px, transparent 2.3px)',
                    'radial-gradient(circle at 70% 64%, var(--color-gold) 1.4px, transparent 2.3px)',
                    'radial-gradient(circle at 42% 86%, var(--color-gold) 1.4px, transparent 2.3px)',
                  ].join(', '),
                  backgroundSize: i === 0 ? '300px 300px' : '190px 190px',
                }}
              />
              <span
                className={cn(
                  'relative font-headline text-white group-hover:text-light-gold transition-colors duration-150 leading-tight',
                  i === 0 ? 'text-[24px] md:text-[30px]' : 'text-[16px] md:text-[18px]'
                )}
              >
                {category.name}
              </span>
              <span className="relative font-subhead text-xs font-semibold text-gold mt-0.5">
                {category.count.toLocaleString()} {category.count === 1 ? 'business' : 'businesses'}
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-4">
          <Link
            href="/discover"
            className="font-subhead text-sm font-bold text-amber hover:text-brand-black underline underline-offset-2 transition-colors duration-150"
          >
            All categories on Discover →
          </Link>
        </p>
      </div>
    </section>
  )
}
