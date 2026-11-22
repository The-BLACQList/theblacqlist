import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignedInFrame } from '@/components/account/SignedInFrame'
import { OwnerCue } from '@/components/dashboard/OwnerCue'
import { isFeatureEnabled } from '@/lib/env'
import { loadShellData } from '@/lib/account/shellData'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth-only gate: a signed-in user with zero listings reaches the dashboard and
  // sees an empty state rather than being bounced to /account. Per-listing routes
  // still enforce ownership via requireOwner().
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/dashboard')

  // The same menu as /account (ticket 252). A failed listings read counts as
  // having listings: a link that bounces beats hiding a real owner's tools.
  const data = await loadShellData(supabase, user)
  const hasListings = data.isOwner

  return (
    <SignedInFrame data={data}>
      {children}
      {/* The owner Cue's corner button (ticket 203), like the visitor Cue's. */}
      {isFeatureEnabled('ownerCue') && hasListings && <OwnerCue />}
    </SignedInFrame>
  )
}
