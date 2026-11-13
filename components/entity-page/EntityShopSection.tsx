import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { ShoppingBag } from 'lucide-react'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import type { EntityShop, EntityShopItem } from '@/types'

interface Props {
  shop: EntityShop | null | undefined
  bare?: boolean
}

const KIND_LABEL: Record<EntityShopItem['kind'], string> = {
  product: 'Product',
  service: 'Service',
}

function ShopCard({ item }: { item: EntityShopItem }) {
  return (
    <li>
      <Link
        href={item.href as Route}
        className="group block rounded-xl overflow-hidden border border-charcoal/10 bg-white hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50"
      >
        <span className="relative block aspect-square bg-pale-lavender">
          {item.image ? (
            <Image
              src={item.image.src}
              alt={item.image.alt}
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              unoptimized={item.image.unoptimized}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <ShoppingBag className="size-8 text-amber/70" aria-hidden="true" />
            </span>
          )}
          <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 font-subhead text-[11px] font-semibold text-charcoal">
            {KIND_LABEL[item.kind]}
          </span>
        </span>
        <span className="block p-3">
          <span className="block font-subhead text-sm font-semibold text-brand-black group-hover:text-amber transition-colors line-clamp-2">
            {item.name}
          </span>
          {item.priceLabel && (
            <span className="block font-subhead text-sm font-bold text-amber mt-1">
              {item.priceLabel}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

/**
 * Marketplace items on the profile (ticket 186; display here, the loader in
 * Phase 3). Growth+ with the marketplace flag on. Hidden until a loader
 * provides `shop`. Compact cards, not ProductCard — that one needs absolute
 * URLs and its own grid.
 */
export function EntityShopSection({ shop, bare = false }: Props) {
  if (!shop || shop.items.length === 0) return null

  return (
    <section
      aria-labelledby="shop-heading"
      className={bare ? undefined : 'bg-cream py-12 md:py-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        {bare ? (
          <TemplateSectionHeading
            kicker="Take something home"
            heading="Shop"
            headingId="shop-heading"
          />
        ) : (
          <h2
            id="shop-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
          >
            Shop
          </h2>
        )}
        <ul
          className={
            bare
              ? 'grid grid-cols-2 sm:grid-cols-3 gap-4'
              : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4'
          }
        >
          {shop.items.map((item) => (
            <ShopCard key={item.id} item={item} />
          ))}
        </ul>
        <div className="mt-6">
          <Link
            href={shop.shopAllHref as Route}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full border-[1.5px] border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Shop all{shop.total > shop.items.length ? ` (${shop.total})` : ''} →
          </Link>
        </div>
      </div>
    </section>
  )
}
