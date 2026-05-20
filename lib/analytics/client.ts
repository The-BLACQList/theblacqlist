// Client-side analytics helper.
// Safe to import in "use client" components only — never in Server Components.
// All calls are fire-and-forget. Analytics must never break the user experience.

const ANALYTICS_ENDPOINT = "/api/analytics/event"
const SESSION_STORAGE_KEY = "blacq_sid"

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid)
    }
    return sid
  } catch {
    // sessionStorage unavailable (SSR guard, private browsing restrictions)
    return ""
  }
}

interface TrackEventInput {
  event_name: string
  entity_id?: string
  entity_type?: string
  // PRIVACY: no email, name, phone, or PII in properties
  properties?: Record<string, string | number | boolean | null | undefined>
}

/**
 * Fire-and-forget analytics event from the browser.
 * Uses sendBeacon when available (survives page unload); falls back to fetch with keepalive.
 * Swallows all errors silently.
 */
export function track(input: TrackEventInput): void {
  const payload = {
    event_name:  input.event_name,
    entity_id:   input.entity_id,
    entity_type: input.entity_type,
    properties:  input.properties,
    session_id:  getSessionId(),
  }

  const body = JSON.stringify(payload)

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(
        ANALYTICS_ENDPOINT,
        new Blob([body], { type: "application/json" })
      )
    } else {
      void fetch(ANALYTICS_ENDPOINT, {
        method:    "POST",
        headers:   { "Content-Type": "application/json" },
        body,
        keepalive: true,
      })
    }
  } catch {
    // analytics must never throw
  }
}
