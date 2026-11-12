import { readFileSync } from 'fs'
import path from 'path'

import { render } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import { TesterUpdateEmail } from '@/lib/email/templates/tester-update'

// Obviously fake, shaped like a real one-tap link. Real tokens never live here.
const LINK = `https://theblacqlist.com/t#${'not-a-real-token-'.padEnd(43, '0')}`

/** Called as a plain function so this file can stay `.ts` (see vitest.config.ts). */
function renderUpdate(props: Parameters<typeof TesterUpdateEmail>[0]) {
  return render(TesterUpdateEmail(props))
}

const TEMPLATE_SOURCE = readFileSync(
  path.resolve(process.cwd(), 'lib/email/templates/tester-update.tsx'),
  'utf8'
)

const VARIANTS = ['owner', 'supporter'] as const

describe.each(VARIANTS)('the %s tester update email', (variant) => {
  it('puts the fresh one-tap link in the button, fragment intact', async () => {
    const html = await renderUpdate({ variant, testerLink: LINK })
    expect(html).toContain(`href="${LINK}"`)
    expect(html).toContain('Pick up where you left off')
  })

  it('asks them to finish the walk, and names the final note', async () => {
    const html = await renderUpdate({ variant, testerLink: LINK })
    expect(html).toContain('Finish your walk')
    expect(html).toContain('would you tell a friend')
  })

  it('prompts them to explore The Collective, framed as a first look', async () => {
    const html = await renderUpdate({ variant, testerLink: LINK })
    expect(html).toContain('Explore The Collective')
    expect(html).toContain('href="https://theblacqlist.com/flow-map"')
    expect(html).toContain('before the public does')
    expect(html).not.toMatch(/open yet/)
    expect(html).not.toMatch(/join the list/i)
  })

  it('uses the opening date when given', async () => {
    const html = await renderUpdate({
      variant,
      testerLink: LINK,
      openingDate: 'Tuesday, 17 November',
    })
    expect(html).toContain('We open to everyone on Tuesday, 17 November.')
  })

  it('says "soon" with no date, and leaves nothing dangling', async () => {
    for (const openingDate of [undefined, null, '', '   ']) {
      const html = await renderUpdate({ variant, testerLink: LINK, openingDate })
      expect(html).toContain('We open to everyone soon.')
      expect(html).not.toMatch(/everyone on ?(undefined|null|\.)/)
    }
  })

  it('greets by name, or reads cleanly without one', async () => {
    expect(await renderUpdate({ variant, testerLink: LINK, firstName: 'Andrea' })).toContain(
      'Thank you, Andrea.'
    )
    const html = await renderUpdate({ variant, testerLink: LINK })
    expect(html).toContain('Thank you.')
    expect(html).not.toMatch(/Thank you, ?(undefined|null|\.)/)
  })

  it('points at both feedback channels', async () => {
    const html = await renderUpdate({ variant, testerLink: LINK })
    expect(html).toContain('Report a problem')
    expect(html).toContain('reply to this email')
  })

  it('never calls anything a trial, and renders no broken hrefs', async () => {
    const html = await renderUpdate({ variant, testerLink: LINK })
    expect(html).not.toMatch(/\btrial\b/i)
    expect(html).not.toMatch(/href="[^"]*(undefined|null)/)
  })
})

describe('the owner and supporter difference', () => {
  it('reminds an owner about the free month on any tier, which can be held', async () => {
    const html = await renderUpdate({ variant: 'owner', testerLink: LINK })
    expect(html).toMatch(/one month of The BLACQList free on any tier/i)
    expect(html).toMatch(/save it until the plan you want opens/i)
  })

  it('makes a supporter no offer', async () => {
    const html = await renderUpdate({ variant: 'supporter', testerLink: LINK })
    expect(html).not.toMatch(/free on any tier/i)
    expect(html).not.toMatch(/\bmonth\b/i)
  })
})

describe('the template source', () => {
  it('hardcodes no token-shaped string', () => {
    expect(TEMPLATE_SOURCE).not.toMatch(/preview=[A-Za-z0-9]/i)
    expect(TEMPLATE_SOURCE).not.toMatch(/\/t#[A-Za-z0-9_-]{20}/)
  })

  it('leaves testerLink and variant required, with no default', () => {
    expect(TEMPLATE_SOURCE).toMatch(/^\s+testerLink: string$/m)
    expect(TEMPLATE_SOURCE).not.toMatch(/testerLink\?:/)
    expect(TEMPLATE_SOURCE).not.toMatch(/testerLink\s*=/)
    expect(TEMPLATE_SOURCE).toMatch(/^\s+variant: TesterInviteVariant$/m)
    expect(TEMPLATE_SOURCE).not.toMatch(/variant\?:/)
    expect(TEMPLATE_SOURCE).not.toMatch(/variant\s*=\s*'/)
  })

  it('never hardcodes the opening date, which has moved before', () => {
    // Comments may cite an example date; only the copy itself is checked.
    const code = TEMPLATE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\b(1[0-9]|2[0-9]|3[01]|[1-9]) (November|December)\b/)
  })

  it('uses the shared tester email shell and styling', () => {
    expect(TEMPLATE_SOURCE).toContain('tester-email-parts')
    expect(TEMPLATE_SOURCE).toContain('TesterEmailShell')
  })
})
