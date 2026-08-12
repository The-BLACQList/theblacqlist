// =============================================================================
// Saved-list name normalization
// =============================================================================
// The database is the authority on what a list name may be, and this file has
// to agree with it exactly. `20260812000000_saved_lists.sql` defines:
//
//   CHECK (char_length(btrim(name, E' \t\r\n')) BETWEEN 1 AND 60)
//   UNIQUE INDEX ON (user_id, lower(btrim(name, E' \t\r\n')))
//
// Note the two-argument `btrim`. Postgres' one-argument `btrim(text)` strips
// **spaces only** — it leaves tabs and newlines in place. The migration passes
// the explicit set `E' \t\r\n'` so a name of "\t" is rejected rather than
// stored as a one-character list. `normalizeListName` below trims the same four
// characters for the same reason: if it trimmed more (or fewer) than the DB,
// the client and the CHECK would disagree about which names are legal.
//
// Kept pure and dependency-free so it can be unit-tested without a database —
// the same reason `lib/admin/userLabel.ts` exists as its own module.
// =============================================================================

/** Matches Postgres `btrim(name, E' \t\r\n')` — space, tab, CR, LF. Nothing else. */
const TRIM_PATTERN = /^[ \t\r\n]+|[ \t\r\n]+$/g

/** Mirrors the migration's CHECK constraint upper bound. */
export const MAX_LIST_NAME_LENGTH = 60

/** Strip leading/trailing whitespace using exactly the DB's trim set. */
export function normalizeListName(raw: string): string {
  return raw.replace(TRIM_PATTERN, '')
}

/**
 * The form the unique index compares on: `lower(btrim(...))`.
 *
 * Used for the client-side duplicate pre-check, which is a courtesy only — the
 * unique index is the real guard, and the action still has to handle `23505`.
 * A pre-check cannot be authoritative because two tabs can race it.
 */
export function listNameKey(raw: string): string {
  return normalizeListName(raw).toLowerCase()
}

export type ListNameError = 'empty' | 'too_long'

/**
 * Validate a candidate name against the DB constraint.
 *
 * Returns the normalized name on success so callers store exactly what was
 * validated, rather than re-deriving it and drifting.
 */
export function validateListName(
  raw: string
): { ok: true; name: string } | { ok: false; reason: ListNameError; message: string } {
  const name = normalizeListName(raw)

  if (name.length === 0) {
    return { ok: false, reason: 'empty', message: 'Give the list a name.' }
  }
  if (name.length > MAX_LIST_NAME_LENGTH) {
    return {
      ok: false,
      reason: 'too_long',
      message: `List names must be ${MAX_LIST_NAME_LENGTH} characters or fewer.`,
    }
  }

  return { ok: true, name }
}
