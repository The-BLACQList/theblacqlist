/**
 * Seed the three "Test Business 123" sample pages as real listings (ticket 187).
 *
 * /example/* renders the sample pages from fixtures on Preview. This script
 * writes the same fixtures into a database, so the live loaders, the
 * dashboard editors and every Premium section can be walked on staging with
 * real rows behind them. The plan is built by scripts/lib/example-seed-plan.ts
 * from lib/example/fixtures, so the seeded pages and the samples cannot drift.
 *
 * What it writes, per page (three pages: storefront, professional, creative):
 *   - one listing "Demo — Test Business 123 (…)", slug demo-test-business-123-…,
 *     noindex, published, Premium, verified, source 'admin', owned by
 *     --owner-email;
 *   - details, services, FAQs, links, attributes, videos, extra buttons, team,
 *     deals, posts, booking settings, credentials, documents, highlights,
 *     special hours, order-on links, where-sold stockists;
 *   - cover, logo and gallery photos (with albums) uploaded to listing-media;
 *   - its other locations as their own listings, linked back;
 *   - its shop items (marketplace products and services) and job listings;
 *   - with --with-reviews only: reviews from demo-reviewer-N@example.com
 *     accounts. Passwords are random, never printed and never needed.
 * Never: payments, purchases, receipts, payouts or any other money row.
 *
 * TARGET: chosen only by SUPABASE_URL. scripts/lib/seed-guards.ts refuses
 * production outright, runs local without ceremony, and allows a remote host
 * only when it is staging AND the run says --yes. Every staging run is
 * confirmed by the founder first.
 *
 * Tables that don't exist on the target yet are skipped with a warning, so the
 * seed can run before every follow-up ticket's migration has landed.
 *
 * Usage:
 *   npx tsx scripts/seed-example-business.ts --dry-run
 *       → prints the plan. No env, no network.
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx scripts/seed-example-business.ts --owner-email=you@example.com [--with-reviews]
 *   SUPABASE_URL=https://fmbohsloskqbmlwbzpjm.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx scripts/seed-example-business.ts --owner-email=you@example.com --yes
 *   …same, plus --purge → removes every seeded listing, its photos and
 *     documents, and the demo reviewer accounts, and prints the counts.
 *
 * The owner email is a flag, never a constant: no personal address in the repo.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertTargetConfirmed, flagValue, hasFlag } from './lib/seed-guards'
import {
  REVIEWER_EMAIL_RE,
  SEED_ASSET_ROOT,
  buildSeedPlans,
  placeholderPdf,
  reviewerDisplayName,
  reviewerEmail,
  seedSlugs,
  type ExampleSeedPlan,
  type SeedListingCore,
  type SeedPhoto,
} from './lib/example-seed-plan'

const argv = process.argv
const DRY_RUN = hasFlag(argv, '--dry-run')
const PURGE = hasFlag(argv, '--purge')
const WITH_REVIEWS = hasFlag(argv, '--with-reviews')
const OWNER_EMAIL = flagValue(argv, '--owner-email')

const MEDIA_BUCKET = 'listing-media'
const DOCS_BUCKET = 'listing-documents'
const TAG = '[example-seed]'

// Any client: the generated Database type doesn't know tables whose
// migrations haven't landed yet, and those are exactly the ones skipped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, 'public', any>

interface DbError {
  code?: string
  message: string
}

/** A table or column the target doesn't have yet. */
function isMissing(error: DbError | null | undefined): boolean {
  return ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error?.code ?? '')
}

const tally = { written: 0, skipped: 0, errors: 0 }
const warnedTables = new Set<string>()

function skip(table: string, error: DbError): void {
  tally.skipped++
  if (warnedTables.has(table)) return
  warnedTables.add(table)
  console.warn(`  ! ${table}: not on this target yet, skipped (${error.message})`)
}

function fail(what: string, error: DbError | string): void {
  tally.errors++
  console.error(`  ✗ ${what}: ${typeof error === 'string' ? error : error.message}`)
}

