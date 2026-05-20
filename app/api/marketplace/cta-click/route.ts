import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"


export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON.", code: "VALIDATION_ERROR" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body required.", code: "VALIDATION_ERROR" }, { status: 400 })
  }

  const {
    entity_type,
    entity_id,
    cta_type,
    listing_id,
    destination_url,
  } = body as Record<string, unknown>

  if (!entity_type || !["listing", "product", "service"].includes(entity_type as string)) {
    return NextResponse.json({ error: "Invalid entity_type.", code: "VALIDATION_ERROR" }, { status: 400 })
  }
  if (!entity_id || typeof entity_id !== "string") {
    return NextResponse.json({ error: "entity_id is required.", code: "VALIDATION_ERROR" }, { status: 400 })
  }
  if (!listing_id || typeof listing_id !== "string") {
    return NextResponse.json({ error: "listing_id is required.", code: "VALIDATION_ERROR" }, { status: 400 })
  }
  if (!destination_url || typeof destination_url !== "string" || !destination_url.startsWith("https://")) {
    return NextResponse.json({ error: "destination_url must be a valid https URL.", code: "VALIDATION_ERROR" }, { status: 400 })
  }
  if (cta_type && typeof cta_type !== "string") {
    return NextResponse.json({ error: "Invalid cta_type.", code: "VALIDATION_ERROR" }, { status: 400 })
  }

  // Best-effort: associate user_id if a session exists
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // fire-and-forget — no session is OK
  }

  const serviceClient = createServiceClient()

  // Fire and forget — do not await on the response path
  void serviceClient.from("analytics_events").insert({
    event_name:  "cta_click",
    entity_id:   entity_id as string,
    entity_type: entity_type as string,
    user_id:     userId,
    properties: {
      cta_type:        (cta_type as string | null | undefined) ?? "visit-website",
      listing_id,
      destination_url,
    },
  })

  return NextResponse.json({ data: { success: true } })
}
