import { NodeConstellation } from '@/components/brand/NodeConstellation'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'

/**
 * The public-site loading screen. It fills the content area only; the header and
 * footer come from the root layout and stay put. Nodes appear around the gold Q,
 * connect, then light up while the page streams in (keyframes in globals.css).
 *
 * Used by app/(public)/loading.tsx and app/[citySlug]/loading.tsx. The dashboard,
 * admin, and cities routes keep their own skeletons.
 */
export function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="blacq-loader grid min-h-[70vh] place-items-center bg-ground px-4 py-10"
    >
      <NodeConstellation variant="animate" style={{ width: 'min(88vw, 520px, 62vh)' }}>
        <GoldBrandMark preload className="relative h-14 w-14 md:h-16 md:w-16" />
      </NodeConstellation>
      <span className="sr-only">Loading</span>
    </div>
  )
}
