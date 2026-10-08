'use client'

import { EditorSectionShell } from './EditorSectionShell'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'

// The partner switch (ticket 132). One column, worded by type: creators say
// they take brand deals, everyone else says they work with creators. Contact
// stays on the page's own buttons; The BLACQList makes no introductions.

interface Props {
  listingId: string
  entityType: string
  openToPartnerships: boolean
}

const COPY = {
  creator: {
    label: 'Open to brand deals',
    hint: 'Turn this on so businesses looking for creators know you take brand deals. They reach you through the contact details on your page.',
  },
  other: {
    label: 'Open to creator partnerships & sponsorships',
    hint: 'Turn this on so creators looking for partners and sponsors know you are open to it. They reach you through the contact details on your page.',
  },
} as const

export function PartnershipSection({ listingId, entityType, openToPartnerships }: Props) {
  const copy = entityType === 'creator' ? COPY.creator : COPY.other

  return (
    <EditorSectionShell title="Partnerships" listingId={listingId} action={updateListingContentAction}>
      <input type="hidden" name="open_to_partnerships_field" value="1" />
      <div className="flex items-start gap-3">
        <input
          id="partner-switch"
          name="open_to_partnerships"
          type="checkbox"
          role="switch"
          value="true"
          defaultChecked={openToPartnerships}
          aria-describedby="partner-switch-hint"
          className="mt-0.5 size-5 shrink-0 accent-amber-gold"
        />
        <div>
          <label
            htmlFor="partner-switch"
            className="font-subhead text-sm font-semibold text-brand-black"
          >
            {copy.label}
          </label>
          <p id="partner-switch-hint" className="mt-0.5 font-body text-xs text-charcoal-soft">
            {copy.hint}
          </p>
        </div>
      </div>
    </EditorSectionShell>
  )
}
