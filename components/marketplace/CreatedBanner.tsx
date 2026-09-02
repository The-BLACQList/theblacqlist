import { CheckCircle2, EyeOff } from 'lucide-react'

interface CreatedBannerProps {
  /** The `?created=` value carried over from the create form. */
  status?: string
  kind: 'product' | 'service'
}

/**
 * Confirms what just happened after a create, and — when the owner chose Draft —
 * says plainly that it is not public and how to publish it. Without this, a draft
 * looks identical to a broken save: the row is in the dashboard and nowhere else.
 *
 * Any value other than 'active' or 'draft' renders nothing, so a stale or
 * hand-typed query string cannot put a false confirmation on the page.
 */
export function CreatedBanner({ status, kind }: CreatedBannerProps) {
  if (status !== 'active' && status !== 'draft') return null

  const noun = kind === 'product' ? 'Product' : 'Service'

  if (status === 'active') {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3"
      >
        <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
        <p className="font-body text-sm text-green-800">
          <span className="font-semibold">{noun} published.</span> It is live on your storefront and
          in the marketplace now.
        </p>
      </div>
    )
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg border border-charcoal/15 bg-off-white px-4 py-3"
    >
      <EyeOff className="size-4 mt-0.5 shrink-0 text-charcoal-soft" aria-hidden="true" />
      <p className="font-body text-sm text-charcoal">
        <span className="font-semibold">{noun} saved as a draft.</span> It is not publicly visible
        yet. Open it below and set Status to Active to publish it.
      </p>
    </div>
  )
}
