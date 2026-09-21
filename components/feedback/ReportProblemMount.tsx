import { createClient } from '@/lib/supabase/server'
import { ReportProblemButton } from './ReportProblemButton'

// Server-side gate for the Report a problem button. Mounted in the root
// layout next to TourRailMount, so the same constraints apply:
//
//   - Signed-in only. The submit action refuses anonymous reports anyway;
//     this keeps the client chunk off every public page view.
//   - Nothing here can throw. A failed auth read renders nothing; the button
//     throwing would take down every page on the site.
//   - No tour dependency. The rail needs the flag on AND an enrollment; this
//     needs a session and nothing else, so supporters and owners whose
//     business is still pending (who have no tour) still get a way to tell us.
async function hasSession(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

export async function ReportProblemMount() {
  const user = await hasSession()
  if (!user) return null
  return <ReportProblemButton />
}
