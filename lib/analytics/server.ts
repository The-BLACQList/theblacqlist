// Server-side analytics insert utility.
// For use in Server Components, Route Handlers, and Server Actions only.
// Never import this in client components.

import { createServiceClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/types"
import type { AnalyticsEventName, AnyEventProperties } from "./constants"

interface TrackEventInput {
  event_name: AnalyticsEventName | string
  entity_id?: string | null
  entity_type?: string | null
  user_id?: string | null
  session_id?: string | null
  properties?: AnyEventProperties | Record<string, unknown>
}

/**
 * Fire-and-forget analytics insert via the service client.
 * Never awaits — analytics must not delay response paths.
 */
export function trackServerEvent(input: TrackEventInput): void {
  const serviceClient = createServiceClient()
  void serviceClient.from("analytics_events").insert({
    event_name:  input.event_name,
    entity_id:   input.entity_id  ?? null,
    entity_type: input.entity_type ?? null,
    user_id:     input.user_id    ?? null,
    session_id:  input.session_id ?? null,
    properties:  (input.properties ?? {}) as Json,
  })
}

/**
 * Resolves the current user_id from the session (best-effort),
 * then fires a fire-and-forget analytics insert.
 * Safe to call in any Server Action or Route Handler.
 */
export async function trackServerEventWithUser(
  input: Omit<TrackEventInput, "user_id">
): Promise<void> {
  let userId: string | null = null
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // no session is fine — anonymous events are valid
  }
  trackServerEvent({ ...input, user_id: userId })
}