/** Runs one write. Returns false on a missing table (warned) or an error (counted). */
async function step(
  table: string,
  label: string,
  run: () => PromiseLike<{ error: DbError | null }>
): Promise<boolean> {
  const { error } = await run()
  if (!error) {
    tally.written++
    return true
  }
  if (isMissing(error)) skip(table, error)
  else fail(`${label} (${table})`, error)
  return false
}

/** Replaces a page's rows in a child table: delete by listing_id, then insert. */
async function replaceRows(
  supabase: Client,
  table: string,
  listingId: string,
  rows: Record<string, unknown>[],
  label: string
): Promise<void> {
  const cleared = await step(table, `${label} clear`, () =>
    supabase.from(table).delete().eq('listing_id', listingId)
  )
  if (!cleared || rows.length === 0) return
  await step(table, label, () =>
    supabase.from(table).insert(rows.map((r) => ({ listing_id: listingId, ...r })))
  )
}

// ── Lookups ──────────────────────────────────────────────────────────────────

/**
 * A random password no one ever sees or needs. The fixed tail meets password
 * rules that ask for a lower-case letter, a capital, a digit and a symbol;
 * the 192 random bits before it are the secret.
 */
function reviewerPassword(): string {
  return `${randomBytes(24).toString('base64url')}aA1!`
}

async function resolveOwner(supabase: Client, email: string): Promise<string> {
  const wanted = email.toLowerCase()
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`Could not list users: ${error.message}`)
    const users = data?.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === wanted)
    if (match) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', match.id)
        .maybeSingle()
      if (!profile) {
        throw new Error(
          'That account has no profiles row on this target. Sign in once there, then re-run.'
        )
      }
      return match.id
    }
    if (users.length < 200) break
  }
  throw new Error('No account for that address on this target. Sign up there first.')
}

async function lookups(supabase: Client) {
  const [cities, categories, attributes] = await Promise.all([
    supabase.from('cities').select('id, slug'),
    supabase.from('categories').select('id, slug'),
    supabase.from('attribute_values').select('id, slug'),
  ])
  if (cities.error || categories.error) {
    throw new Error(`Lookup failed: ${cities.error?.message ?? categories.error?.message}`)
  }
  const map = (rows: { id: string; slug: string }[] | null) =>
    new Map((rows ?? []).map((r) => [r.slug, r.id]))
  return {
    cities: map(cities.data),
    categories: map(categories.data),
    attributes: map(attributes.error ? [] : attributes.data),
  }
}

type Lookups = Awaited<ReturnType<typeof lookups>>

// ── Storage ──────────────────────────────────────────────────────────────────

function contentType(file: string): string {
  if (file.endsWith('.png')) return 'image/png'
  if (/\.jpe?g$/.test(file)) return 'image/jpeg'
  return 'image/webp'
}

/** Uploads one sample photo to listings/{id}/{role}/{file}. Returns its key and size. */
async function uploadPhoto(
  supabase: Client,
  listingId: string,
  role: string,
  file: string
): Promise<{ key: string; size: number } | null> {
  let bytes: Buffer
  try {
    bytes = await readFile(path.join(process.cwd(), SEED_ASSET_ROOT, file))
  } catch {
    fail(`photo ${file}`, 'not found under public/images/example')
    return null
  }
  const key = `listings/${listingId}/${role}/${file}`
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(key, bytes, { contentType: contentType(file), upsert: true })
  if (error) {
    fail(`upload ${key}`, error.message)
    return null
  }
  return { key, size: bytes.length }
}

function publicUrl(supabase: Client, key: string): string {
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(key).data.publicUrl
}

