import Link from 'next/link'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { Button } from '@/components/ui/button'
import { ReportCorrectionForm } from '@/components/entity-page/ReportCorrectionForm'

export const metadata: Metadata = {
  title: 'Suggest a Correction | The BLACQList',
  description:
    'Something wrong on a listing? Tell us. Community corrections are how the directory stays accurate.',
}

// `EntityCommunityConnection` links here as `/corrections?listing={id}`, so this
// route has been reachable from every listing page while returning a 404. It
// mounts the SAME dialog and the SAME server action the listing page uses — the
// only difference is the trigger, which is a primary CTA here because reporting
// is the whole point of the page rather than a footnote under a profile.

interface PageProps {
  searchParams: Promise<{ listing?: string }>
}

const TRIGGER_CLASS =
  'inline-flex items-center gap-2 rounded-full bg-amber-gold px-6 py-2.5 min-h-[44px] font-body font-bold text-brand-black hover:bg-light-gold transition-colors'

export default async function CorrectionsPage({ searchParams }: PageProps) {
  const { listing: listingId } = await searchParams

  // Resolve the listing so the page can name it. A correction on "this business"
  // that never says which business is how a reporter loses confidence the report
  // landed anywhere. Published-only mirrors the check `submitCorrectionAction`
  // does server-side, so the form is never offered for something the action
  // will refuse.
  let listing: { id: string; name: string } | null = null
  if (listingId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('listings')
      .select('id, name')
      .eq('id', listingId)
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle()
    listing = data ?? null
  }

  return (
    <>
      <Section variant="deep-bg" as="header">
        <div className="max-w-2xl">
          <h1 className="font-headline text-3xl md:text-5xl font-bold text-white leading-tight text-balance">
            Suggest a correction
          </h1>
          <p className="font-subhead text-base md:text-lg text-off-white/90 mt-4 leading-relaxed">
            Business hours change. Places move. Numbers get disconnected. If something on a listing
            is wrong, tell us and we&rsquo;ll look into it — you don&rsquo;t need an account.
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-2xl">
          {listing ? (
            <>
              <SectionHeading subtitle={listing.name}>
                What&rsquo;s wrong with this listing?
              </SectionHeading>
              <p className="font-subhead text-base text-charcoal leading-relaxed mt-4">
                Pick everything that looks off. If none of the options fit, choose{' '}
                <strong>Other</strong> and describe the problem in your own words.
              </p>
              <div className="mt-6">
                <ReportCorrectionForm
                  listingId={listing.id}
                  triggerClassName={TRIGGER_CLASS}
                  triggerLabel="Report a problem"
                />
              </div>
            </>
          ) : (
            <>
              <SectionHeading
                subtitle={
                  listingId
                    ? 'We couldn’t find that listing — it may have been removed or is no longer published.'
                    : 'Corrections are tied to a specific listing.'
                }
              >
                {listingId ? 'That listing isn’t available' : 'Find the listing first'}
              </SectionHeading>
              <p className="font-subhead text-base text-charcoal leading-relaxed mt-4">
                Search for the business, open its page, and use{' '}
                <strong>Suggest a correction</strong> at the bottom. That way your report arrives
                attached to the right record and our team can act on it directly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button
                  asChild
                  className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
                >
                  <Link href="/search">Search listings</Link>
                </Button>
                <Button
                  asChild
                  className="border border-charcoal/25 text-brand-black bg-transparent hover:bg-charcoal/5 rounded-full px-6 py-2.5 min-h-[44px] h-auto"
                >
                  <Link href="/discover">Browse the directory</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section variant="cream">
        <div className="max-w-2xl">
          <SectionHeading subtitle="So you know what you're signing up for.">
            What happens next
          </SectionHeading>
          <ul className="mt-6 space-y-3 font-subhead text-sm md:text-base text-charcoal leading-relaxed">
            {[
              'Your report goes into our moderation queue with whatever you selected and wrote.',
              'A person reviews it. We don’t auto-edit listings from reports.',
              'If it checks out, we update the listing. If we can’t confirm it, we leave it alone.',
              'Reports are anonymous unless you’re signed in, and we never publish who reported what.',
            ].map((line) => (
              <li key={line} className="pl-5 relative">
                <span
                  className="absolute left-0 top-[0.6em] size-1.5 rounded-full bg-amber-gold"
                  aria-hidden="true"
                />
                {line}
              </li>
            ))}
          </ul>
          <p className="font-subhead text-sm text-charcoal-soft leading-relaxed mt-6">
            Own this business?{' '}
            <Link
              href="/claim"
              className="text-amber hover:text-light-gold underline underline-offset-2 font-semibold"
            >
              Claim your page
            </Link>{' '}
            and you can edit it yourself instead of reporting it. More on{' '}
            <Link
              href="/about/trust"
              className="text-amber hover:text-light-gold underline underline-offset-2 font-semibold"
            >
              how trust works
            </Link>
            .
          </p>
        </div>
      </Section>
    </>
  )
}
