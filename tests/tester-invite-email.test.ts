import { readFileSync } from 'fs'
import path from 'path'

import { render } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import { TesterInviteEmail } from '@/lib/email/templates/tester-invite'

// An obviously fake stand-in, shaped like a real one-tap link (43 base64url
// characters in the fragment). A real token never appears in any file in this
// repo. It is pasted into /admin/email-preview at send time.
const FAKE_TOKEN = 'not-a-real-token-'.padEnd(43, '0')
const LINK = `https://theblacqlist.com/t#${FAKE_TOKEN}`

/**
 * The component is called as a plain function rather than written as JSX so
 * this file can stay `.ts`. vitest.config.ts includes only `tests/**\/*.test.ts`.
 * Widening it to `.tsx` to accommodate one test would change what the whole
 * suite picks up.
 */
function renderInvite(props: Parameters<typeof TesterInviteEmail>[0]) {
  return render(TesterInviteEmail(props))
}

const TEMPLATE_SOURCE = readFileSync(
  path.resolve(process.cwd(), 'lib/email/templates/tester-invite.tsx'),
  'utf8'
)
const PARTS_SOURCE = readFileSync(
  path.resolve(process.cwd(), 'lib/email/templates/tester-email-parts.tsx'),
  'utf8'
)

// Everything the two variants share. Each block below runs once per variant so
// a supporter-only regression cannot hide behind a green owner run.
const VARIANTS = ['owner', 'supporter'] as const

