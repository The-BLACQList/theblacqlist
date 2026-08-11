import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loginAsAdmin } from './helpers/auth'

/**
 * Checkpoint 1.2 — paid-tier metric integrity, end to end.
 *
 * Two of the four headline numbers on the Starter-gated owner dashboard were
 * structurally always zero:
 *
 *   Saves  — /api/saves was the only save write path and emitted no analytics
 *            event at all. Compounding it, SaveToggledProperties.action was
 *            typed 'saved' | 'unsaved' while the rollup filters the singular
 *            'save', so even a correct emitter would have rolled up zero.
 *   Shares — ShareButton posted 'listing_shared', which is not in
 *            ANALYTICS_EVENTS, so /api/analytics/event rejected it 400. And
 *            ShareButton was imported by nothing: all three share affordances
 *            (hero + both quick-action bars) were placeholder <button>s with
 *            no onClick, so nothing fired in the first place.
 *
 * A green build is what shipped that defect, so a green build cannot close it.
 * This spec walks the whole chain a paying owner depends on:
 *
 *   click → route/beacon → analytics_events → aggregate_entity_analytics()
 *         → entity_analytics_daily → the dashboard's numbers
 *
 * It must go RED against main and GREEN against the fix. If it passes on both,
 * it is not testing the defect.
 *
 * Hermetic by design: it creates its own throwaway listing. The rollup
 * recomputes every listing's counts for the date grouped by entity_id, so
 * asserting exact counts against a shared seed listing would break the moment
 * two runs overlap.
 */

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

// The rollup filters created_at::date in database (UTC) time, so "today" must
// be computed in UTC too. A run that straddles UTC midnight can split the
// events across two dates — rare, and re-running clears it.
const TODAY = new Date().toISOString().slice(0, 10)

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const SLUG = `e2e-analytics-${RUN_ID}`
const NAME = `E2E Analytics Fixture ${RUN_ID}`

let svc: SupabaseClient
let listingId: string
let entityUrl: string

test.beforeAll(async () => {
  svc = serviceClient()

  const { data: category, error: catError } = await svc
    .from('categories')
    .select('id')
    .limit(1)
    .single()
  expect(catError, 'a category must exist to hang a fixture listing off').toBeNull()

  // A city gives the 3-segment /[citySlug]/[entityType]/[listingSlug] URL the
  // entity route actually serves. City-less listings emit a 2-segment URL and
  // are a separate open routing question — not this spec's subject.
  const { data: city, error: cityError } = await svc
    .from('cities')
    .select('id, slug')
    .eq('is_active', true)
    .limit(1)
    .single()
  expect(cityError, 'an active city must exist to build the entity URL').toBeNull()

  // Only name/slug/entity_type/category_id lack defaults. status, tier,
  // trust_tier, location_type and ownership_label all default, and
  // listing_details_business is a nullable left join — a bare row renders.
  const { data: listing, error: insertError } = await svc
    .from('listings')
    .insert({
      name: NAME,
      slug: SLUG,
      entity_type: 'business',
      category_id: category!.id,
      city_id: city!.id,
      status: 'published',
      tagline: 'Fixture for the analytics emission spec',
    })
    .select('id')
    .single()
  expect(insertError, `fixture listing insert failed: ${insertError?.message}`).toBeNull()

  listingId = listing!.id
  entityUrl = `/${city!.slug}/business/${SLUG}`
})

test.afterAll(async () => {
  if (!listingId) return
  // analytics_events.entity_id is polymorphic with no FK, so its rows survive
  // the listing and would poison the next rollup (entity_analytics_daily
  // .listing_id IS a FK). Delete the events explicitly, first.
  await svc.from('analytics_events').delete().eq('entity_id', listingId)
  await svc.from('listings').delete().eq('id', listingId)
})

/**
 * trackServerEvent wraps its insert in after() from next/server, so the row
 * lands *after* the response returns. The /api/analytics/event handler fires
 * its insert un-awaited too. Both mean an immediate assertion flakes — poll.
 */
