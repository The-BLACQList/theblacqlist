// =============================================================================
// Entity approved email — renders, and links somewhere real either way
// =============================================================================
// The listing URL is optional because the action can only build it when the
// listing carries both a slug and an entity type. Both branches have to
// produce a working button: a link to the live page when we have one, the
// dashboard when we don't. A template that silently emitted
// `href="/online/undefined/undefined"` would still render, still send, and
// still look fine in a preview — the owner is the one who finds the 404.
//
// This file is `.ts`, not `.tsx`: vitest.config.ts includes only
// `tests/**/*.test.ts`. The component is called as a function rather than
// written as JSX, which is all `render` needs.

import { describe, expect, it } from 'vitest'
import { render } from '@react-email/components'
import { EntityApprovedEmail } from '@/lib/email/templates/entity-approved'

const LISTING = 'Sweet Auburn Bread Company'
const LISTING_URL = 'https://theblacqlist.com/atlanta/business/sweet-auburn-bread-company'

describe('with a listing URL', () => {
  it('points the button at the live page', async () => {
    const html = await render(EntityApprovedEmail({ listingName: LISTING, listingUrl: LISTING_URL }))
    expect(html).toContain(`href="${LISTING_URL}"`)
    expect(html).toContain('View your listing')
  })

  it('names the business in the heading and the preview text', async () => {
    const html = await render(EntityApprovedEmail({ listingName: LISTING, listingUrl: LISTING_URL }))
    expect(html).toContain(LISTING)
  })

  it('says the site is still gated — the owner may need to sign in to see it', async () => {
    // This sentence is the reason the template exists this week rather than
    // after the flip. Without it an owner clicks through, lands on
    // /coming-soon, and concludes the approval did not work.
    const html = await render(EntityApprovedEmail({ listingName: LISTING, listingUrl: LISTING_URL }))
    expect(html).toMatch(/private preview/i)
    expect(html).toMatch(/signed in/i)
  })
})

describe('without a listing URL', () => {
  it('falls back to the dashboard rather than emitting a broken link', async () => {
    const html = await render(EntityApprovedEmail({ listingName: LISTING }))
    expect(html).toContain('href="https://theblacqlist.com/dashboard"')
    expect(html).toContain('Go to your dashboard')
    expect(html).not.toContain('View your listing')
  })

  it('never renders undefined or null into an href', async () => {
    const html = await render(EntityApprovedEmail({ listingName: LISTING, listingUrl: null }))
    expect(html).not.toMatch(/href="[^"]*(undefined|null)/)
  })
})

describe('house style', () => {
  it('carries the wordmark, the gold button, and the support address', async () => {
    const html = await render(EntityApprovedEmail({ listingName: LISTING, listingUrl: LISTING_URL }))
    expect(html).toContain('THE BLACQLIST')
    expect(html).toContain('#8F6600')
    expect(html).toContain('mailto:support@theblacqlist.com')
  })

  it('honours a non-default siteUrl everywhere it builds a link', async () => {
    const html = await render(
      EntityApprovedEmail({ listingName: LISTING, siteUrl: 'https://preview.example.com' })
    )
    expect(html).toContain('https://preview.example.com/dashboard')
    expect(html).not.toContain('theblacqlist.com/dashboard')
  })
})
