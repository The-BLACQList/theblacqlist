import { TURNSTILE_ERROR } from '@/lib/security/turnstile'

/**
 * The messages subscribeLaunchAction can return, and the analytics error type
 * each one maps to.
 *
 * Kept out of subscribeLaunch.ts because a 'use server' module may export only
 * async functions. The forms import errorTypeFor to label the
 * launch_list_submit_error event (pre-launch R6) without parsing free text.
 *
 * INVALID_EMAIL is the capture-page wording from the marketing OS spec
 * (capture.md section 6: "Please check that email address.", keeping what was
 * typed). The others are unchanged from before.
 */
export const SUBSCRIBE_ERRORS = {
  MISSING_EMAIL: 'Please enter your email address.',
  INVALID_EMAIL: 'Please check that email address.',
  RATE_LIMITED: 'Too many attempts. Please try again in a few minutes.',
  SERVER: 'Something went wrong. Please try again.',
  TURNSTILE: TURNSTILE_ERROR,
} as const

export type SubscribeErrorType = 'missing_email' | 'invalid_email' | 'rate_limited' | 'server' | 'turnstile'

const TYPE_BY_MESSAGE = new Map<string, SubscribeErrorType>([
  [SUBSCRIBE_ERRORS.MISSING_EMAIL, 'missing_email'],
  [SUBSCRIBE_ERRORS.INVALID_EMAIL, 'invalid_email'],
  [SUBSCRIBE_ERRORS.RATE_LIMITED, 'rate_limited'],
  [SUBSCRIBE_ERRORS.SERVER, 'server'],
  [SUBSCRIBE_ERRORS.TURNSTILE, 'turnstile'],
])

/** The analytics error type for a returned message. Unknown text maps to 'server'. */
export function errorTypeFor(message: string): SubscribeErrorType {
  return TYPE_BY_MESSAGE.get(message) ?? 'server'
}