async function waitForEvent(
  eventName: string,
  match: (row: Record<string, unknown>) => boolean,
  timeoutMs = 20_000
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs
  let last: Record<string, unknown>[] = []
  while (Date.now() < deadline) {
    const { data } = await svc
      .from('analytics_events')
      .select('event_name, entity_type, entity_id, user_id, properties')
      .eq('entity_id', listingId)
      .eq('event_name', eventName)
    last = (data ?? []) as Record<string, unknown>[]
    const hit = last.find(match)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(
    `Timed out waiting for a matching '${eventName}' event on listing ${listingId}. ` +
      `Rows seen: ${JSON.stringify(last)}`
  )
}

test.describe('paid-tier metric integrity', () => {
  test('a save and a share reach analytics_events and roll up to entity_analytics_daily', async ({
    page,
  }) => {
    // The save path requires a session — /api/saves 401s and bounces anonymous
    // users to /sign-in. The admin account global-setup provisions is fine as
    // an ordinary saver.
    await loginAsAdmin(page)

    await page.goto(entityUrl)
    await expect(page.getByRole('heading', { name: NAME })).toBeVisible()

    // Both quick-action bars start aria-hidden, so the accessible-name query
    // resolves to the hero controls. .first() is belt-and-braces.
    await page.getByRole('button', { name: 'Save this business' }).first().click()
    await expect(page.getByRole('button', { name: 'Remove from saved businesses' })).toBeVisible()

    // The share path is client-side (sendBeacon → /api/analytics/event), and
    // that route answers 400 for an unrecognised event_name — which is exactly
    // how the old 'listing_shared' emitter failed, silently, for months.
    // Asserting the response separates "the button never fired" from "the route
    // rejected it"; without this the only symptom is a missing row.
    const analyticsResponse = page.waitForResponse(
      (r) => r.url().includes('/api/analytics/event'),
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: 'Share this business' }).first().click()
    const shareResponse = await analyticsResponse
    expect(
      shareResponse.status(),
      `POST ${shareResponse.url()} → ${shareResponse.status()} for payload ` +
        `${shareResponse.request().postData() ?? '(none)'}`
    ).toBe(200)

    // ── The rollup's exact filters, asserted at the source ──────────────────
    // saves counts save_toggled AND (properties->>'action') = 'save'; both
    // halves have been wrong before, so both are checked here.
    const saveEvent = await waitForEvent(
      'save_toggled',
      (r) => (r.properties as Record<string, unknown> | null)?.action === 'save'
    )
    expect(saveEvent.entity_type, 'the rollup only counts entity_type = listing').toBe('listing')
    expect(saveEvent.user_id, 'a save is attributable to the signed-in user').not.toBeNull()

    const shareEvent = await waitForEvent('share_initiated', () => true)
    expect(shareEvent.entity_type).toBe('listing')

    // ── The rollup itself ───────────────────────────────────────────────────
    const { data: jobResult, error: rpcError } = await svc.rpc('aggregate_entity_analytics', {
      target_date: TODAY,
    })
    expect(rpcError, `aggregate_entity_analytics failed to execute: ${rpcError?.message}`).toBeNull()
    // The function swallows exceptions and reports them, so a bad run looks
    // like a missing row unless the status is checked.
    expect(
      (jobResult as { status?: string; error?: string } | null)?.status,
      `rollup reported: ${JSON.stringify(jobResult)}`
    ).toBe('success')

    const { data: daily, error: dailyError } = await svc
      .from('entity_analytics_daily')
      .select('page_views, saves, shares')
      .eq('listing_id', listingId)
      .eq('snapshot_date', TODAY)
      .maybeSingle()
    expect(dailyError).toBeNull()
    expect(daily, 'the rollup produced no row for the fixture listing').not.toBeNull()

    // These two are the defect. They were structurally 0 for every paying owner.
    expect(daily!.saves, 'owner dashboard "Saves"').toBe(1)
    expect(daily!.shares, 'owner dashboard "Shares"').toBe(1)
    // Page views were never broken — asserted as a control, so a wholesale
    // rollup failure is distinguishable from the specific save/share defect.
    expect(daily!.page_views, 'owner dashboard "Page views" (control)').toBeGreaterThanOrEqual(1)
  })
})
