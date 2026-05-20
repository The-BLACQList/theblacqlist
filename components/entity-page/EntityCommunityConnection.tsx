import type { EntityPageData } from "@/types"

interface Props {
  entity: EntityPageData
}

export function EntityCommunityConnection({ entity }: Props) {
  return (
    <section
      aria-labelledby="community-heading"
      className="bg-white py-12 md:py-16"
    >
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="community-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
        >
          Community
        </h2>

        {/* Reviews placeholder */}
        <div className="bg-pale-lavender/60 rounded-xl p-8 text-center mb-6">
          <p className="font-headline text-lg text-brand-black mb-2">
            Reviews are coming soon
          </p>
          <p className="font-body text-sm text-charcoal max-w-sm mx-auto">
            The BLACQList community review system is in development. Be the
            first to share your experience with {entity.name}.
          </p>
        </div>

        {/* Community corrections */}
        <p className="font-body text-sm text-charcoal/70 text-center">
          Know something that needs to be updated?{" "}
          <a
            href={`/corrections?listing=${entity.id}`}
            className="text-amber-gold hover:text-light-gold underline underline-offset-2 font-subhead font-semibold"
          >
            Suggest a correction
          </a>
        </p>
      </div>
    </section>
  )
}