/** Removes every object under listings/{id}/ in a bucket, one folder level deep. */
async function removeListingObjects(
  supabase: Client,
  bucket: string,
  listingId: string
): Promise<number> {
  const root = `listings/${listingId}`
  const { data: top, error } = await supabase.storage.from(bucket).list(root, { limit: 1000 })
  if (error || !top) return 0
  const keys: string[] = []
  for (const entry of top) {
    if (entry.id) {
      keys.push(`${root}/${entry.name}`)
      continue
    }
    const { data: inner } = await supabase.storage
      .from(bucket)
      .list(`${root}/${entry.name}`, { limit: 1000 })
    for (const f of inner ?? []) if (f.id) keys.push(`${root}/${entry.name}/${f.name}`)
  }
  if (keys.length === 0) return 0
  const { error: rmErr } = await supabase.storage.from(bucket).remove(keys)
  if (rmErr) {
    fail(`remove ${bucket}/${root}`, rmErr.message)
    return 0
  }
  return keys.length
}

// ── Listings ─────────────────────────────────────────────────────────────────

async function upsertListing(
  supabase: Client,
  core: SeedListingCore,
  ownerId: string,
  look: Lookups,
  fallbackCityId: string | null
): Promise<string | null> {
  const categoryId = look.categories.get(core.category_slug)
  if (!categoryId) {
    fail(core.slug, `category "${core.category_slug}" not found on this target`)
    return null
  }
  const cityId =
    look.cities.get(core.city_slug) ??
    [...look.cities].find(([slug]) => slug.startsWith(`${core.city_slug}-`))?.[1] ??
    fallbackCityId
  if (!cityId) {
    fail(core.slug, `city "${core.city_slug}" not found on this target`)
    return null
  }
  const { data, error } = await supabase
    .from('listings')
    .upsert(
      {
        slug: core.slug,
        name: core.name,
        entity_type: core.entity_type,
        category_id: categoryId,
        city_id: cityId,
        ...(core.primary_level ? { primary_level: core.primary_level } : {}),
        extra_levels: core.extra_levels,
        tagline: core.tagline,
        meta_title: core.meta_title,
        meta_description: core.meta_description,
        location_type: core.location_type,
        ownership_label: core.ownership_label,
        open_to_partnerships: core.open_to_partnerships,
        noindex: true,
        status: 'published',
        tier: 'premium',
        trust_tier: 'verified',
        source: 'admin',
        owner_user_id: ownerId,
        submitted_by: ownerId,
        updated_by: ownerId,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'slug' }
    )
    .select('id')
    .maybeSingle()
  if (error || !data) {
    fail(core.slug, error ?? 'no row returned')
    return null
  }
  tally.written++
  return data.id as string
}

async function seedPhotos(
  supabase: Client,
  plan: ExampleSeedPlan,
  listingId: string,
  ownerId: string
): Promise<void> {
  const paths: Record<string, string | null> = {}
  for (const [role, photo] of [
    ['cover', plan.cover],
    ['logo', plan.logo],
  ] as const) {
    if (!photo) continue
    const up = await uploadPhoto(supabase, listingId, role, photo.file)
    if (up) paths[role === 'cover' ? 'cover_image_path' : 'logo_path'] = up.key
  }
  if (Object.keys(paths).length > 0) {
    await step('listings', `${plan.listing.slug} cover/logo`, () =>
      supabase.from('listings').update(paths).eq('id', listingId)
    )
  }

  const rows: Record<string, unknown>[] = []
  for (const [i, photo] of plan.gallery.entries()) {
    const up = await uploadPhoto(supabase, listingId, 'gallery', photo.file)
    if (!up) continue
    rows.push(mediaRow(listingId, ownerId, photo, up, i))
  }
  const cleared = await step('media_attachments', `${plan.listing.slug} gallery clear`, () =>
    supabase
      .from('media_attachments')
      .delete()
      .eq('entity_type', 'listing')
      .eq('entity_id', listingId)
  )
  if (!cleared || rows.length === 0) return
  const first = await supabase.from('media_attachments').insert(rows)
  if (!first.error) {
    tally.written++
    return
  }
  if (!isMissing(first.error)) {
    fail(`${plan.listing.slug} gallery (media_attachments)`, first.error)
    return
  }
  // The album column (ticket 193) isn't on the target yet: add the photos unfiled.
  console.warn(`  ! media_attachments.album: not on this target yet, photos added without albums`)
  await step('media_attachments', `${plan.listing.slug} gallery`, () =>
    supabase.from('media_attachments').insert(rows.map(({ album: _album, ...r }) => r))
  )
}

