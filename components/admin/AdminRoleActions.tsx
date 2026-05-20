'use client'

import { useActionState } from 'react'
import { grantAdminRoleAction, revokeAdminRoleAction } from '@/lib/actions/admin/manageAdminRole'

interface Props {
  userId: string
  adminRoles: { id: string; role: string }[]
  isSelf: boolean
}

export function AdminRoleActions({ userId, adminRoles, isSelf }: Props) {
  const [grantState, grantDispatch, grantPending] = useActionState(grantAdminRoleAction, null)
  const [revokeState, revokeDispatch, revokePending] = useActionState(revokeAdminRoleAction, null)

  const isPending = grantPending || revokePending
  const error =
    (grantState as { error?: string } | null)?.error ??
    (revokeState as { error?: string } | null)?.error

  const adminRole = adminRoles.find((r) => r.role === 'admin')
  const hasAdminRole = Boolean(adminRole)

  if (isSelf) {
    return <span className="font-body text-xs text-charcoal/30 italic">you</span>
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <p className="font-body text-xs text-red-600 max-w-[140px] text-right">{error}</p>}
      {hasAdminRole && adminRole ? (
        <form action={revokeDispatch}>
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="role_id" value={adminRole.id} />
          <button
            type="submit"
            disabled={isPending}
            className="font-subhead text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Revoke admin
          </button>
        </form>
      ) : (
        <form action={grantDispatch}>
          <input type="hidden" name="user_id" value={userId} />
          <button
            type="submit"
            disabled={isPending}
            className="font-subhead text-xs font-semibold text-amber-gold hover:text-light-gold disabled:opacity-50"
          >
            Make admin
          </button>
        </form>
      )}
    </div>
  )
}
