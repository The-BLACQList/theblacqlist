import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignedInFrame } from '@/components/account/SignedInFrame'
import { loadShellData } from '@/lib/account/shellData'

/**
 * Every /account page sits in the one signed-in frame (ticket 252), the same
 * menu the /dashboard pages use. Sub-pages render content only.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account')

  const data = await loadShellData(supabase, user)
  return <SignedInFrame data={data}>{children}</SignedInFrame>
}
