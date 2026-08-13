import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminRole } from '@/lib/admin/guard'
import { AccountNav, type AccountNavCounts } from '@/components/account/AccountNav'

/**
 * AC-AB account shell: persistent grouped sidebar (desktop) / horizontal
 * scroll-nav (mobile) with live counts, wrapping every /account page.
 * Sub-pages render content only — no back-links, no own page chrome.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account')

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? 'there'
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—'

  const [saved, reviews, claims, claimsPending, receipts, owned, adminRole] = await Promise.all([
    supabase.from('saves').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('reviewer_user_id', user.id),
    supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('claimant_user_id', user.id),
    supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('claimant_user_id', user.id)
      .eq('status', 'pending'),
    supabase
      .from('receipt_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .is('deleted_at', null),
    // Gates the Admin group in the sidebar only — /admin still guards itself.
    // Folded into the existing Promise.all so it costs no extra round-trip.
    getAdminRole(user.id),
  ])

  const counts: AccountNavCounts = {
    saved: saved.count ?? 0,
    reviews: reviews.count ?? 0,
    claims: claims.count ?? 0,
    claimsPending: claimsPending.count ?? 0,
    receipts: receipts.count ?? 0,
  }

  return (
    <div className="min-h-screen bg-pale-lavender pt-14 md:pt-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 lg:py-10 lg:flex lg:gap-8">
        <AccountNav
          displayName={displayName}
          memberSince={memberSince}
          counts={counts}
          isOwner={(owned.count ?? 0) > 0}
          isAdmin={adminRole !== null}
        />
        <div className="min-w-0 flex-1 py-6 lg:py-0">{children}</div>
      </div>
    </div>
  )
}
