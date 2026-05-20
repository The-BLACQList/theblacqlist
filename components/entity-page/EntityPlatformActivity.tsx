import { Bookmark } from "lucide-react"
import type { EntityPageData } from "@/types"

interface Props {
  entity: EntityPageData
}

export function EntityPlatformActivity({ entity }: Props) {
  const hasSaves = entity.save_count > 0

  if (!hasSaves) return null

  return (
    <section
      aria-labelledby="activity-heading"
      className="bg-cream py-10 md:py-12"
    >
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="activity-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          On The BLACQList
        </h2>

        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Bookmark
              className="size-5 text-amber-gold"
              aria-hidden="true"
              fill="currentColor"
            />
            <span className="font-subhead text-sm text-charcoal">
              <span className="font-semibold text-brand-black">
                {entity.save_count.toLocaleString()}
              </span>{" "}
              {entity.save_count === 1 ? "person has" : "people have"} saved
              this listing
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
