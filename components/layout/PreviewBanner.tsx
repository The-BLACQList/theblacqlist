import { IS_PREVIEW } from '@/lib/env'

// Server component. Renders a slim strip on Vercel Preview deployments only,
// so a preview tab (staging data, Stripe test mode) is never mistaken for
// production. Renders nothing in production and local dev.
export function PreviewBanner() {
  if (!IS_PREVIEW) return null

  return (
    <div
      role="status"
      className="bg-amber-gold text-brand-black text-center text-xs font-subhead font-bold uppercase tracking-wide px-4 py-1"
    >
      Preview deployment: staging data, payments in test mode
    </div>
  )
}
