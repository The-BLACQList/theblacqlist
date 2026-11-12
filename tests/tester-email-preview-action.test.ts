// =============================================================================
// /admin/email-preview: renderTesterInviteAction
// =============================================================================
// Renders the tester invite or the tester update for the founder to paste into
// Gmail. Admin only, never sends, and accepts only a one-tap /t#<token> link.
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  admin: { user: { id: 'admin-1' }, role: 'super_admin' } as unknown,
}))

vi.mock('@/lib/admin/guard', () => ({
  getAdminSession: vi.fn(async () => h.admin),
}))

import { renderTesterInviteAction } from '@/lib/actions/admin/renderTesterInvite'

const TOKEN = 'not-a-real-token-'.padEnd(43, '0')
const LINK = `https://theblacqlist.com/t#${TOKEN}`

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const base = { email_kind: 'invite', tester_link: LINK, audience: 'owner' }

async function run(fields: Record<string, string>) {
  return renderTesterInviteAction(null, form(fields))
}

describe('renderTesterInviteAction', () => {
  beforeEach(() => {
    h.admin = { user: { id: 'admin-1' }, role: 'super_admin' }
  })

  it('refuses anyone who is not an admin', async () => {
    h.admin = null
    expect(await run(base)).toEqual({ error: 'You must be signed in as an admin.' })
  })

  it('renders the invite with its subject, keeping the link intact', async () => {
    const result = await run(base)
    expect(result).toMatchObject({
      subject: "You're in early. Add your business to The BLACQList",
    })
    if (!result || !('html' in result)) throw new Error('expected a render')
    expect(result.html).toContain(`href="${LINK}"`)
    expect(result.html).toContain('Explore The Collective')
    expect(result.text).toContain('Explore The Collective')
  })

  it('renders the shared invite, marked as forwardable', async () => {
    const result = await run({ ...base, audience: 'shared' })
    expect(result).toMatchObject({
      subject: "You're in early. Try The BLACQList before anyone else",
      shareable: true,
    })
  })

  it('marks one-person emails as not forwardable', async () => {
    expect(await run(base)).toMatchObject({ shareable: false })
    expect(await run({ ...base, email_kind: 'update', audience: 'supporter' })).toMatchObject({
      shareable: false,
    })
  })

  it('refuses a shared tester update: the update goes to one tester', async () => {
    expect(await run({ ...base, email_kind: 'update', audience: 'shared' })).toEqual({
      error: 'The tester update goes to one tester. Pick business owner or supporter.',
    })
  })

  it('renders the supporter invite subject', async () => {
    expect(await run({ ...base, audience: 'supporter' })).toMatchObject({
      subject: "You're in early. Explore The BLACQList before anyone else",
    })
  })

  it('renders the tester update with its subject and the opening date', async () => {
    const result = await run({
      ...base,
      email_kind: 'update',
      opening_date: 'Tuesday, 17 November',
      first_name: 'Andrea',
    })
    expect(result).toMatchObject({
      subject: 'Before we open: finish your walk and see The Collective',
    })
    if (!result || !('html' in result)) throw new Error('expected a render')
    expect(result.html).toContain('Tuesday, 17 November')
    expect(result.html).toContain('Thank you, Andrea.')
    expect(result.html).toContain('Finish your walk')
  })

  it('refuses an opening date too long for one line', async () => {
    const result = await run({ ...base, email_kind: 'update', opening_date: 'x'.repeat(41) })
    expect(result).toMatchObject({ error: expect.stringContaining('Keep the opening date short') })
  })

  it.each([
    ['no email kind', { email_kind: '' }, 'Pick which email this is.'],
    ['an unknown email kind', { email_kind: 'blast' }, 'Pick which email this is.'],
    ['no link', { tester_link: '' }, 'Paste the tester link first.'],
    ['no audience', { audience: '' }, 'Pick who this email is for.'],
    ['an unknown audience', { audience: 'everyone' }, 'Pick who this email is for.'],
  ])('refuses %s', async (_label, override, error) => {
    expect(await run({ ...base, ...override })).toEqual({ error })
  })

  it.each([
    ['not a URL', 'theblacqlist.com/t', 'not a full link'],
    ['http', `http://theblacqlist.com/t#${TOKEN}`, 'https://'],
    ['an old ?preview= link', 'https://theblacqlist.com/sign-up?preview=abc123', '?preview='],
    ['the wrong path', `https://theblacqlist.com/join#${TOKEN}`, 'not a tester link'],
    ['a missing code', 'https://theblacqlist.com/t', 'missing its code'],
    ['a cut-off code', `https://theblacqlist.com/t#${TOKEN.slice(0, 30)}`, 'missing its code'],
  ])('refuses a link that is %s', async (_label, link, fragment) => {
    const result = await run({ ...base, tester_link: link })
    expect(result).toMatchObject({ error: expect.stringContaining(fragment) })
  })
})
