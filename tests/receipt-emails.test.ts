// =============================================================================
// Ticket 165: receipt review emails
// =============================================================================
// Pins the copy the founder approves, the switch rule (only an explicit false
// stops the counted email), the preset reasons, and that a failed send never
// changes the review result.
// =============================================================================

import { readFileSync } from 'fs'
import path from 'path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@react-email/components'

const h = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_args: { to: string; subject: string }) => {}),
}))

vi.mock('@/lib/email/resend', () => ({ sendEmail: h.sendEmail }))

import {
  FALLBACK_FIX_REASON,
  OTHER_FIX_REASON,
  RECEIPT_COUNTED_SUBJECT,
  RECEIPT_FIX_REASONS,
  RECEIPT_NEEDS_FIX_SUBJECT,
  UNNAMED_BUSINESS,
  countedLine,
  pickRejectionReason,
  receiptBusinessName,
  wantsCountedEmail,
} from '@/lib/spend/receipt-emails'
import { ReceiptCountedEmail } from '@/lib/email/templates/receipt-counted'
import { ReceiptNeedsFixEmail } from '@/lib/email/templates/receipt-needs-fix'
import { sendReceiptCountedEmail, sendReceiptNeedsFixEmail } from '@/lib/email/receiptNotices'

const EM_DASH = '—'
const BUSINESS = 'Sweet Auburn Bread Company'
const RECEIPT_ID = 'r-0001'

describe('preset fix reasons', () => {
  it('lists the five presets in the ticket order', () => {
    expect(RECEIPT_FIX_REASONS).toEqual([
      'Photo is hard to read',
      "Amount doesn't match the photo",
      "Date doesn't match the photo",
      "Business isn't on the list",
      'Looks like a duplicate',
    ])
  })

  it('saves a preset as its own words', () => {
    for (const reason of RECEIPT_FIX_REASONS) {
      expect(pickRejectionReason(reason, 'ignored')).toBe(reason)
    }
  })

  it('saves the typed text for Other, trimmed and capped at 200', () => {
    expect(pickRejectionReason(OTHER_FIX_REASON, '  Total is cut off  ')).toBe('Total is cut off')
    expect(pickRejectionReason(OTHER_FIX_REASON, 'x'.repeat(250))).toHaveLength(200)
  })

  it('saves null for Other with nothing typed, or an unknown choice', () => {
    expect(pickRejectionReason(OTHER_FIX_REASON, '   ')).toBeNull()
    expect(pickRejectionReason('made up', 'text')).toBeNull()
    expect(pickRejectionReason(null, null)).toBeNull()
  })
})

describe('the counted email switch', () => {
  it('is on unless the column is explicitly false', () => {
    expect(wantsCountedEmail({ receipt_counted_emails: true })).toBe(true)
    expect(wantsCountedEmail({ receipt_counted_emails: false })).toBe(false)
    expect(wantsCountedEmail({ receipt_counted_emails: null })).toBe(true)
    expect(wantsCountedEmail({})).toBe(true)
    expect(wantsCountedEmail(null)).toBe(true)
    expect(wantsCountedEmail(undefined)).toBe(true)
  })
})

describe('business name', () => {
  it('prefers the listing, then the typed name, then a general line', () => {
    expect(receiptBusinessName(BUSINESS, 'typed')).toBe(BUSINESS)
    expect(receiptBusinessName(null, ' Corner Shop ')).toBe('Corner Shop')
    expect(receiptBusinessName(null, null)).toBe(UNNAMED_BUSINESS)
  })
})

describe('ReceiptCountedEmail', () => {
  it('says the amount, the business and the map line, with one button', async () => {
    const html = await render(
      ReceiptCountedEmail({
        receiptId: RECEIPT_ID,
        amountCents: 4250,
        businessName: BUSINESS,
        siteUrl: 'https://x.test',
      })
    )
    expect(countedLine(4250, BUSINESS)).toBe(`Your $42.50 at ${BUSINESS} is counted.`)
    expect(html).toContain('Your $42.50 at Sweet Auburn Bread Company is counted.')
    expect(html).toContain('Your spend joined the map.')
    expect(html).toContain('See it on the map')
    // The button opens the counted screen (ticket 166), not the map itself.
    expect(html).toContain(`href="https://x.test/account/receipts/${RECEIPT_ID}/counted"`)
  })

  it('does not claim the map for a receipt that is off it', async () => {
    const html = await render(
      ReceiptCountedEmail({
        receiptId: RECEIPT_ID,
        amountCents: 4250,
        businessName: BUSINESS,
        joinedMap: false,
        siteUrl: 'https://x.test',
      })
    )
    expect(html).not.toContain('Your spend joined the map.')
    expect(html).not.toContain('See it on the map')
    expect(html).toContain('This one isn&#x27;t on the map.')
    expect(html).toContain('See your receipt')
    expect(html).toContain(`href="https://x.test/account/receipts/${RECEIPT_ID}/counted"`)
  })

  it('links to the settings switch in every counted email', async () => {
    const html = await render(
      ReceiptCountedEmail({
        receiptId: RECEIPT_ID,
        amountCents: 100,
        businessName: BUSINESS,
        siteUrl: 'https://x.test',
      })
    )
    expect(html).toContain('href="https://x.test/account/settings"')
    expect(html).toContain('Turn these off in your settings.')
  })

  it('has no em dash and the subject is the ticket wording', async () => {
    const html = await render(
      ReceiptCountedEmail({ receiptId: RECEIPT_ID, amountCents: 100, businessName: BUSINESS })
    )
    expect(html).not.toContain(EM_DASH)
    expect(RECEIPT_COUNTED_SUBJECT).toBe('Your receipt is counted')
  })
})

