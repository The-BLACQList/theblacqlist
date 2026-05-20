import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

interface Props {
  searchParams: Promise<{ name?: string }>
}

export const metadata = {
  title: 'Submission Received — The BLACQList',
}

export default async function SubmittedPage({ searchParams }: Props) {
  const { name } = await searchParams
  const listingName = name ? decodeURIComponent(name) : 'Your listing'

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4 flex items-center justify-center">
      <div className="max-w-[560px] w-full mx-auto text-center py-12">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-gold/15">
            <CheckCircle className="h-8 w-8 text-amber-gold" aria-hidden="true" />
          </div>
        </div>

        <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-amber-gold mb-3">
          Submission received
        </p>

        <h1 className="font-headline text-3xl md:text-4xl text-brand-black mb-4">
          {listingName} is under review
        </h1>

        <p className="font-subhead text-sm text-charcoal leading-relaxed max-w-sm mx-auto mb-8">
          Our team will verify your listing before it goes live. Free listings are typically
          published within 1–3 business days. We&apos;ll be in touch if we need anything.
        </p>

        <div className="bg-white rounded-2xl border border-charcoal/10 p-5 text-left mb-8">
          <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-charcoal/50 mb-3">
            What happens next
          </p>
          <ol className="flex flex-col gap-3">
            {[
              'Our team reviews your submission for completeness.',
              'We verify that your business meets our community guidelines.',
              'Your listing goes live on The BLACQList.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-gold/15 font-subhead text-xs font-bold text-amber-gold mt-0.5">
                  {i + 1}
                </span>
                <span className="font-subhead text-sm text-charcoal">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/discover"
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand-black px-6 font-subhead text-sm font-bold text-white hover:bg-charcoal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2"
          >
            Explore the directory
          </Link>
          <Link
            href="/account"
            className="inline-flex h-11 items-center justify-center rounded-full border border-charcoal/30 px-6 font-subhead text-sm font-semibold text-charcoal hover:border-charcoal/60 hover:text-brand-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2"
          >
            My account
          </Link>
        </div>
      </div>
    </main>
  )
}