function mediaRow(
  listingId: string,
  ownerId: string,
  photo: SeedPhoto,
  up: { key: string; size: number },
  order: number
): Record<string, unknown> {
  return {
    entity_type: 'listing',
    entity_id: listingId,
    file_path: up.key,
    file_type: contentType(photo.file),
    file_size_bytes: up.size,
    uploaded_by: ownerId,
    display_order: order,
    alt_text: photo.alt,
    is_approved: true,
    album: photo.album,
  }
}

async function seedPosts(supabase: Client, plan: ExampleSeedPlan, listingId: string) {
  const rows: Record<string, unknown>[] = []
  for (const { photo, ...post } of plan.posts) {
    const up = photo ? await uploadPhoto(supabase, listingId, 'post', photo) : null
    rows.push({ ...post, image_path: up?.key ?? null })
  }
  await replaceRows(supabase, 'listing_posts', listingId, rows, `${plan.listing.slug} posts`)
}

async function seedDocuments(supabase: Client, plan: ExampleSeedPlan, listingId: string) {
  const cleared = await step('listing_documents', `${plan.listing.slug} documents clear`, () =>
    supabase.from('listing_documents').delete().eq('listing_id', listingId)
  )
  if (!cleared) return
  await removeListingObjects(supabase, DOCS_BUCKET, listingId)
  const rows: Record<string, unknown>[] = []
  for (const [i, doc] of plan.documents.entries()) {
    const bytes = placeholderPdf(doc.title)
    const key = `listings/${listingId}/documents/${randomUUID()}.pdf`
    const { error } = await supabase.storage
      .from(DOCS_BUCKET)
      .upload(key, bytes, { contentType: 'application/pdf', upsert: true })
    if (error) {
      fail(`upload ${DOCS_BUCKET}/${key}`, error.message)
      continue
    }
    rows.push({
      listing_id: listingId,
      label: doc.label,
      path: key,
      size_bytes: bytes.length,
      sort_order: i,
    })
  }
  if (rows.length === 0) return
  await step('listing_documents', `${plan.listing.slug} documents`, () =>
    supabase.from('listing_documents').insert(rows)
  )
}

async function seedStockists(supabase: Client, plan: ExampleSeedPlan, listingId: string) {
  const cleared = await step('listing_stockists', `${plan.listing.slug} stockists clear`, () =>
    supabase.from('listing_stockists').delete().eq('listing_id', listingId)
  )
  if (!cleared) return
  for (const { areas, ...stockist } of plan.stockists) {
    const { data, error } = await supabase
      .from('listing_stockists')
      .insert({ listing_id: listingId, ...stockist })
      .select('id')
      .maybeSingle()
    if (error || !data) {
      if (error && isMissing(error)) skip('listing_stockists', error)
      else fail(`${plan.listing.slug} stockist`, error ?? 'no row returned')
      continue
    }
    tally.written++
    if (areas.length === 0) continue
    await step('listing_stockist_areas', `${plan.listing.slug} stockist areas`, () =>
      supabase
        .from('listing_stockist_areas')
        .insert(areas.map((a) => ({ stockist_id: data.id, ...a })))
    )
  }
}

