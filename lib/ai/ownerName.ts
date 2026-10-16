/**
 * Loads the signed-in owner's own name so it can be taken out of their text
 * before a prompt is built.
 *
 * The name never goes into a prompt. It is read only so `sanitizeForPrompt` can
 * remove it from the tagline and description (see `ownerNameTerms` in redact.ts).
 *
 * A person's name can live in two places:
 * - `profiles.display_name`, which the owner edits on their account page.
 * - Auth `user_metadata`, where sign-up stores `display_name`. `full_name` and
 *   `name` are read too, because that is where a social sign-in would put it.
 *
 * Both are read, because the two can drift apart after an edit. The request
 * client is used, so RLS limits the profile read to the owner's own row.
 *
 * Fails closed: if the profile read errors, or the session is gone or belongs to
 * someone else, it returns `{ ok: false }` and the caller sends nothing. No name
 * on file is not a failure; it is an empty list and redaction is skipped.
 */

import { createClient } from '@/lib/supabase/server'

export type OwnerNamesResult = { ok: true; names: string[] } | { ok: false }

const METADATA_NAME_KEYS = ['display_name', 'full_name', 'name'] as const

/** Pure half of the loader, so the rules can be tested without a database. */
export function ownerNamesFrom(
  metadata: Record<string, unknown> | null | undefined,
  profileDisplayName: unknown
): string[] {
  const out = new Map<string, string>()
  const add = (value: unknown) => {
    if (typeof value !== 'string') return
    const name = value.replace(/\s+/g, ' ').trim()
    if (name && !out.has(name.toLowerCase())) out.set(name.toLowerCase(), name)
  }
  add(profileDisplayName)
  for (const key of METADATA_NAME_KEYS) add(metadata?.[key])
  return [...out.values()]
}

/**
 * Returns the name(s) on file for `userId`, the user the caller has already
 * authenticated. Pass the same id the ownership check used.
 */
export async function loadOwnerNames(userId: string): Promise<OwnerNamesResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.id !== userId) return { ok: false }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
    if (error) return { ok: false }

    return { ok: true, names: ownerNamesFrom(user.user_metadata, profile?.display_name) }
  } catch {
    return { ok: false }
  }
}
