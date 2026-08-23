import { test, expect } from '@playwright/test'
import { loginAsOwner } from './helpers/auth'

/**
 * API contract negatives — TA-17 (analytics ingestion) and TA-21 (spend
 * privacy).
 *
 * These are the cases a manual walk is worst at. A rejection that quietly
 * becomes an acceptance looks like nothing at all from a browser: the page
 * still renders, the button still clicks. Only a direct call sees it.
 *
 * ⚠ Two TA-17 expectations in the test plan do not match the shipped route and
 * are corrected here (see the 2d doc corrections):
 *   • the plan expects code `INVALID_EVENT_NAME`; the route returns
 *     `VALIDATION_ERROR` for every rejection, by design — one code, one shape.
 *   • the plan expects a missing `entity_id` to 400. It does not, and should
 *     not: a `page_view` on a non-entity page has no entity.
 */

const EVENT_URL = '/api/analytics/event'

test.describe('TA-17 — Analytics event ingestion', () => {
  test('accepts a valid page_view', async ({ request }) => {
    const res = await request.post(EVENT_URL, {
      data: { event_name: 'page_view', entity_type: 'listing' },
    })
    expect(res.status(), 'valid page_view').toBe(200)
    expect(await res.json()).toEqual({ data: { success: true } })
  })

  test('accepts a page_view with no entity_id — entity_id is optional', async ({ request }) => {
    const res = await request.post(EVENT_URL, { data: { event_name: 'page_view' } })
    expect(res.status()).toBe(200)
  })

  const rejections: { label: string; body: unknown }[] = [
    { label: 'an unknown event name', body: { event_name: 'hacked_event' } },
    { label: 'a missing event name', body: { entity_type: 'listing' } },
    { label: 'a non-string event name', body: { event_name: 42 } },
    { label: 'a non-string entity_id', body: { event_name: 'page_view', entity_id: 42 } },
    {
      label: 'a properties payload over the 5 KB cap',
      body: { event_name: 'page_view', properties: { blob: 'x'.repeat(6000) } },
    },
    {
      // The public endpoint must not let a browser forge an event that only a
      // trusted server action is allowed to write. See SERVER_ONLY_EVENTS in
      // lib/analytics/constants.ts — deliberately excluded from the allow-list.
      label: 'a server-only event name forged from the client',
      body: { event_name: 'listing_draft_created' },
    },
  ]

  for (const { label, body } of rejections) {
    test(`rejects ${label} with 400 VALIDATION_ERROR`, async ({ request }) => {
      const res = await request.post(EVENT_URL, { data: body })
      expect(res.status(), label).toBe(400)
      const json = await res.json()
      expect(json.code, label).toBe('VALIDATION_ERROR')
      expect(typeof json.error, 'a human-readable message accompanies the code').toBe('string')
    })
  }

  test('rejects a malformed JSON body with 400 VALIDATION_ERROR', async ({ request }) => {
    const res = await request.post(EVENT_URL, {
      headers: { 'Content-Type': 'application/json' },
      data: '{ not json',
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('VALIDATION_ERROR')
  })
})

test.describe('TA-21 — Spend data privacy', () => {
  test('step 2 — /api/community-spend returns aggregates only, never a user id', async ({
    request,
  }) => {
    const res = await request.get('/api/community-spend')
    expect(res.status()).toBe(200)

    const json = await res.json()
    expect(json.data).toHaveProperty('total_amount_cents')
    expect(json.data).toHaveProperty('total_transactions')

    // The assertion that matters: no per-person identifier anywhere in the
    // serialized payload. Checking the raw text rather than named keys catches
    // a field added later that nobody thought to exclude.
    const raw = JSON.stringify(json)
    for (const forbidden of ['user_id', 'userId', 'email', 'receipt_id', 'submitted_by']) {
      expect(raw, `community-spend must not expose ${forbidden}`).not.toContain(forbidden)
    }
  })

  test('step 3 — /api/flow-map/personal-impact refuses an anonymous caller', async ({ request }) => {
    const res = await request.get('/api/flow-map/personal-impact')
    expect(res.status()).toBe(401)
    expect((await res.json()).code).toBe('AUTH_REQUIRED')
  })

  test('step 4 — personal-impact returns the caller’s own totals and no user ids', async ({
    page,
  }) => {
    await loginAsOwner(page)

    const res = await page.request.get('/api/flow-map/personal-impact')
    expect(res.status()).toBe(200)

    const json = await res.json()
    expect(json.data).toHaveProperty('total_amount_cents')
    expect(json.data).toHaveProperty('approved_receipt_count')

    const raw = JSON.stringify(json)
    for (const forbidden of ['user_id', 'userId', 'email']) {
      expect(raw, `personal-impact must not echo ${forbidden}`).not.toContain(forbidden)
    }
  })
})
