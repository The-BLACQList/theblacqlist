// Cloudflare Turnstile verification for the server actions Supabase Auth does
// NOT cover (claims, reviews). The three auth actions do not use this helper —
// Supabase verifies their token itself when project-level CAPTCHA is enabled,
// and a Turnstile token is single-use, so verifying it twice fails the second
// call.
//
// If TURNSTILE_SECRET_KEY is unset this returns true and the guard is skipped.
// Same posture as SUBSCRIBE_RATE_LIMIT_SALT in lib/env.ts: degrading is
// acceptable so local dev and CI keep working without a Cloudflare credential;
// silently *appearing* to protect a route while rejecting every real user is
// not. Once the secret is set the check is fail-closed — a missing, malformed,
// reused, or expired token is rejected.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** The hidden input name the Turnstile widget injects into the surrounding form. */
export const TURNSTILE_TOKEN_FIELD = 'cf-turnstile-response'

/** User-facing copy for a failed challenge. Same shape the callers already return. */
export const TURNSTILE_ERROR = 'Verification failed. Please try again.'

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    // Cloudflare unreachable. Fail closed: the secret is configured, so the
    // operator has asked for this protection, and an outage must not become a
    // bypass. The caller surfaces TURNSTILE_ERROR and the user can retry.
    return false
  }
}

/** Convenience wrapper for server actions that receive a FormData. */
export async function verifyTurnstileFormData(
  formData: FormData,
  remoteIp?: string
): Promise<boolean> {
  const token = formData.get(TURNSTILE_TOKEN_FIELD)?.toString() ?? null
  return verifyTurnstileToken(token, remoteIp)
}
