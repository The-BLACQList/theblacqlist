import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const timestamp = new Date().toISOString()
  let supabaseStatus: 'ok' | 'error' = 'error'

  try {
    const service = createServiceClient()
    const { error } = await service.from('cities').select('id').limit(1).single()
    if (!error) supabaseStatus = 'ok'
  } catch {
    // supabaseStatus stays 'error'
  }

  const overallStatus = supabaseStatus === 'ok' ? 'ok' : 'degraded'

  return NextResponse.json(
    { status: overallStatus, timestamp, checks: { supabase: supabaseStatus } },
    { status: 200 }
  )
}
