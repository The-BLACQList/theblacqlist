import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// closeTourRailAction: a finished tester closes the Tester Tour panel for good
// (founder, 2026-10-12). The mark lives on the tester's own enrollment row, so
// it holds on every device. The action takes no input: the viewer is resolved
// on the server, and the write is scoped to that viewer's own live row.

type Filter = { kind: 'eq' | 'not' | 'is'; col: string; val: unknown }

const h = vi.hoisted(() => {
  const state = {
    viewer: null as {
      userId: string
      email: string | null
      enrollment: {
        id: string
        listingId: string
        completedAt: string | null
        trialGrantedAt: string | null
        railClosedAt?: string | null
      }
    } | null,
    writeError: null as { message: string } | null,
    clientThrows: false,
    updates: [] as { table: string; values: Record<string, unknown>; filters: Filter[] }[],
  }

  const resolveTourViewer = vi.fn(async () => state.viewer)

  const createServiceClient = vi.fn(() => {
    if (state.clientThrows) throw new Error('no service client')
    return {
      from(table: string) {
        return {
          update(values: Record<string, unknown>) {
            const filters: Filter[] = []
            const q = {
              eq(col: string, val: unknown) {
                filters.push({ kind: 'eq', col, val })
                return q
              },
              not(col: string, _op: string, val: unknown) {
                filters.push({ kind: 'not', col, val })
                return q
              },
              is(col: string, val: unknown) {
                filters.push({ kind: 'is', col, val })
                return q
              },
              then(
                onFulfilled?: (v: { data: null; error: unknown }) => unknown,
                onRejected?: (e: unknown) => unknown
              ) {
                state.updates.push({ table, values, filters })
                return Promise.resolve({ data: null, error: state.writeError }).then(
                  onFulfilled,
                  onRejected
                )
              },
            }
            return q
          },
        }
      },
    }
  })

  return { state, resolveTourViewer, createServiceClient }
})

vi.mock('@/lib/tour/witness', () => ({ resolveTourViewer: h.resolveTourViewer }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))

import { closeTourRailAction } from '@/lib/actions/tour/closeTourRail'

beforeEach(() => {
  vi.clearAllMocks()
  h.state.viewer = {
    userId: 'u1',
    email: 'tester@example.com',
    enrollment: {
      id: 'enr-1',
      listingId: 'l1',
      completedAt: '2026-10-10T00:00:00Z',
      trialGrantedAt: null,
      railClosedAt: null,
    },
  }
  h.state.writeError = null
  h.state.clientThrows = false
  h.state.updates = []
})

describe('closeTourRailAction', () => {
  it('refuses when there is no live enrollment, writing nothing', async () => {
    h.state.viewer = null
    const res = await closeTourRailAction()
    expect(res.ok).toBe(false)
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })

  it('refuses before the walk is finished, writing nothing', async () => {
    h.state.viewer!.enrollment.completedAt = null
    const res = await closeTourRailAction()
    expect(res).toEqual({ ok: false, error: 'Finish the walk first, then you can close the tour.' })
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })

  it('is a quiet success when it is already closed', async () => {
    h.state.viewer!.enrollment.railClosedAt = '2026-10-11T00:00:00Z'
    expect(await closeTourRailAction()).toEqual({ ok: true })
    expect(h.createServiceClient).not.toHaveBeenCalled()
  })

  it('marks only this tester’s finished, still-open enrollment', async () => {
    expect(await closeTourRailAction()).toEqual({ ok: true })

    expect(h.state.updates).toHaveLength(1)
    const write = h.state.updates[0]!
    expect(write.table).toBe('tour_enrollments')
    expect(Object.keys(write.values)).toEqual(['rail_closed_at'])
    expect(typeof write.values.rail_closed_at).toBe('string')
    expect(write.filters).toContainEqual({ kind: 'eq', col: 'id', val: 'enr-1' })
    expect(write.filters).toContainEqual({ kind: 'eq', col: 'tester_user_id', val: 'u1' })
    expect(write.filters).toContainEqual({ kind: 'not', col: 'completed_at', val: null })
    expect(write.filters).toContainEqual({ kind: 'is', col: 'rail_closed_at', val: null })
  })

  it('never ends the enrollment, so the free month keeps working', async () => {
    await closeTourRailAction()
    const write = h.state.updates[0]!
    expect(write.values).not.toHaveProperty('ended_at')
    expect(write.values).not.toHaveProperty('trial_granted_at')
  })

  it('reports a failed write without throwing', async () => {
    h.state.writeError = { message: 'boom' }
    const res = await closeTourRailAction()
    expect(res.ok).toBe(false)
  })

  it('reports a missing service client without throwing', async () => {
    h.state.clientThrows = true
    const res = await closeTourRailAction()
    expect(res.ok).toBe(false)
  })
})

describe('TourRail offers the close button only once the walk is done', () => {
  const src = readFileSync(path.join(process.cwd(), 'components/tour/TourRail.tsx'), 'utf8')

  it('renders TourCloseForGood exactly once, inside the complete block', () => {
    const uses = src.match(/<TourCloseForGood\b/g) ?? []
    expect(uses).toHaveLength(1)
    const completeBlock = src.indexOf('{complete && (')
    expect(completeBlock).toBeGreaterThan(-1)
    expect(src.indexOf('<TourCloseForGood')).toBeGreaterThan(completeBlock)
  })
})
