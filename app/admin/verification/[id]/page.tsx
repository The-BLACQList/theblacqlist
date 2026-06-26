import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { FileText, ImageIcon } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import { VerificationDecisionForm } from '@/components/admin/VerificationDecisionForm'

export const metadata: Metadata = { title: 'Verify Listing' }

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-4 py-3 border-b border-charcoal/5 last:border-0">
      <dt className="w-40 shrink-0 font-subhead text-xs text-charcoal-soft uppercase tracking-wide pt-0.5">
        {label}
      </dt>
      <dd className="font-body text-sm text-brand-black">
        {value ?? <span className="text-charcoal-faint">—</span>}
      </dd>
    </div>
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function VerificationDetailPage({ params }: Props) {
  const { id } = await params
  await requireAdmin()

  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select(
      `
      id, name, slug, status, trust_tier, verification_status,
      verification_docs, verification_notes, verified_at, verified_by,
      listing_details_business(description, phone, email, website_url)
    `
    )
    .eq('id', id)
    .maybeSingle()

  if (!listing) notFound()

  const details = listing.listing_details_business as {
    description: string | null
    phone: string | null
    email: string | null
    website_url: string | null
  } | null

  const pendingQueueItem = await serviceClient
    .from('moderation_queue')
    .select('id, created_at')
    .eq('entity_id', id)
    .eq('queue_type', 'verification')
    .in('status', ['pending', 'assigned'])
    .order('created_at', { ascending: false })
    .maybeSingle()

  const queueItem = pendingQueueItem.data

  // Generate signed URLs for uploaded docs
  const docPaths: string[] = Array.isArray(listing.verification_docs)
    ? (listing.verification_docs as string[])
    : []
  const signedDocs: { path: string; url: string }[] = []
  for (const path of docPaths) {
    const { data } = await serviceClient.storage.from('receipt-uploads').createSignedUrl(path, 3600)
    if (data?.signedUrl) signedDocs.push({ path, url: data.signedUrl })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/verification"
            className="font-subhead text-xs text-charcoal-soft hover:text-brand-black mb-2 inline-block"
          >
            ← Back to verification queue
          </Link>
          <h1 className="font-headline text-2xl text-brand-black">{listing.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <AdminStatusBadge status={listing.trust_tier} />
            {listing.verification_status && (
              <AdminStatusBadge status={listing.verification_status} />
            )}
          </div>
        </div>
        <Link
          href={`/admin/entities/${listing.id}`}
          className="shrink-0 font-subhead text-xs text-charcoal-soft hover:text-brand-black"
        >
          Full entity →
        </Link>
      </div>

      {/* Listing info */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-headline text-base text-brand-black mb-4">Listing details</h2>
        <dl>
          <Row label="Status" value={listing.status} />
          <Row label="Trust tier" value={listing.trust_tier} />
          <Row label="Verification" value={listing.verification_status ?? 'Not yet set'} />
          <Row label="Email" value={details?.email} />
          <Row label="Phone" value={details?.phone} />
          <Row label="Website" value={details?.website_url} />
          {listing.verification_notes && (
            <Row label="Admin notes" value={listing.verification_notes} />
          )}
          {listing.verified_at && (
            <Row
              label="Verified at"
              value={new Date(listing.verified_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}
        </dl>
      </div>

      {/* Verification documents */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-headline text-base text-brand-black mb-4">
          Verification documents
          {docPaths.length > 0 && (
            <span className="ml-2 font-subhead text-xs text-charcoal-soft font-normal">
              {docPaths.length} file{docPaths.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
        {signedDocs.length === 0 ? (
          <p className="font-body text-sm text-charcoal-soft">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {signedDocs.map(({ path, url }) => {
              const filename = path.split('/').pop() ?? path
              const isPdf = filename.toLowerCase().endsWith('.pdf')
              return (
                <li
                  key={path}
                  className="flex items-center gap-3 rounded-lg border border-charcoal/10 px-4 py-2.5"
                >
                  {isPdf ? (
                    <FileText className="size-4 shrink-0 text-charcoal-faint" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="size-4 shrink-0 text-charcoal-faint" aria-hidden="true" />
                  )}
                  <span className="flex-1 min-w-0 font-mono text-xs text-charcoal-soft truncate">
                    {filename}
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-subhead text-xs font-semibold text-amber hover:text-light-gold"
                  >
                    View →
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Description */}
      {details?.description && (
        <div className="rounded-xl border border-charcoal/10 bg-white p-6">
          <h2 className="font-headline text-base text-brand-black mb-3">Description</h2>
          <p className="font-body text-sm text-charcoal-soft leading-relaxed">
            {details.description}
          </p>
        </div>
      )}

      {/* Decision form — only show if there's an open queue item */}
      {queueItem ? (
        <div className="rounded-xl border border-charcoal/10 bg-white p-6">
          <h2 className="font-headline text-base text-brand-black mb-1">Verification decision</h2>
          <p className="font-body text-xs text-charcoal-soft mb-4">
            Requested{' '}
            {new Date(queueItem.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <VerificationDecisionForm listingId={listing.id} />
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-8 text-center">
          <p className="font-subhead text-sm text-charcoal-soft">
            No pending verification request for this listing.
          </p>
        </div>
      )}
    </div>
  )
}