describe('ReceiptNeedsFixEmail', () => {
  it('carries the reason and a Fix and resend button to the edit form', async () => {
    const html = await render(
      ReceiptNeedsFixEmail({
        receiptId: RECEIPT_ID,
        reason: 'Photo is hard to read',
        amountCents: 4250,
        businessName: BUSINESS,
        siteUrl: 'https://x.test',
      })
    )
    expect(html).toContain('Photo is hard to read.')
    expect(html).toContain('Fix and resend')
    expect(html).toContain(`href="https://x.test/account/receipts/${RECEIPT_ID}/edit"`)
    expect(html).not.toContain(EM_DASH)
    expect(RECEIPT_NEEDS_FIX_SUBJECT).toBe('Your receipt needs a quick fix')
  })

  it('falls back to a general line when no reason was saved', async () => {
    const html = await render(
      ReceiptNeedsFixEmail({
        receiptId: RECEIPT_ID,
        reason: null,
        amountCents: 100,
        businessName: BUSINESS,
      })
    )
    expect(html).toContain(FALLBACK_FIX_REASON)
  })
})

// A fake service client: one profiles read and one auth lookup.
function fakeClient(opts: {
  pref?: boolean | null
  profileError?: boolean
  email?: string | null
  authThrows?: boolean
}) {
  return {
    from: () => {
      const b = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () =>
          opts.profileError
            ? { data: null, error: { message: 'column does not exist' } }
            : { data: { receipt_counted_emails: opts.pref ?? true }, error: null },
      }
      return b
    },
    auth: {
      admin: {
        getUserById: async () => {
          if (opts.authThrows) throw new Error('auth down')
          return {
            data: { user: opts.email === null ? null : { email: opts.email ?? 'a@example.test' } },
          }
        },
      },
    },
  } as never
}

const NOTICE = {
  receiptId: RECEIPT_ID,
  userId: 'u-1',
  amountCents: 4250,
  businessName: BUSINESS,
  joinedMap: true,
}

describe('sending', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    h.sendEmail.mockReset()
    h.sendEmail.mockImplementation(async () => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => errorSpy.mockRestore())

  it('sends the counted email when the switch is on', async () => {
    await sendReceiptCountedEmail(fakeClient({ pref: true }), NOTICE)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail.mock.calls[0]?.[0].subject).toBe(RECEIPT_COUNTED_SUBJECT)
  })

  it('skips the counted email when the switch is off', async () => {
    await sendReceiptCountedEmail(fakeClient({ pref: false }), NOTICE)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('treats a failed profile read as on', async () => {
    await sendReceiptCountedEmail(fakeClient({ profileError: true }), NOTICE)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('skips quietly when there is no address', async () => {
    await sendReceiptCountedEmail(fakeClient({ email: null }), NOTICE)
    await sendReceiptNeedsFixEmail(fakeClient({ email: null }), { ...NOTICE, reason: 'x' })
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('always sends needs-a-fix, even with the counted switch off', async () => {
    await sendReceiptNeedsFixEmail(fakeClient({ pref: false }), { ...NOTICE, reason: 'x' })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail.mock.calls[0]?.[0].subject).toBe(RECEIPT_NEEDS_FIX_SUBJECT)
  })

  it('never rejects, and logs the receipt id only', async () => {
    h.sendEmail.mockImplementation(async () => {
      throw new Error('resend down')
    })
    await expect(sendReceiptCountedEmail(fakeClient({}), NOTICE)).resolves.toBeUndefined()
    await expect(
      sendReceiptNeedsFixEmail(fakeClient({ authThrows: true }), { ...NOTICE, reason: 'x' })
    ).resolves.toBeUndefined()
    const logged = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(logged).toContain(RECEIPT_ID)
    expect(logged).not.toContain('a@example.test')
    expect(logged).not.toContain('u-1')
  })
})

describe('the review actions send after the status update', () => {
  const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')

  it.each([
    ['lib/actions/spend/approveReceipt.ts', 'sendReceiptCountedEmail(', "status: 'approved'"],
    ['lib/actions/spend/rejectReceipt.ts', 'sendReceiptNeedsFixEmail(', "status: 'rejected'"],
  ])('%s fires and forgets', (file, call, statusWrite) => {
    const src = read(file)
    expect(src).toContain('void (async () => {')
    expect(src.indexOf(call)).toBeGreaterThan(src.indexOf(statusWrite))
    // The send is not awaited by the action, so it cannot change the result.
    expect(src).not.toMatch(/await \(async \(\) =>/)
  })
})
