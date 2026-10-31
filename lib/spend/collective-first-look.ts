/**
 * The Collective's first look (ticket 161) — which button the hero shows.
 *
 * Three states, picked from who is reading and what they have sent in:
 *
 *   - `out`  signed out → "Sign in to add a receipt", back to the add form after.
 *   - `new`  signed in, no receipts yet → "Add your first receipt".
 *   - `has`  signed in with at least one receipt → "Add a receipt", plus a
 *            quiet "My receipts" link and the counted total.
 *
 * A failed count read falls back to `new`, not `has`: the worst outcome of
 * that guess is a "first" button shown to someone with receipts, which still
 * goes to the right form. Guessing `has` would show a counted total we never
 * read.
 */

export type FirstLookState = 'out' | 'new' | 'has'

export interface FirstLookInput {
  signedIn: boolean
  /** Every receipt the reader has sent in, whatever its status. */
  receiptCount: number
  /** True when the count read errored, so `receiptCount` can't be trusted. */
  countFailed: boolean
}

export function pickFirstLookState({
  signedIn,
  receiptCount,
  countFailed,
}: FirstLookInput): FirstLookState {
  if (!signedIn) return 'out'
  if (countFailed) return 'new'
  return receiptCount > 0 ? 'has' : 'new'
}

/** Where the signed-out button sends the reader: sign in, then the add form. */
export const FIRST_LOOK_SIGN_IN_HREF = '/sign-in?next=/account/receipts/new'
