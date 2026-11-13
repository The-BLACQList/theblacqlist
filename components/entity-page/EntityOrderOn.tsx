import { ExternalLink, ShoppingBag } from 'lucide-react'
import type { OrderLink } from '@/lib/listings/whereSold'

// "Order on" (owner-experience round 2, part D): one text button per delivery
// app the owner linked. Plain text and a neutral icon, never the apps' logos,
// whose brand rules limit where they can appear. The links were checked
// against each app's own domain when saved and again when read
// (lib/listings/whereSold.ts).

interface Props {
  links: readonly OrderLink[] | undefined
  businessName: string
}

export function EntityOrderOn({ links, businessName }: Props) {
  if (!links || links.length === 0) return null

  return (
    <section
      id="order-on"
      aria-labelledby="order-on-heading"
      className="scroll-mt-32 bg-white py-8 md:py-10"
    >
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="order-on-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-4"
        >
          Order on
        </h2>
        <ul className="flex flex-wrap gap-3">
          {links.map((link) => (
            <li key={link.platform}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={`Order from ${businessName} on ${link.label} (opens in a new tab)`}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-charcoal/20 bg-white px-5 font-subhead text-sm font-semibold text-brand-black hover:bg-charcoal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50"
              >
                <ShoppingBag className="size-4 text-charcoal-soft" aria-hidden="true" />
                {link.label}
                <ExternalLink className="size-3.5 text-charcoal-faint" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
