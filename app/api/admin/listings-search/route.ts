import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin/guard'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ listings: [] })

  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('id, name, slug')
    .eq('status', 'published')
    .is('deleted_at', null)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10)

  return NextResponse.json({ listings: data ?? [] })
}
