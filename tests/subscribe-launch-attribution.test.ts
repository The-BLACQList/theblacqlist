// =============================================================================
// subscribeLaunchAction: attribution, optional role, W0 flag (pre-launch)
// =============================================================================
// What these pin down:
//   * UTM values, the referrer origin and the role are stored when given, and
//     only after server-side validation
//   * the role is optional; an invalid one is dropped, not an error
//   * before the GATE-DATA migration, the missing-column error is caught and
//     the signup is saved as { email, source } (the code can merge first)
//   * W0 is never sent while LAUNCH_CONFIRMATION_EMAIL_ENABLED is off, and is
//     scheduled only for a NEW coming-soon row when it is on
//   * the launch_list_submit_success event carries no email
//
// sendEmail is mocked at the Resend boundary. No test here can send email.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type DbError = { code: string; message?: string } | null

const h = vi.hoisted(() => ({
  insertErrors: [] as DbError[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as { row: Record<string, unknown>; filters: Record<string, unknown> }[],
  afterCallbacks: [] as (() => unknown)[],
}))

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.7']]) as unknown as Headers,
}))
vi.mock('@/lib/env', () => ({ SUBSCRIBE_RATE_LIMIT_SALT: 'test-salt' }))
vi.mock('next/server', () => ({
  after: (cb: () => unknown) => {
    h.afterCallbacks.push(cb)
  },
}))
vi.mock('@/lib/analytics/server', () => ({ trackServerEvent: vi.fn() }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => ({ id: 'mock' })) }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === 'launch_subscribe_attempts') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          gte: () => Promise.resolve({ count: 0, error: null }),
          insert: () => Promise.resolve({ error: null }),
        }
        return builder
      }
      return {
        insert: (row: Record<string, unknown>) => {
          h.inserts.push(row)
          return Promise.resolve({ error: h.insertErrors.shift() ?? null })
        },
        update: (row: Record<string, unknown>) => {
          const filters: Record<string, unknown> = {}
          h.updates.push({ row, filters })
          const builder = {
            eq: (col: string, val: unknown) => {
              filters[`eq:${col}`] = val
              return builder
            },
            is: (col: string, val: unknown) => {
              filters[`is:${col}`] = val
              return builder
            },
            then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
          }
          return builder
        },
      }
    },
  }),
}))

const { subscribeLaunchAction } = await import('@/lib/actions/subscribers/subscribeLaunch')
const { trackServerEvent } = await import('@/lib/analytics/server')
const { sendEmail } = await import('@/lib/email/resend')
const { sendLaunchConfirmation } = await import('@/lib/email/sendLaunchConfirmation')

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

async function runAfterCallbacks() {
  for (const cb of h.afterCallbacks.splice(0)) await cb()
}

const ENV_KEYS = ['LAUNCH_CONFIRMATION_EMAIL_ENABLED', 'SENDER_POSTAL_ADDRESS', 'LAUNCH_UNSUBSCRIBE_URL'] as const

beforeEach(() => {
  h.insertErrors = []
  h.inserts = []
  h.updates = []
  h.afterCallbacks = []
  vi.mocked(trackServerEvent).mockClear()
  vi.mocked(sendEmail).mockClear()
  for (const key of ENV_KEYS) delete process.env[key]
  delete process.env.TURNSTILE_SECRET_KEY
})

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
  vi.restoreAllMocks()
})

describe('attribution and role are stored (R2, R3)', () => {
  it('stores validated UTM values, the referrer origin and the role', async () => {
    const result = await subscribeLaunchAction(
      null,
      form({
        email: 'New@Example.test',
        signup_role: 'owner',
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: 'pre-launch',
        utm_content: 'bio-link',
        referrer: 'https://l.instagram.com/?u=abc',
      })
    )
    expect(result).toEqual({ success: true })
    expect(h.inserts).toEqual([
      {
        email: 'new@example.test',
        source: 'coming-soon',
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: 'pre-launch',
        utm_content: 'bio-link',
        referrer: 'https://l.instagram.com',
        signup_role: 'owner',
      },
    ])
  })

  it('posts exactly { email, source } when there is no attribution and no role', async () => {
    await subscribeLaunchAction(null, form({ email: 'plain@example.test' }))
    expect(h.inserts).toEqual([{ email: 'plain@example.test', source: 'coming-soon' }])
  })

  it('drops an invalid role and invalid UTM values rather than failing the signup', async () => {
    const result = await subscribeLaunchAction(
      null,
      form({ email: 'x@example.test', signup_role: 'admin', utm_source: '<script>', utm_campaign: 'ok' })
    )
    expect(result).toEqual({ success: true })
    expect(h.inserts).toEqual([{ email: 'x@example.test', source: 'coming-soon', utm_campaign: 'ok' }])
  })

  it('keeps attribution on the tier waitlists too', async () => {
    await subscribeLaunchAction(null, form({ email: 't@example.test', source: 'pricing-growth', utm_source: 'share' }))
    expect(h.inserts[0]).toEqual({ email: 't@example.test', source: 'pricing-growth', utm_source: 'share' })
  })
})

