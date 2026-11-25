import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 281. `void client.from('analytics_events').insert({…})` sends nothing:
// the query builder only issues its request once it is awaited. The stub below
// is lazy the same way, so an insert counts only when something runs it.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const USER_ID = 'owner-a'

const h = vi.hoisted(() => {
  const sent: { table: string; row: Record<string, unknown> }[] = []
  const state = {
    updateError: null as { message: string } | null,
    queueError: null as { message: string; code: string } | null,
    eventsThrow: false,
  }
  const afters: (() => unknown)[] = []

  function makeClient() {
    return {
      from(table: string) {
        if (table === 'analytics_events' && state.eventsThrow) throw new Error('events down')
        let row: Record<string, unknown> | null = null
        let op = 'select'
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          limit: () => builder,
          insert: (value: Record<string, unknown>) => {
            op = 'insert'
            row = value
            return builder
          },
          update: () => {
            op = 'update'
            return builder
          },
          then(resolve: (v: unknown) => void) {
            if (op === 'insert' && row) {
              if (table === 'moderation_queue' && state.queueError) {
                resolve({ data: null, error: state.queueError })
                return
              }
              sent.push({ table, row })
            }
            resolve({ data: [], error: op === 'update' ? state.updateError : null })
          },
        }
        return builder
      },
    }
  }
  return { sent, state, afters, makeClient }
})

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void h.afters.push(fn) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => h.makeClient() }))

import { transitionToPendingReview } from '@/lib/listings/submitForReview'

async function runAfters() {
  for (const fn of h.afters) await fn()
}
const events = () => h.sent.filter((s) => s.table === 'analytics_events').map((s) => s.row)

beforeEach(() => {
  h.sent.length = 0
  h.afters.length = 0
  h.state.updateError = null
  h.state.queueError = null
  h.state.eventsThrow = false
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('sending a listing for review saves listing_submitted', () => {
  it('sends one event, after the response', async () => {
    const res = await transitionToPendingReview(h.makeClient() as never, LISTING_ID, USER_ID)
    expect(res).toEqual({ success: true })
    expect(events()).toEqual([])
    await runAfters()
    expect(events()).toEqual([
      expect.objectContaining({
        event_name: 'listing_submitted',
        entity_id: LISTING_ID,
        entity_type: 'listing',
        user_id: USER_ID,
        properties: { source: 'web_form' },
      }),
    ])
  })

  it('sends nothing when the listing could not be moved', async () => {
    h.state.updateError = { message: 'no' }
    expect(await transitionToPendingReview(h.makeClient() as never, LISTING_ID, USER_ID)).toHaveProperty('error')
    await runAfters()
    expect(events()).toEqual([])
  })

  it('sends nothing when the review line refused it', async () => {
    h.state.queueError = { message: 'no', code: '23514' }
    expect(await transitionToPendingReview(h.makeClient() as never, LISTING_ID, USER_ID)).toHaveProperty('error')
    await runAfters()
    expect(events()).toEqual([])
  })

  it('never fails the submit when the event cannot be saved', async () => {
    h.state.eventsThrow = true
    expect(await transitionToPendingReview(h.makeClient() as never, LISTING_ID, USER_ID)).toEqual({ success: true })
    await expect(runAfters()).resolves.toBeUndefined()
  })
})

describe('the events go through trackServerEvent', () => {
  it.each([
    ['lib/listings/submitForReview.ts', 'listing_submitted'],
    ['lib/actions/listings/submitListing.ts', 'listing_submitted'],
    ['lib/actions/claims/createClaim.ts', 'claim_submitted'],
  ])('%s', (file, name) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toMatch(new RegExp(`trackServerEvent\\(\\{\\s*event_name: '${name}'`))
  })
})

describe('no un-awaited Supabase call anywhere', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const path = join(dir, e.name)
      if (e.isDirectory()) return e.name === 'node_modules' ? [] : sources(path)
      return /\.tsx?$/.test(e.name) ? [path] : []
    })
  }

  it('no `void client.from(…)` or `void client.rpc(…)`', () => {
    const bad = ['app', 'lib', 'components'].flatMap(sources).filter((path) => {
      const code = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      // `.then(` runs the query, so a call chained to it is fine.
      return [...code.matchAll(/\bvoid\s+\(?[\w.]+(?:\(\))?\)?\s*\.(?:from|rpc)\([\s\S]*?(?=\n\s*\n|$)/g)].some(
        (m) => !m[0].includes('.then(')
      )
    })
    expect(bad).toEqual([])
  })
})
