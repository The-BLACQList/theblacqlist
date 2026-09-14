import { readFileSync } from 'fs'
import path from 'path'

import { render } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import { TesterInviteEmail } from '@/lib/email/templates/tester-invite'

// An obviously fake stand-in. The real bypass token never appears in any file
// in this repo — it is typed into /admin/email-preview at send time.
const LINK = 'https://theblacqlist.com/sign-up?preview=not-a-real-token-0000'

/**
 * The component is called as a plain function rather than written as JSX so
 * this file can stay `.ts`. vitest.config.ts includes only `tests/**\/*.test.ts`
 * — widening it to `.tsx` to accommodate one test would change what the whole
 * suite picks up.
 */
function renderInvite(props: Parameters<typeof TesterInviteEmail>[0]) {
  return render(TesterInviteEmail(props))
}

const TEMPLATE_SOURCE = readFileSync(
  path.resolve(process.cwd(), 'lib/email/templates/tester-invite.tsx'),
  'utf8'
)

describe('the tester invite email', () => {
  it('puts the link it was given in the button', async () => {
    const html = await renderInvite({ previewLink: LINK })
    expect(html).toContain(`href="${LINK}"`)
    expect(html).toContain('Start here')
  })

  it('does not mangle the query string', async () => {
    const html = await renderInvite({ previewLink: LINK })
    // React escapes & in attributes; the ? and = must survive intact or the
    // token never reaches the gate.
    expect(html).toContain('?preview=not-a-real-token-0000')
  })

  it('greets by name when one is given', async () => {
    const html = await renderInvite({ previewLink: LINK, firstName: 'Andrea' })
    expect(html).toContain('Andrea')
  })

  it('reads cleanly with no name — no dangling comma', async () => {
    const html = await renderInvite({ previewLink: LINK })
    expect(html).toMatch(/You(&#x27;|&apos;|')re in early\./)
    expect(html).not.toMatch(/in early, ?(undefined|null|,)/)
  })

  it('carries the same-browser warning, which is the whole point of the callout', async () => {
    const html = await renderInvite({ previewLink: LINK })
    expect(html).toContain('same browser')
  })

  it('walks the five steps, and does not mention the tour or a trial', async () => {
    const html = await renderInvite({ previewLink: LINK })
    expect(html).toContain('I have a business')
    expect(html).toContain('Confirm your email')
    // The tour needs a published listing and the trial rides on the tour.
    // Neither exists for a tester starting from scratch, so promising either
    // here would be a promise the product cannot keep this week.
    expect(html).not.toMatch(/\btrial\b/i)
    expect(html).not.toMatch(/\btour\b/i)
  })

  it('renders no broken hrefs', async () => {
    const html = await renderInvite({ previewLink: LINK })
    expect(html).not.toMatch(/href="[^"]*(undefined|null)/)
  })
})

describe('the template source', () => {
  it('hardcodes no token-shaped string', () => {
    // The same check the pre-send hygiene rule runs on the diff:
    //   grep -ciE 'preview=[A-Za-z0-9]'  →  0
    expect(TEMPLATE_SOURCE).not.toMatch(/preview=[A-Za-z0-9]/i)
  })

  it('leaves previewLink required, with no default', () => {
    // A default would be a token living in the file. Required-with-no-default
    // makes forgetting it a compile error instead.
    expect(TEMPLATE_SOURCE).toMatch(/previewLink: string$/m)
    expect(TEMPLATE_SOURCE).not.toMatch(/previewLink\?:/)
    expect(TEMPLATE_SOURCE).not.toMatch(/previewLink\s*=/)
  })

  it('keeps the house style — gold wordmark, gold pill button, cream ground', () => {
    expect(TEMPLATE_SOURCE).toContain('#C4A065') // wordmark gold
    expect(TEMPLATE_SOURCE).toContain('#8F6600') // button gold
    expect(TEMPLATE_SOURCE).toContain('#F5F5F0') // cream
    expect(TEMPLATE_SOURCE).toContain('#08080A') // header black
  })
})