describe('before the migration is applied (GATE-DATA)', () => {
  it.each(['PGRST204', '42703'])('retries without the new columns on %s and keeps the signup', async (code) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.insertErrors = [{ code, message: "Could not find the 'utm_source' column" }]

    const result = await subscribeLaunchAction(
      null,
      form({ email: 'early@example.test', signup_role: 'supporter', utm_source: 'instagram' })
    )

    expect(result).toEqual({ success: true })
    expect(h.inserts).toHaveLength(2)
    expect(h.inserts[1]).toEqual({ email: 'early@example.test', source: 'coming-soon' })
    warn.mockRestore()
  })

  it('does not retry when nothing extra was sent', async () => {
    h.insertErrors = [{ code: 'PGRST204' }]
    const result = await subscribeLaunchAction(null, form({ email: 'p@example.test' }))
    expect(result).toEqual({ error: 'Something went wrong. Please try again.' })
    expect(h.inserts).toHaveLength(1)
  })
})

describe('a repeat signup (23505)', () => {
  it('fills in a role that was never given, guarded on null', async () => {
    h.insertErrors = [{ code: '23505' }]
    const result = await subscribeLaunchAction(null, form({ email: 'again@example.test', signup_role: 'owner' }))
    expect(result).toEqual({ success: true })
    expect(h.updates).toEqual([
      { row: { signup_role: 'owner' }, filters: { 'eq:email': 'again@example.test', 'is:signup_role': null } },
    ])
  })

  it('sends no W0 and no success event: it is not a new row', async () => {
    process.env.LAUNCH_CONFIRMATION_EMAIL_ENABLED = 'true'
    process.env.SENDER_POSTAL_ADDRESS = '1 Test Street'
    process.env.LAUNCH_UNSUBSCRIBE_URL = 'https://example.test/unsub'
    h.insertErrors = [{ code: '23505' }]
    await subscribeLaunchAction(null, form({ email: 'again@example.test' }))
    await runAfterCallbacks()
    expect(h.afterCallbacks).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(trackServerEvent).not.toHaveBeenCalled()
  })
})

describe('launch_list_submit_success (R6)', () => {
  it('fires once for a new row, with attribution and role but no email', async () => {
    await subscribeLaunchAction(
      null,
      form({ email: 'event@example.test', signup_role: 'supporter', utm_source: 'share', utm_campaign: 'pre-launch' })
    )
    expect(trackServerEvent).toHaveBeenCalledTimes(1)
    const [input] = vi.mocked(trackServerEvent).mock.calls[0]!
    expect(input.event_name).toBe('launch_list_submit_success')
    expect(input.properties).toMatchObject({
      source: 'coming-soon',
      utm_source: 'share',
      utm_campaign: 'pre-launch',
      role: 'supporter',
    })
    expect(JSON.stringify(input)).not.toContain('event@example.test')
  })
})

describe('W0 confirmation email (LAUNCH_CONFIRMATION_EMAIL_ENABLED)', () => {
  it('sends nothing with the flag unset (the default)', async () => {
    await subscribeLaunchAction(null, form({ email: 'w0@example.test' }))
    await runAfterCallbacks()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends nothing with the flag set to anything but "true"', async () => {
    for (const value of ['false', '1', 'TRUE', 'yes']) {
      process.env.LAUNCH_CONFIRMATION_EMAIL_ENABLED = value
      process.env.SENDER_POSTAL_ADDRESS = '1 Test Street'
      process.env.LAUNCH_UNSUBSCRIBE_URL = 'https://example.test/unsub'
      expect(await sendLaunchConfirmation('w0@example.test'), value).toBe('disabled')
    }
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends nothing when on but the postal address or unsubscribe URL is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.LAUNCH_CONFIRMATION_EMAIL_ENABLED = 'true'
    process.env.LAUNCH_UNSUBSCRIBE_URL = 'https://example.test/unsub'
    expect(await sendLaunchConfirmation('w0@example.test')).toBe('missing_config')

    delete process.env.LAUNCH_UNSUBSCRIBE_URL
    process.env.SENDER_POSTAL_ADDRESS = '1 Test Street'
    expect(await sendLaunchConfirmation('w0@example.test')).toBe('missing_config')

    expect(sendEmail).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('when fully configured, schedules one W0 for a new coming-soon row', async () => {
    process.env.LAUNCH_CONFIRMATION_EMAIL_ENABLED = 'true'
    process.env.SENDER_POSTAL_ADDRESS = '1 Test Street'
    process.env.LAUNCH_UNSUBSCRIBE_URL = 'https://example.test/unsub'

    await subscribeLaunchAction(null, form({ email: 'w0@example.test' }))
    expect(sendEmail).not.toHaveBeenCalled() // only after the response
    await runAfterCallbacks()

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendEmail).mock.calls[0]![0]).toMatchObject({
      to: 'w0@example.test',
      subject: "You're on the list",
    })
  })

  it('does not send W0 for a tier waitlist signup', async () => {
    process.env.LAUNCH_CONFIRMATION_EMAIL_ENABLED = 'true'
    process.env.SENDER_POSTAL_ADDRESS = '1 Test Street'
    process.env.LAUNCH_UNSUBSCRIBE_URL = 'https://example.test/unsub'

    await subscribeLaunchAction(null, form({ email: 'tier@example.test', source: 'for-vendors' }))
    await runAfterCallbacks()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
