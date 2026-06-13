'use client'

import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'

interface DuplicateResult {
  id: string
  name: string
  slug: string
  entity_type: string
  trust_tier: string
  match_score: number
  cover_image_url: string | null
  city: { name: string; slug: string } | null
}

interface Props {
  duplicates: DuplicateResult[]
  onContinue: () => void
  onCancel: () => void
}

export function DuplicateWarningDialog({ duplicates, onContinue, onCancel }: Props) {
  const shown = duplicates.slice(0, 3)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-dialog-title"
      aria-describedby="dup-dialog-desc"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-charcoal/10">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="dup-dialog-title"
              className="font-headline text-lg text-brand-black leading-snug"
            >
              Similar listings found
            </h2>
            <p id="dup-dialog-desc" className="font-subhead text-xs text-charcoal/60 mt-0.5">
              We found listings with similar names. Is your business already listed?
            </p>
          </div>
        </div>

        {/* Duplicate cards */}
        <div className="flex flex-col divide-y divide-charcoal/8 max-h-[40vh] overflow-y-auto">
          {shown.map((dup) => (
            <div key={dup.id} className="flex items-center gap-3 px-5 py-3">
              <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-charcoal/10">
                {dup.cover_image_url ? (
                  <Image src={dup.cover_image_url} alt="" fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-headline text-lg text-charcoal/30">
                      {dup.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                  {dup.name}
                </p>
                {dup.city && (
                  <p className="font-subhead text-xs text-charcoal/50">{dup.city.name}</p>
                )}
                <StatusBadge tier={dup.trust_tier as Parameters<typeof StatusBadge>[0]['tier']} size="small" />
              </div>
              <Link
                href={`/claim/${dup.id}`}
                onClick={onCancel}
                className="shrink-0 font-subhead text-xs font-semibold text-amber-gold hover:text-amber-gold/80 whitespace-nowrap"
              >
                Claim →
              </Link>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-5 py-4 border-t border-charcoal/10">
          <button
            type="button"
            onClick={onContinue}
            className="h-11 w-full rounded-full bg-brand-black text-white font-subhead text-sm font-bold hover:bg-charcoal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2"
          >
            This is different — publish anyway
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 w-full rounded-full border border-charcoal/30 text-charcoal font-subhead text-sm font-semibold hover:border-charcoal/60 hover:text-brand-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
