import { resolveTourViewer } from '@/lib/tour/witness'
import { TourRail } from './TourRail'

// The rail's server-side gate (tester-tour-spec.md §7). This mounts in the
// root layout, so it runs on every page view sitewide — the constraints:
//
//   - Returns null on flag-off → signed-out → not-enrolled, IN THAT ORDER,
//     before the client chunk is referenced. resolveTourViewer checks exactly
//     that order internally, wraps its whole body in try/catch, and is
//     cache()d — so a page whose own <TourWitness> already resolved the
//     viewer shares that one resolution, and a visitor who is none of the
//     three pays the flag check alone.
//
//   - The layout path loads ONLY the enrollment (it does not even load the
//     six completion rows — less than the spec's ceiling). The per-step
//     state, including the derived saves/reviews evidence reads, is served
//     exclusively by GET /api/tour/state, which the client rail fetches on
//     mount. One source of truth for step status; zero derived reads on the
//     sitewide layout path.
//
//   - Nothing here can throw: resolveTourViewer returns null on any failure,
//     and a null viewer renders nothing. The rail throwing would take down
//     every page on the site.
export async function TourRailMount() {
  const viewer = await resolveTourViewer()
  if (!viewer) return null
  return <TourRail />
}
