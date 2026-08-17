import Link from 'next/link'
import { Store, ArrowRight } from 'lucide-react'

/**
 * Shown on /dashboard/products/new and /dashboard/services/new when the signed-in
 * owner has no listings at all.
 *
 * Without it, both pages rendered the full form with a REQUIRED listing selector
 * whose only option was "Select a listing" — a screen the owner cannot submit and
 * that never says why. The listing is the storefront; a product has nothing to
 * attach to until one exists. This is the missing first step of the vendor
 * onboarding path, not a validation message.
 */
export function NoListingsNotice({ kind }: { kind: 'product' | 'service' }) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
      <Store className="size-12 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
      <h2 className="font-headline text-lg text-brand-black">Add your business first</h2>
      <p className="font-body text-sm text-charcoal-soft mt-2 max-w-sm mx-auto leading-relaxed">
        {kind === 'product' ? 'Products' : 'Services'} live on a business page — that page is your
        storefront. Add your business, then come back and list your first {kind}.
      </p>
      <Link
        href="/add-business"
        className="inline-flex items-center gap-2 h-10 px-5 mt-5 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors min-h-[44px]"
      >
        Add your business <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
      <p className="font-body text-xs text-charcoal-faint mt-4">
        Already submitted one?{' '}
        <Link href="/dashboard/pages" className="underline hover:text-charcoal">
          Check its review status
        </Link>
        .
      </p>
    </div>
  )
}
