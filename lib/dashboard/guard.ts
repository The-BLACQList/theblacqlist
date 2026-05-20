import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export interface OwnerSession {
  user: { id: string; email: string | undefined }
}

// For Server Components — redirects on failure.
export async function requireOwner(): Promise<OwnerSession> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in?next=/dashboard")

  // Verify ownership: at least one non-deleted listing owned by this user
  const { data: owned } = await supabase
    .from("listings")
    .select("id")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle()

  if (!owned) redirect("/account")

  return { user: { id: user.id, email: user.email } }
}

// For server actions — returns null on failure instead of redirecting.
// NOTE: Does not verify listing ownership. Callers must enforce ownership
// by querying with .eq("owner_user_id", session.user.id).
export async function getOwnerSession(): Promise<OwnerSession | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  return { user: { id: user.id, email: user.email } }
}
