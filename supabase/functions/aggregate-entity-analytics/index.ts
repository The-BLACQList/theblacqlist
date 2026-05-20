import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // Require service role key — this function must not be callable by end users
  const authHeader = req.headers.get("Authorization") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Optional backfill date in body: { "date": "2026-05-14" }
  let targetDate: string | undefined
  try {
    const body = await req.json()
    if (body?.date && typeof body.date === "string") {
      targetDate = body.date
    }
  } catch {
    // No body or non-JSON — run for yesterday (default)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  )

  const rpcArgs = targetDate ? { target_date: targetDate } : {}

  const { data, error } = await supabase.rpc("aggregate_entity_analytics", rpcArgs)

  if (error) {
    console.error("aggregate_entity_analytics error:", error)
    return new Response(
      JSON.stringify({ error: error.message, code: error.code }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
