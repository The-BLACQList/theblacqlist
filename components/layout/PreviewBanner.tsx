import { IS_PREVIEW } from '@/lib/env'

// Server component. Marks Vercel Preview deployments only, so a preview tab
// (staging data, Stripe test mode) is never mistaken for production. Renders
// nothing in production and local dev.
//
// It is a fixed pill in the bottom-left corner, not a strip in the page flow
// (ticket 232). The strip sat under the fixed header, so the header hid it and
// main's header padding then started below it, leaving a white band (24px, or
// 40px when it wrapped on a phone) under the header on every Preview page. On
// phones the pill sits above the listing page's bottom bar.
export function PreviewBanner() {
  if (!IS_PREVIEW) return null

  return (
    <div
      role="status"
      className="fixed left-3 bottom-20 md:bottom-3 z-[60] pointer-events-none rounded-full bg-amber-gold text-brand-black text-sm font-subhead font-bold uppercase tracking-wide px-3 py-1 shadow-md"
    >
      Preview: staging data, test payments
    </div>
  )
}
