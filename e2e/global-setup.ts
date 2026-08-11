import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/auth'

/**
 * Provisions (idempotently) the admin account the e2e suite signs in as. Uses
 * the Supabase service-role client so it bypasses RLS and can write to
 * user_roles.
 *
 * Idempotent means *reconciled*, not merely *present*: the account's password
 * and confirmation state are set on every run, so a database that outlives a
 * single run (staging, in CI) cannot drift out from under the credentials in
 * helpers/auth.ts.
 *
 * The user_roles UNIQUE (user_id, role, listing_id) constraint treats NULL
 * listing_id values as distinct, so we check for an existing admin row before
 * inserting rather than relying on upsert/onConflict.
 */
async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'global-setup: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set ' +
        '(loaded from .env.local). Is local Supabase running (`npx supabase start`)?'
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Find or create the admin auth user.
  let userId: string | undefined

  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw new Error(`global-setup: listUsers failed — ${listError.message}`)
  userId = list.users.find((u) => u.email === ADMIN_EMAIL)?.id

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })
    if (createError || !created.user) {
      throw new Error(`global-setup: createUser failed — ${createError?.message}`)
    }
    userId = created.user.id
  } else {
    // Reconcile the password on every run. Until 2026-08-11 this branch did
    // nothing, which held only against a throwaway local database: on a
    // long-lived project the account survives from an earlier run with an
    // earlier password, so setup printed "admin ready" while every UI sign-in
    // failed. That is exactly how the first CI e2e run failed — the sign-in
    // server action answered 200 with {"error":"Incorrect email or password."}
    // and loginAsAdmin() timed out waiting for a redirect that was never coming.
    //
    // ADMIN_EMAIL is a test fixture (a11y-admin@test.local, unroutable TLD), so
    // this only ever rewrites an account this setup owns.
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })
    if (updateError) {
      throw new Error(`global-setup: updateUserById failed — ${updateError.message}`)
    }
  }

  // 2. Ensure a platform-wide admin role row exists (listing_id IS NULL).
  const { data: existingRole, error: roleReadError } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .is('listing_id', null)
    .maybeSingle()
  if (roleReadError) {
    throw new Error(`global-setup: read user_roles failed — ${roleReadError.message}`)
  }

  if (!existingRole) {
    const { error: insertError } = await admin
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin', listing_id: null })
    if (insertError) {
      throw new Error(`global-setup: insert admin role failed — ${insertError.message}`)
    }
  }

  console.log(`global-setup: admin ready (${ADMIN_EMAIL})`)
}

export default globalSetup
