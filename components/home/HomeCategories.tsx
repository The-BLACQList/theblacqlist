import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CATEGORY_PHOTOS } from '@/lib/design/surfaces'
import { PhotoPanelCaption } from '@/components/media/PhotoPanelCaption'
import { PhotoPanelGround } from '@/components/media/PhotoPanelGround'

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
 * tile (editorial hierarchy, not decoration).
 *
 * Each tile is a full-bleed frame with a feathered caption band across its
 * bottom, so the name and count sit on brand ground that the photograph still
 * reads through. The picture is a licensed editorial photograph where one exists
 * [Decision — 2026-08-09], which overrides row 2 of the placement table in
 * photographic-style-direction.md ("categories grid stays text-only"). Only
 * nine of twenty-five top-level categories are mapped, so most days some tiles
 * are photographic and some are the ember wash — that mix is the intended end
 * state, not a gap to close. See `CATEGORY_PHOTOS`.
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

        {/* Rows are set by the *worst* tile rather than the typical one. The
            caption is content-height, so a two-line name ("Social Media &
            Marketing") makes it ~110px where a one-line name makes it ~78px.
            190/200 leaves the shortest picture ≥88px of open frame above the
            band at every width. The feature tile spans two rows and clears
            easily. */}
        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[190px] md:auto-rows-[200px] gap-2.5 mt-6">
          {[feature, ...rest.slice(0, 8)].map((category, i) => (
            <Link
              key={category.slug}
              href={`/discover?category=${category.slug}`}
              className={cn(
                'group relative flex flex-col rounded-xl bg-deep-bg overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
                i === 0 && 'col-span-2 row-span-2'
              )}
            >
              <PhotoPanelGround
                src={CATEGORY_PHOTOS[category.slug]}
                // The feature tile spans two of four columns; the rest take one.
                sizes={
                  i === 0
                    ? '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px'
                    : '(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 320px'
                }
              />
              {/* Spacer, not a wrapper — the frame fills the whole tile behind
                  it. `min-h-0` is load-bearing: without it the flex item refuses
                  to shrink below its content and the caption is pushed out of
                  the fixed-height row. */}
              <span aria-hidden="true" className="block grow min-h-0" />
              <PhotoPanelCaption className="p-4">
                <span
                  className={cn(
                    'font-headline text-white group-hover:text-light-gold transition-colors duration-150 leading-tight line-clamp-2',
                    i === 0 ? 'text-[24px] md:text-[30px]' : 'text-[16px] md:text-[18px]'
                  )}
                >
                  {category.name}
                </span>
                <span className="font-subhead text-xs font-semibold text-gold mt-0.5">
                  {category.count.toLocaleString()}{' '}
                  {category.count === 1 ? 'business' : 'businesses'}
                </span>
              </PhotoPanelCaption>
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