async function seedLocations(
  supabase: Client,
  plan: ExampleSeedPlan,
  listingId: string,
  ownerId: string,
  look: Lookups,
  mainCityId: string | null
) {
  const ids: string[] = []
  for (const loc of plan.locations) {
    const id = await upsertListing(supabase, loc.listing, ownerId, look, mainCityId)
    if (!id) continue
    ids.push(id)
    await step('listing_details_business', `${loc.listing.slug} details`, () =>
      supabase
        .from('listing_details_business')
        .upsert({ listing_id: id, ...loc.details }, { onConflict: 'listing_id' })
    )
  }
  const cleared = await step('listing_location_links', `${plan.listing.slug} locations clear`, () =>
    supabase.from('listing_location_links').delete().eq('primary_listing_id', listingId)
  )
  if (!cleared || ids.length === 0) return
  await step('listing_location_links', `${plan.listing.slug} locations`, () =>
    supabase.from('listing_location_links').insert(
      ids.map((id) => ({
        primary_listing_id: listingId,
        location_listing_id: id,
        owner_user_id: ownerId,
      }))
    )
  )
}

async function seedShop(
  supabase: Client,
  plan: ExampleSeedPlan,
  listingId: string,
  ownerId: string
) {
  const products: Record<string, unknown>[] = []
  const services: Record<string, unknown>[] = []
  for (const item of plan.shop) {
    const up = item.photo ? await uploadPhoto(supabase, listingId, 'shop', item.photo) : null
    const common = {
      name: item.name,
      slug: item.slug,
      global_slug: item.global_slug,
      price_display_text: item.price_display_text,
      cover_image_url: up ? publicUrl(supabase, up.key) : null,
      status: 'active',
      created_by: ownerId,
      description: `${item.name}. A sample item on a staging demo page.`,
    }
    if (item.kind === 'product') {
      products.push({ ...common, price_cents: item.price_cents, shipping_options: 'shipping' })
    } else {
      services.push({ ...common, starting_price_cents: item.price_cents, delivery_mode: 'virtual' })
    }
  }
  await replaceRows(
    supabase,
    'marketplace_products',
    listingId,
    products,
    `${plan.listing.slug} products`
  )
  await replaceRows(
    supabase,
    'marketplace_services',
    listingId,
    services,
    `${plan.listing.slug} services`
  )
}

async function seedJobs(
  supabase: Client,
  plan: ExampleSeedPlan,
  listingId: string,
  ownerId: string,
  look: Lookups,
  mainCityId: string | null
) {
  for (const job of plan.jobs) {
    const id = await upsertListing(supabase, job.listing, ownerId, look, mainCityId)
    if (!id) continue
    await step('listing_details_job', `${job.listing.slug} details`, () =>
      supabase
        .from('listing_details_job')
        .upsert(
          { listing_id: id, hiring_listing_id: listingId, ...job.details },
          { onConflict: 'listing_id' }
        )
    )
  }
}

// ── Reviewers ────────────────────────────────────────────────────────────────

async function listAllUsers(supabase: Client) {
  const out: { id: string; email?: string }[] = []
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`Could not list users: ${error.message}`)
    const users = data?.users ?? []
    out.push(...users.map((u) => ({ id: u.id, email: u.email })))
    if (users.length < 200) break
  }
  return out
}

/** Finds or creates demo-reviewer-1…n. Passwords are random and never printed. */
async function ensureReviewers(supabase: Client, n: number): Promise<string[]> {
  const existing = new Map(
    (await listAllUsers(supabase))
      .filter((u) => u.email && REVIEWER_EMAIL_RE.test(u.email))
      .map((u) => [u.email as string, u.id])
  )
  const ids: string[] = []
  for (let i = 1; i <= n; i++) {
    const email = reviewerEmail(i)
    let id = existing.get(email)
    if (!id) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: reviewerPassword(),
        email_confirm: true,
      })
      if (error || !data.user) {
        fail(`reviewer ${email}`, error?.message ?? 'no user returned')
        continue
      }
      id = data.user.id
      tally.written++
    }
    await step('profiles', `reviewer ${i} name`, () =>
      supabase
        .from('profiles')
        .update({ display_name: reviewerDisplayName(i) })
        .eq('id', id)
    )
    ids.push(id)
  }
  return ids
}

