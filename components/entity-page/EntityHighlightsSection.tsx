import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import { highlightIcon } from '@/components/entity-page/highlightIcons'
import type { HighlightItem } from '@/types'

interface Props {
  highlights: HighlightItem[] | undefined
  /** Inside a two-column body: no band, no width wrapper, kicker-style heading. */
  bare?: boolean
  /** Overrides the heading the kind implies ("Why choose us" / "How it works"). */
  title?: string
}

/**
 * Highlights and process steps (ticket 195; display here, data in Phase 8).
 * `highlight` rows are an icon grid, `step` rows a numbered list. One kind
 * per section is the normal case; a mix renders the steps after the points.
 */
export function EntityHighlightsSection({ highlights, bare = false, title }: Props) {
  if (!highlights || highlights.length === 0) return null
  const points = highlights.filter((h) => h.kind === 'highlight')
  const steps = highlights.filter((h) => h.kind === 'step')
  const stepsOnly = points.length === 0
  const heading = title ?? (stepsOnly ? 'How it works' : 'Why choose us')
  const kicker = stepsOnly ? 'The process' : 'What sets us apart'

  return (
    <section
      aria-labelledby="highlights-heading"
      className={bare ? undefined : 'bg-pale-lavender py-12 md:py-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        {bare ? (
          <TemplateSectionHeading
            kicker={kicker}
            heading={heading}
            headingId="highlights-heading"
          />
        ) : (
          <h2
            id="highlights-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
          >
            {heading}
          </h2>
        )}

        {points.length > 0 && (
          <ul
            className={
              bare
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-5 list-none p-0 m-0'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 list-none p-0 m-0'
            }
          >
            {points.map((item) => {
              const Icon = highlightIcon(item.icon)
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl bg-white border border-charcoal/10 p-5"
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-full bg-deep-bg text-gold"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-subhead text-base font-semibold text-brand-black">
                      {item.title}
                    </h3>
                    {item.text && (
                      <p className="mt-1 font-body text-sm text-charcoal leading-relaxed">
                        {item.text}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {steps.length > 0 && (
          <ol
            className={`grid grid-cols-1 gap-5 list-none p-0 m-0 ${
              steps.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
            } ${points.length > 0 ? 'mt-8' : ''}`}
          >
            {steps.map((step, i) => {
              const Icon = highlightIcon(step.icon)
              return (
                <li
                  key={step.id}
                  className="relative flex flex-col gap-3 rounded-xl bg-pale-lavender border border-charcoal/10 p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-black font-headline text-base text-gold">
                      <span className="sr-only">Step </span>
                      {i + 1}
                    </span>
                    <Icon className="size-5 text-amber" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-subhead text-base font-semibold text-brand-black">
                      {step.title}
                    </h3>
                    {step.text && (
                      <p className="mt-1 font-body text-sm text-charcoal leading-relaxed">
                        {step.text}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
