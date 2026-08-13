import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminRole = 'admin' | 'super_admin'

export interface AdminSession {
  user: { id: string; email: string | undefined }
  role: AdminRole
}

// ─── Role check ───────────────────────────────────────────────────────────────

/**
 * The role lookup on its own, for callers that already hold an authenticated
 * user id and shouldn't pay for a second `auth.getUser()` round-trip.
 *
 * PublicHeader is the reason this is exported: it renders on every page and has
 * already resolved the user, so calling getAdminSession() there would double the
 * auth calls sitewide to answer one question. Returns null for non-admins.
 */
export async function getAdminRole(userId: string): Promise<AdminRole | null> {
  const serviceClient = createServiceClient()
  const { data: roleRow } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'super_admin'])
    .maybeSingle()

  return roleRow ? (roleRow.role as AdminRole) : null
}

// For Server Components and layouts — redirects on failure.
// Never call from inside a server action.
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/admin')

  const role = await getAdminRole(user.id)
  if (!role) redirect('/')

  return {
    user: { id: user.id, email: user.email },
    role,
  }
}

// For server actions — returns null on failure instead of redirecting.
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const role = await getAdminRole(user.id)
  if (!role) return null

  return {
    user: { id: user.id, email: user.email },
    role,
  }
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export async function writeAuditLog({
  adminUserId,
  action,
  targetTable,
  targetId,
  beforeState,
  afterState,
}: {
  adminUserId: string
  action: string
  targetTable: string
  targetId: string | null
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
}): Promise<void> {
  const serviceClient = createServiceClient()
  await serviceClient.from('admin_audit_log').insert({
    admin_user_id: adminUserId,
    action,
    target_table: targetTable,
    target_id: targetId,
    before_state: (beforeState ?? null) as Json | null,
    after_state: (afterState ?? null) as Json | null,
  })
}
