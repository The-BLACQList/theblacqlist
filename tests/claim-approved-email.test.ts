// Ticket 158 (founder pick 5A): the claim-approved email uses the same
// "You manage this page." line as the approved email and the dashboard, and
// invites the owner to post a job only while Jobs is open.

import { describe, expect, it } from 'vitest'
import { render } from '@react-email/components'
import { ClaimApprovedEmail } from '@/lib/email/templates/claim-approved'
import { OWNER_MANAGES_LINE } from '@/lib/listings/ownerLine'

const LISTING = 'Sweet Auburn Bread Company'

describe('ClaimApprovedEmail', () => {
  it('carries the shared owner line', async () => {
    const html = await render(ClaimApprovedEmail({ listingName: LISTING }))
    expect(html).toContain(OWNER_MANAGES_LINE)
  })

  it('leaves out the job invite while Jobs is closed', async () => {
    const html = await render(ClaimApprovedEmail({ listingName: LISTING }))
    expect(html).not.toContain('You can now post a job for it.')
    expect(html).not.toContain('/add-job')
  })

  it('shows the job line and a Post a job button while Jobs is open', async () => {
    const html = await render(
      ClaimApprovedEmail({ listingName: LISTING, siteUrl: 'https://preview.example.com', postJobOpen: true })
    )
    expect(html).toContain('You can now post a job for it.')
    expect(html).toContain('href="https://preview.example.com/add-job"')
  })
})
