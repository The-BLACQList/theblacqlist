interface Props {
  kicker: string
  heading: string
  headingId: string
  onDark?: boolean
}

/** Editorial section heading: uppercase kicker + gold rule + Jost h2. */
export function TemplateSectionHeading({ kicker, heading, headingId, onDark = false }: Props) {
  return (
    <div className="mb-6">
      <p
        className={`font-subhead text-xs font-bold uppercase tracking-[0.12em] mb-1.5 ${onDark ? 'text-gold' : 'text-amber'}`}
      >
        {kicker}
      </p>
      <div className="flex items-center gap-3">
        <span
          className={`w-7 h-[3px] rounded-sm shrink-0 ${onDark ? 'bg-gold' : 'bg-amber'}`}
          aria-hidden="true"
        />
        <h2
          id={headingId}
          className={`font-headline text-[23px] md:text-[28px] ${onDark ? 'text-white' : 'text-brand-black'}`}
        >
          {heading}
        </h2>
      </div>
    </div>
  )
}