async function seedReviews(
  supabase: Client,
  plan: ExampleSeedPlan,
  listingId: string,
  reviewerIds: string[]
) {
  const rows = plan.reviews.slice(0, reviewerIds.length).map((r, i) => ({
    ...r,
    reviewer_user_id: reviewerIds[i],
    status: 'published',
  }))
  const cleared = await step('reviews', `${plan.listing.slug} reviews clear`, () =>
    supabase
      .from('reviews')
      .delete()
      .eq('listing_id', listingId)
      .in('reviewer_user_id', reviewerIds)
  )
  if (!cleared || rows.length === 0) return
  await step('reviews', `${plan.listing.slug} reviews`, () =>
    supabase.from('reviews').insert(rows.map((r) => ({ listing_id: listingId, ...r })))
  )
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seedPlan(
  supabase: Client,
  plan: ExampleSeedPlan,
  ownerId: string,
  look: Lookups,
  reviewerIds: string[]
): Promise<void> {
  console.log(`\n${plan.listing.name}`)
  const listingId = await upsertListing(supabase, plan.listing, ownerId, look, null)
  if (!listingId) return
  const mainCityId = look.cities.get(plan.listing.city_slug) ?? null
  const slug = plan.listing.slug

  await step('listing_details_business', `${slug} details`, () =>
    supabase
      .from('listing_details_business')
      .upsert({ listing_id: listingId, ...plan.details }, { onConflict: 'listing_id' })
  )
  await seedPhotos(supabase, plan, listingId, ownerId)

  const attributeIds = plan.attributeSlugs.flatMap((s) => look.attributes.get(s) ?? [])
  const missingAttrs = plan.attributeSlugs.length - attributeIds.length
  if (missingAttrs > 0) console.log(`  · ${missingAttrs} attribute(s) not on this target, left off`)
  await replaceRows(
    supabase,
    'listing_attributes',
    listingId,
    attributeIds.map((value_id) => ({ value_id })),
    `${slug} attributes`
  )

  const simple: [string, Record<string, unknown>[]][] = [
    ['services', plan.services],
    ['listing_faqs', plan.faqs],
    ['listing_links', plan.links],
    ['listing_videos', plan.videos],
    ['listing_buttons', plan.buttons],
    ['listing_team_members', plan.team],
    ['listing_deals', plan.deals],
    ['listing_credentials', plan.credentials],
    ['listing_highlights', plan.highlights],
    ['listing_hours_overrides', plan.hoursOverrides],
    ['listing_order_platforms', plan.orderPlatforms],
  ]
  for (const [table, rows] of simple) {
    await replaceRows(supabase, table, listingId, rows, `${slug} ${table}`)
  }

  if (plan.booking) {
    const booking = plan.booking
    await step('listing_booking_settings', `${slug} booking`, () =>
      supabase
        .from('listing_booking_settings')
        .upsert({ listing_id: listingId, ...booking }, { onConflict: 'listing_id' })
    )
  }
  await seedPosts(supabase, plan, listingId)
  await seedDocuments(supabase, plan, listingId)
  await seedStockists(supabase, plan, listingId)
  await seedLocations(supabase, plan, listingId, ownerId, look, mainCityId)
  await seedShop(supabase, plan, listingId, ownerId)
  await seedJobs(supabase, plan, listingId, ownerId, look, mainCityId)
  if (reviewerIds.length > 0) await seedReviews(supabase, plan, listingId, reviewerIds)

  console.log(`  ✓ /${plan.listing.city_slug}/${plan.listing.entity_type}/${slug}`)
}

async function seed(supabase: Client, plans: ExampleSeedPlan[]): Promise<void> {
  const ownerId = await resolveOwner(supabase, OWNER_EMAIL)
  console.log(`Owner resolved: user_id ${ownerId}`)
  const look = await lookups(supabase)
  const reviewerIds = WITH_REVIEWS
    ? await ensureReviewers(supabase, Math.max(...plans.map((p) => p.reviews.length)))
    : []
  for (const plan of plans) await seedPlan(supabase, plan, ownerId, look, reviewerIds)
}

// ── Purge ────────────────────────────────────────────────────────────────────

async function purge(supabase: Client, plans: ExampleSeedPlan[]): Promise<void> {
  const slugs = seedSlugs(plans)
  const { data: found, error } = await supabase
    .from('listings')
    .select('id, slug')
    .in('slug', slugs)
  if (error) throw new Error(`Could not read the seeded listings: ${error.message}`)
  const ids = (found ?? []).map((r) => r.id as string)

  let objects = 0
  for (const id of ids) {
    objects += await removeListingObjects(supabase, MEDIA_BUCKET, id)
    objects += await removeListingObjects(supabase, DOCS_BUCKET, id)
  }

  let media = 0
  if (ids.length > 0) {
    const { data, error: mErr } = await supabase
      .from('media_attachments')
      .delete()
      .eq('entity_type', 'listing')
      .in('entity_id', ids)
      .select('id')
    if (mErr) fail('media_attachments', mErr)
    media = data?.length ?? 0
  }

  // Child rows, locations links, marketplace items and reviews go with the
  // listing (ON DELETE CASCADE).
  const { data: removed, error: lErr } = await supabase
    .from('listings')
    .delete()
    .in('slug', slugs)
    .select('slug')
  if (lErr) fail('listings', lErr)

  let users = 0
  for (const u of await listAllUsers(supabase)) {
    if (!u.email || !REVIEWER_EMAIL_RE.test(u.email)) continue
    const { error: uErr } = await supabase.auth.admin.deleteUser(u.id)
    if (uErr) fail(`reviewer ${u.email}`, uErr.message)
    else users++
  }

  console.log(
    `${TAG} Purged: ${removed?.length ?? 0} of ${slugs.length} listings, ${media} gallery rows, ` +
      `${objects} storage objects, ${users} demo reviewer accounts.`
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

function printPlan(plans: ExampleSeedPlan[]): void {
  console.log(`${TAG} DRY RUN: no target contacted, nothing written.`)
  for (const p of plans) {
    const counts = {
      gallery: p.gallery.length,
      services: p.services.length,
      faqs: p.faqs.length,
      links: p.links.length,
      attributes: p.attributeSlugs.length,
      videos: p.videos.length,
      buttons: p.buttons.length,
      team: p.team.length,
      deals: p.deals.length,
      posts: p.posts.length,
      credentials: p.credentials.length,
      documents: p.documents.length,
      highlights: p.highlights.length,
      specialHours: p.hoursOverrides.length,
      orderOn: p.orderPlatforms.length,
      stockists: p.stockists.length,
      locations: p.locations.length,
      shop: p.shop.length,
      jobs: p.jobs.length,
      reviews: WITH_REVIEWS ? p.reviews.length : 0,
    }
    console.log(`\n${p.listing.name} → ${p.listing.slug}`)
    console.log(
      '  ' +
        Object.entries(counts)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')
    )
  }
  console.log(`\nSlugs a --purge removes: ${seedSlugs(plans).join(', ')}`)
}

async function main(): Promise<void> {
  const plans = buildSeedPlans(new Date())
  if (DRY_RUN) {
    printPlan(plans)
    return
  }

  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exit(1)
  }
  if (!PURGE && !OWNER_EMAIL) {
    console.error('Error: --owner-email=<email> is required. The pages belong to that account.')
    process.exit(1)
  }
  assertTargetConfirmed(url, argv)
  const supabase: Client = createClient(url, key, { auth: { persistSession: false } })

  if (PURGE) await purge(supabase, plans)
  else await seed(supabase, plans)

  console.log(
    `${TAG} Done: ${tally.written} writes, ${tally.skipped} skipped (table not on target), ` +
      `${tally.errors} errors.`
  )
  if (tally.errors > 0) process.exit(1)
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
