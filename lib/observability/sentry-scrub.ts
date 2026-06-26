import type { ErrorEvent } from '@sentry/nextjs'

// Strips personally identifiable information from Sentry events before they are
// sent (test K6). We do NOT rely solely on sendDefaultPii=false — this hook
// removes user contact fields, request payloads/cookies, and redacts email/
// phone-like strings from any free text. Keeps a non-identifying user.id only.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// 7+ digit runs (allowing spaces, dashes, dots, parens) — catches phone numbers.
const PHONE_RE = /(?:\+?\d[\d\-.\s()]{6,}\d)/g

function redact(value: string): string {
  return value.replace(EMAIL_RE, '[redacted-email]').replace(PHONE_RE, '[redacted-phone]')
}

export function scrubPii(event: ErrorEvent): ErrorEvent | null {
  // 1. User: keep only a non-identifying id; drop email / username / ip / name.
  if (event.user) {
    const { id } = event.user
    event.user = id ? { id } : {}
  }

  // 2. Request: drop body data, cookies, and any auth headers.
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    if (event.request.headers) {
      delete event.request.headers['cookie']
      delete event.request.headers['authorization']
    }
  }

  // 3. Free text: redact email/phone substrings from message + breadcrumbs.
  if (typeof event.message === 'string') {
    event.message = redact(event.message)
  }
  if (event.breadcrumbs) {
    for (const b of event.breadcrumbs) {
      if (typeof b.message === 'string') b.message = redact(b.message)
    }
  }
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === 'string') ex.value = redact(ex.value)
  }

  return event
}
