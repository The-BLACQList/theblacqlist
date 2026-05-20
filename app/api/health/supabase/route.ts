import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Safe read-only health check for the Supabase connection.
// Only checks env var presence (never values) and calls auth.getSession()
// which is a zero-write, zero-privileged operation.
// Does NOT use the service role key.

export async function GET() {
  const envChecks = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
  }

  const missingVars = Object.entries(envChecks)
    .filter(([, present]) => !present)
    .map(([name]) => name)

  if (missingVars.length > 0) {
    return NextResponse.json(
      { status: "error", message: "Server configuration error" },
      { status: 500 }
    )
  }

  try {
    const supabase = await createClient()
    // getSession() is a safe read-only call — no data written, no elevated access
    const { error } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json(
        { status: "error", message: "Supabase project unreachable" },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status: "ok",
      message: "Supabase connection healthy",
    })
  } catch {
    return NextResponse.json(
      { status: "error", message: "Failed to initialize Supabase client" },
      { status: 500 }
    )
  }
}
