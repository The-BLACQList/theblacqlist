import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// POST /api/saves — save a listing
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Authentication required.", code: "AUTH_REQUIRED" }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid request body.", code: "VALIDATION_ERROR" }, { status: 400 })
  }

  const listingId = (body as Record<string, unknown>)?.listing_id
  if (typeof listingId !== "string" || !isUUID(listingId)) {
    return NextResponse.json({ error: "listing_id must be a valid UUID.", code: "VALIDATION_ERROR" }, { status: 400 })
  }

  // Verify listing is published
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

  if (!listing) {
    return NextResponse.json({ error: "Listing not found.", code: "NOT_FOUND" }, { status: 404 })
  }

  const { error } = await supabase
    .from("saves")
    .insert({ user_id: user.id, listing_id: listingId })

  // ON CONFLICT DO NOTHING equivalent — ignore duplicate key errors
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Failed to save. Please try again.", code: "SERVER_ERROR" }, { status: 500 })
  }

  return NextResponse.json({ data: { saved: true, listing_id: listingId } }, { status: 201 })
}

// DELETE /api/saves?listing_id=... — unsave
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Authentication required.", code: "AUTH_REQUIRED" }, { status: 401 })
  }

  const listingId = request.nextUrl.searchParams.get("listing_id")
  if (!listingId || !isUUID(listingId)) {
    return NextResponse.json({ error: "listing_id must be a valid UUID.", code: "VALIDATION_ERROR" }, { status: 400 })
  }

  await supabase
    .from("saves")
    .delete()
    .eq("user_id", user.id)
    .eq("listing_id", listingId)

  return new NextResponse(null, { status: 204 })
}

// GET /api/saves — list user's saved listings
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Authentication required.", code: "AUTH_REQUIRED" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20))
  const offset = (page - 1) * limit

  const { data: saves, error, count } = await supabase
    .from("saves")
    .select(`
      id,
      created_at,
      listing_id,
      listings!inner(
        id, name, slug, tagline, status, trust_tier,
        cities(name, slug),
        listing_details_business(phone, website_url)
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .is("listings.deleted_at", null)
    .eq("listings.status", "published")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: "Failed to fetch saves.", code: "SERVER_ERROR" }, { status: 500 })
  }

  const total = count ?? 0
  return NextResponse.json({
    data: saves ?? [],
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}
