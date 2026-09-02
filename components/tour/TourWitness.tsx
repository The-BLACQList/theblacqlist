import { recordTourWitness } from '@/lib/tour/witness'

// The server component pages embed to witness a tour step inside a real render
// (tester-tour-spec.md §7). It renders nothing and never throws —
// recordTourWitness swallows every failure, because this sits inside public
// pages that must not get slower or break because the tour exists.
//
// The discriminated props mirror recordTourWitness's overloads: witnessing
// `listing_opened` REQUIRES the listing owner's id at the type level, because
// opening your own listing is not evidence you explored the marketplace. The
// other two witness steps take no context.

type TourWitnessProps =
  | { step: 'listing_opened'; listingOwnerId: string | null }
  | { step: 'search_ran' | 'collection_browsed' }

export async function TourWitness(props: TourWitnessProps) {
  if (props.step === 'listing_opened') {
    await recordTourWitness('listing_opened', { listingOwnerId: props.listingOwnerId })
  } else {
    await recordTourWitness(props.step)
  }
  return null
}
