import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IS_PRODUCTION } from '@/lib/env'
import { EXAMPLE_BANNER_TEXT } from '@/lib/example/copy'
import { EXAMPLE_NAME, EXAMPLE_VARIANTS, EXAMPLE_VARIANT_LABEL } from '@/lib/example/fixtures'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Sample pages: ${EXAMPLE_NAME}`,
}

const BLURB: Record<(typeof EXAMPLE_VARIANTS)[number], string> = {
  storefront: 'A café with merch: menu, shop, reservations, two more locations.',
  professional: 'A consultancy: services with prices, discovery calls, a team, a rate card.',
  creative: 'A design studio: portfolio, commissions, limited-edition prints.',
}

/** Index of the three sample pages. Same production rule as the pages themselves. */
export default function ExampleIndexPage() {
  if (IS_PRODUCTION) notFound()

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16 lg:px-8">
      <p className="font-subhead text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        Sample pages
      </p>
      <h1 className="mt-3 font-headline text-3xl md:text-4xl">{EXAMPLE_NAME}</h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-charcoal [text-wrap:pretty]">
        {EXAMPLE_BANNER_TEXT} Each page below shows what a Premium page looks like with every
        feature filled, one per layout.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        {EXAMPLE_VARIANTS.map((variant) => (
          <li key={variant}>
            <Link
              href={`/example/${variant}`}
              className="block h-full rounded-2xl border border-pale-lavender bg-cream p-5 transition-colors hover:border-gold"
            >
              <span className="font-headline text-xl">{EXAMPLE_VARIANT_LABEL[variant]}</span>
              <span className="mt-2 block text-sm leading-relaxed text-charcoal-soft">
                {BLURB[variant]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
