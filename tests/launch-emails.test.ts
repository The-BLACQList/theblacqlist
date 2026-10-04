// =============================================================================
// Launch-list emails W0, W1, E1 to E4, and the coming-soon copy (pre-launch)
// =============================================================================
// What these pin down:
//   * every email renders, with its preheader, CTA link and an Unsubscribe link
//   * no postal address -> the red "POSTAL ADDRESS REQUIRED BEFORE SENDING"
//     banner; with one -> the address in the footer and no banner
//   * the header image is the hosted brand lockup unless overridden
//   * no em dashes in the copy modules (tests/email-copy-style.test.ts covers
//     templates/*.tsx only; the copy for these lives in lib/email/launch-copy.ts)
//   * COMING_SOON_OWNER_HEADLINE resolves a | b | anything-else-off
//   * the R7 consent marker and the privacy link stay on the form
//
// Rendering only. Nothing here creates a Resend client.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement, type ReactElement } from 'react'
import { render } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import { E1_COPY, E2_COPY, E3_COPY, E4_COPY, W0_COPY, w1Copy, type LaunchEmailCopy } from '@/lib/email/launch-copy'
import {
  DEFAULT_SITE_URL,
  LOCKUP_EMAIL_PATH,
  POSTAL_ADDRESS_REQUIRED_BANNER,
  type LaunchEmailFrameProps,
} from '@/lib/email/templates/launch-layout'
import { LAUNCH_W0_SUBJECT, LaunchW0OnTheListEmail } from '@/lib/email/templates/launch-w0-on-the-list'
import { LAUNCH_W1_SUBJECT, LaunchW1FirstLookEmail } from '@/lib/email/templates/launch-w1-first-look'
import { LAUNCH_E1_SUBJECT, LaunchE1LiveEmail } from '@/lib/email/templates/launch-e1-live'
import { LAUNCH_E2_SUBJECT, LaunchE2YourPageEmail } from '@/lib/email/templates/launch-e2-your-page'
import { LAUNCH_E3_SUBJECT, LaunchE3SaveEmail } from '@/lib/email/templates/launch-e3-save'
import { LAUNCH_E4_SUBJECT, LaunchE4TwoWeeksEmail } from '@/lib/email/templates/launch-e4-two-weeks'
import {
  COMING_SOON_COPY,
  CONFIRMATION_COPY,
  OWNER_HEADLINES,
  ROLE_FIELD_COPY,
  resolveOwnerHeadline,
} from '@/lib/marketing/coming-soon-copy'

const UNSUB = '{{{RESEND_UNSUBSCRIBE_URL}}}'

type Case = {
  name: string
  copy: LaunchEmailCopy
  subject: string
  element: (frame: LaunchEmailFrameProps) => ReactElement
}

const CASES: Case[] = [
  { name: 'W0', copy: W0_COPY, subject: LAUNCH_W0_SUBJECT, element: (f) => createElement(LaunchW0OnTheListEmail, f) },
  {
    name: 'W1 A',
    copy: w1Copy('A'),
    subject: LAUNCH_W1_SUBJECT,
    element: (f) => createElement(LaunchW1FirstLookEmail, { ...f, opening: 'A' }),
  },
  {
    name: 'W1 B',
    copy: w1Copy('B'),
    subject: LAUNCH_W1_SUBJECT,
    element: (f) => createElement(LaunchW1FirstLookEmail, { ...f, opening: 'B' }),
  },
  { name: 'E1', copy: E1_COPY, subject: LAUNCH_E1_SUBJECT, element: (f) => createElement(LaunchE1LiveEmail, f) },
  { name: 'E2', copy: E2_COPY, subject: LAUNCH_E2_SUBJECT, element: (f) => createElement(LaunchE2YourPageEmail, f) },
  { name: 'E3', copy: E3_COPY, subject: LAUNCH_E3_SUBJECT, element: (f) => createElement(LaunchE3SaveEmail, f) },
  { name: 'E4', copy: E4_COPY, subject: LAUNCH_E4_SUBJECT, element: (f) => createElement(LaunchE4TwoWeeksEmail, f) },
]

const decode = (html: string) =>
  html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x2F;/g, '/')