describe.each(VARIANTS)('the %s tester invite email', (variant) => {
  it('fake token is the shape the admin form accepts', () => {
    expect(FAKE_TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('puts the one-tap link it was given in the button, fragment intact', async () => {
    const html = await renderInvite({ variant, testerLink: LINK })
    expect(html).toContain(`href="${LINK}"`)
    expect(html).toContain('Start here')
  })

  it('describes the one-tap flow, not the old sign-up flow', async () => {
    const html = await renderInvite({ variant, testerLink: LINK })
    expect(html).toMatch(/One tap and you(&#x27;|&apos;|’|&rsquo;)re in/)
    expect(html).toContain('No password')
    // The old invite walked people through sign-up and email confirmation,
    // and warned about opening it in the same browser. None of that happens
    // on a one-tap link.
    expect(html).not.toContain('Confirm your email')
    expect(html).not.toMatch(/same browser/i)
    expect(html).not.toContain('?preview=')
  })

  it('says the link lasts 14 days and resumes where they left off', async () => {
    // lib/tester/links.ts: TESTER_LINK_TTL_DAYS = 14.
    const html = await renderInvite({ variant, testerLink: LINK })
    expect(html).toContain('14 days')
    expect(html).toContain('pick up where you left off')
  })

  it('greets by name when one is given', async () => {
    const html = await renderInvite({ variant, testerLink: LINK, firstName: 'Andrea' })
    expect(html).toContain('Andrea')
  })

  it('reads cleanly with no name, no dangling comma', async () => {
    const html = await renderInvite({ variant, testerLink: LINK })
    expect(html).toMatch(/You(&#x27;|&apos;|')re in early\./)
    expect(html).not.toMatch(/in early, ?(undefined|null|,)/)
  })

  it('points at both feedback channels: Report a problem and a reply', async () => {
    const html = await renderInvite({ variant, testerLink: LINK })
    expect(html).toContain('Report a problem')
    expect(html).toContain('reply to this email')
  })

  it('invites them to explore The Collective, framed as a first look', async () => {
    // [Decision — founder, 2026-11-12]: /flow-map is still behind
    // FEATURE_COLLECTIVE_OPEN, so the copy must read true on the cover page.
    const html = await renderInvite({ variant, testerLink: LINK })
    expect(html).toContain('Explore The Collective')
    expect(html).toContain('href="https://theblacqlist.com/flow-map"')
    expect(html).toMatch(/isn(&#x27;|&apos;|’|&rsquo;)t open yet/)
  })

  it('follows the site URL it is given for The Collective link', async () => {
    const html = await renderInvite({
      variant,
      testerLink: LINK,
      siteUrl: 'https://staging.example.com/',
    })
    expect(html).toContain('href="https://staging.example.com/flow-map"')
  })

  it('never calls anything a trial', async () => {
    // The free month is a month on a tier, not a trial. "Tour" is allowed
    // now: the guide is real and /t itself says "open a short tour".
    const html = await renderInvite({ variant, testerLink: LINK })
    expect(html).not.toMatch(/\btrial\b/i)
  })

  it('renders no broken hrefs', async () => {
    const html = await renderInvite({ variant, testerLink: LINK })
    expect(html).not.toMatch(/href="[^"]*(undefined|null)/)
  })
})

describe('the owner variant', () => {
  it('walks the owner path: pick the owner card, claim or make a page', async () => {
    const html = await renderInvite({ variant: 'owner', testerLink: LINK })
    expect(html).toContain('I own a business')
    expect(html).toContain('Claim your page')
    expect(html).not.toMatch(/here to discover/i)
  })

  it('names the compensation: one free month on any tier', async () => {
    // [Decision — founder, 2026-09-19]. "Any tier" is the phrase that matters;
    // the owner must not read it as a Starter-only offer.
    const html = await renderInvite({ variant: 'owner', testerLink: LINK })
    expect(html).toMatch(/one month of The BLACQList free on any tier/i)
  })

  it('ties the free month to finishing the guide, and it can be held', async () => {
    // [Decision — founder, 2026-10-10]: only testers who finish the walk get
    // it, and they can save it for the plan they want.
    const html = await renderInvite({ variant: 'owner', testerLink: LINK })
    expect(html).toMatch(/Finish the guide and you get one month/i)
    expect(html).toMatch(/save it until the plan you want opens/i)
  })
})

describe('the supporter variant', () => {
  it('makes no compensation offer', async () => {
    // The free month is an owner thing. A supporter has nothing to subscribe to.
    const html = await renderInvite({ variant: 'supporter', testerLink: LINK })
    expect(html).not.toMatch(/free on any tier/i)
    expect(html).not.toMatch(/\bmonth\b/i)
  })

  it('walks the guide steps the rail actually has', async () => {
    // Mirrors TOUR_STEP_COPY in lib/tour/verify.ts.
    const html = await renderInvite({ variant: 'supporter', testerLink: LINK })
    expect(html).toContain('Search for something')
    expect(html).toContain('Save one')
    expect(html).toContain('on the map')
    expect(html).toContain('collection')
    expect(html).toContain('Leave a review')
    expect(html).toContain('out of date')
    // The owner instructions would send a supporter down the add-business path.
    expect(html).not.toContain('I own a business')
    expect(html).not.toContain('Claim your page')
  })

  it('promises nothing the product cannot do this week', async () => {
    const html = await renderInvite({ variant: 'supporter', testerLink: LINK })
    // The categories picked at onboarding are not saved, so nothing is
    // personalised. Following does not exist. Both would be broken promises.
    expect(html).not.toMatch(/personali[sz]/i)
    expect(html).not.toMatch(/\bfollow/i)
  })
})

describe('the template source', () => {
  it.each([
    ['tester-invite.tsx', TEMPLATE_SOURCE],
    ['tester-email-parts.tsx', PARTS_SOURCE],
  ])('%s hardcodes no token-shaped string', (_label, source) => {
    // The same check the pre-send hygiene rule runs on the diff.
    expect(source).not.toMatch(/preview=[A-Za-z0-9]/i)
    expect(source).not.toMatch(/\/t#[A-Za-z0-9_-]{20}/)
  })

  it('leaves testerLink required, with no default', () => {
    // A default would be a token living in the file. Required-with-no-default
    // makes forgetting it a compile error instead.
    expect(TEMPLATE_SOURCE).toMatch(/testerLink: string$/m)
    expect(TEMPLATE_SOURCE).not.toMatch(/testerLink\?:/)
    expect(TEMPLATE_SOURCE).not.toMatch(/testerLink\s*=/)
  })

  it('leaves variant required, with no default', () => {
    // Defaulting to owner would quietly send the add-your-business copy to a
    // supporter. A caller has to say which audience they mean.
    expect(TEMPLATE_SOURCE).toMatch(/^\s+variant: TesterInviteVariant$/m)
    expect(TEMPLATE_SOURCE).not.toMatch(/variant\?:/)
    expect(TEMPLATE_SOURCE).not.toMatch(/variant\s*=\s*'/)
  })

  it('keeps the house style: gold wordmark, gold pill button, cream ground', () => {
    // The styles live in the shared parts file, which both tester emails use.
    expect(TEMPLATE_SOURCE).toContain('tester-email-parts')
    expect(PARTS_SOURCE).toContain('#C4A065') // wordmark gold
    expect(PARTS_SOURCE).toContain('#8F6600') // button gold
    expect(PARTS_SOURCE).toContain('#F5F5F0') // cream
    expect(PARTS_SOURCE).toContain('#08080A') // header black
  })
})
