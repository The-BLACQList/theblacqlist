'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'

export type ManageAdminRoleState = { success: true } | { error: string } | null

export async function grantAdminRoleAction(
  _prev: ManageAdminRoleState,
  formData: FormData
): Promise<ManageAdminRoleState> {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super_admin') {
    return { error: 'Only super admins can grant admin roles.' }
  }

  const userId = formData.get('user_id')?.toString().trim() ?? ''
  if (!userId) return { error: 'Missing user ID.' }

  const serviceClient = createServiceClient()

  const { error } = await serviceClient
    .from('user_roles')
    .insert({ user_id: userId, role: 'admin', granted_by: admin.user.id })

  if (error) {
    if (error.code === '23505') return { error: 'User already has the admin role.' }
    return { error: 'Failed to grant role. Please try again.' }
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'grant_admin_role',
    targetTable: 'user_roles',
    targetId: userId,
    afterState: { role: 'admin' },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

export async function revokeAdminRoleAction(
  _prev: ManageAdminRoleState,
  formData: FormData
): Promise<ManageAdminRoleState> {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super_admin') {
    return { error: 'Only super admins can revoke admin roles.' }
  }

  const userId = formData.get('user_id')?.toString().trim() ?? ''
  const roleId = formData.get('role_id')?.toString().trim() ?? ''
  if (!userId || !roleId) return { error: 'Missing required fields.' }

  // Safety: only revoke admin/super_admin platform roles, not owner roles
  const serviceClient = createServiceClient()

  const { error } = await serviceClient
    .from('user_roles')
    .delete()
    .eq('id', roleId)
    .eq('user_id', userId)
    .in('role', ['admin', 'super_admin'])

  if (error) return { error: 'Failed to revoke role. Please try again.' }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'revoke_admin_role',
    targetTable: 'user_roles',
    targetId: userId,
    beforeState: { role_id: roleId },
  })

  revalidatePath('/admin/users')
  return { success: true }
}