describe.each(CASES)('$name', ({ copy, subject, element }) => {
  it('uses the first subject option from the draft', () => {
    expect(subject).toBe(copy.subjects[0])
  })

  it('renders the body, CTA and an Unsubscribe link', async () => {
    const html = decode(await render(element({ unsubscribeUrl: UNSUB, postalAddress: '1 Test Street, City, ST 00000' })))
    const text = await render(element({ unsubscribeUrl: UNSUB, postalAddress: '1 Test Street' }), {
      plainText: true,
    })

    expect(html).toContain(copy.preheader)
    expect(html).toContain(`href="${copy.cta.href}"`)
    expect(html).toContain(copy.cta.label)
    for (const block of copy.body) expect(text).toContain(block.text)
    expect(html).toContain(`href="${UNSUB}"`)
    expect(html).toContain('Unsubscribe')
  })

  it('shows the postal address in the footer, and no banner, when it is set', async () => {
    const html = await render(element({ unsubscribeUrl: UNSUB, postalAddress: '1 Test Street, City, ST 00000' }))
    expect(html).toContain('1 Test Street, City, ST 00000')
    expect(html).not.toContain(POSTAL_ADDRESS_REQUIRED_BANNER)
  })

  it('carries the POSTAL ADDRESS REQUIRED banner when the address is missing or blank', async () => {
    for (const postalAddress of [undefined, null, '', '   ']) {
      const html = await render(element({ unsubscribeUrl: UNSUB, postalAddress }))
      expect(html, String(postalAddress)).toContain(POSTAL_ADDRESS_REQUIRED_BANNER)
    }
  })

  it('heads the email with the hosted brand lockup', async () => {
    const html = await render(element({ unsubscribeUrl: UNSUB }))
    expect(html).toContain(`src="${DEFAULT_SITE_URL}${LOCKUP_EMAIL_PATH}"`)
  })
})

describe('W1 opening line', () => {
  it('differs between A and B and is the first paragraph', () => {
    expect(w1Copy('A').body[0]?.text).toBe('Thank you for joining the list early.')
    expect(w1Copy('B').body[0]?.text).toBe("You're on the list, and thank you for joining early.")
  })
})

describe('copy style', () => {
  const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), 'utf8')

  it.each(['lib/email/launch-copy.ts', 'lib/marketing/coming-soon-copy.ts'])('%s has no em dash', (rel) => {
    expect(stripComments(read(rel))).not.toContain('—')
  })

  it('keeps the R7 consent marker and the privacy link on the form', () => {
    const form = read('app/coming-soon/coming-soon-form.tsx')
    expect(form).toContain('Consent wording pending Business Operations (R7)')
    expect(form).toMatch(/href="\/privacy"/)
    const copy = read('lib/marketing/coming-soon-copy.ts')
    expect(copy).toContain('// Consent wording pending Business Operations (R7)')
  })

  it('renders the coming-soon page per request, so the owner headline flag is live', () => {
    expect(read('app/coming-soon/page.tsx')).toMatch(/export const dynamic = 'force-dynamic'/)
  })
})

describe('coming-soon copy (capture.md section 3 and 6, qualification.md section 6)', () => {
  it('has the headline, CTA and role options as written', () => {
    expect(COMING_SOON_COPY.headline).toBe('Find & Be Found.')
    expect(COMING_SOON_COPY.cta).toBe('Join the launch list')
    expect(ROLE_FIELD_COPY.owner).toBe('I own a business')
    expect(ROLE_FIELD_COPY.supporter).toBe("I'm here to find businesses")
    expect(CONFIRMATION_COPY.title).toBe("You're on the list.")
  })
})

describe('resolveOwnerHeadline (COMING_SOON_OWNER_HEADLINE)', () => {
  it('is off by default and for anything but a or b', () => {
    for (const value of [undefined, '', 'off', 'c', 'true', 'ab']) {
      expect(resolveOwnerHeadline(value), String(value)).toBeNull()
    }
  })

  it('picks variant a or b, case-insensitively', () => {
    expect(resolveOwnerHeadline('a')).toBe(OWNER_HEADLINES.a)
    expect(resolveOwnerHeadline(' B ')).toBe(OWNER_HEADLINES.b)
  })
})
