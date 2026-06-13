import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase server module BEFORE importing the route (vi.mock is hoisted),
// so the real @supabase/ssr module (which touches next/headers) never loads and we
// can deterministically drive the health check's ok / degraded branches.
// vi.hoisted runs before the hoisted vi.mock factory, so these are initialized
// when the mocked module is first imported (avoids a TDZ error).
const { probe, createServiceClient } = vi.hoisted(() => {
  const probe = vi.fn()
  const createServiceClient = vi.fn(() => ({
    from: () => ({
      select: () => ({
        limit: () => ({
          single: probe,
        }),
      }),
    }),
  }))
  return { probe, createServiceClient }
})
vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))

import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  beforeEach(() => {
    probe.mockReset()
    createServiceClient.mockClear()
  })

  it('K1 — returns status "ok" + HTTP 200 when Supabase responds', async () => {
    probe.mockResolvedValue({ data: { id: '1' }, error: null })
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.checks.supabase).toBe('ok')
  })

  it('K2 — returns status "degraded" + HTTP 200 (not 500) when the Supabase query errors', async () => {
    probe.mockResolvedValue({ data: null, error: { message: 'connection refused' } })
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks.supabase).toBe('error')
  })

  it('K2 — returns "degraded" + HTTP 200 when the Supabase client is unavailable (throws)', async () => {
    createServiceClient.mockImplementationOnce(() => {
      throw new Error('ETIMEDOUT')
    })
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks.supabase).toBe('error')
  })
})
