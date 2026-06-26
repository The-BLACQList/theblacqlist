import { ChevronDown } from 'lucide-react'
import type { EntityFaq } from '@/types'

export function EntityFaqSection({ faqs }: { faqs: EntityFaq[] }) {
  if (!faqs || faqs.length === 0) return null

  return (
    <section aria-labelledby="faq-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="faq-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          Frequently asked questions
        </h2>
        <div className="md:max-w-3xl divide-y divide-charcoal/10 border-y border-charcoal/10">
          {faqs.map((faq) => (
            <details key={faq.id} className="group">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden py-4 font-subhead font-semibold text-base text-brand-black rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50">
                <span>{faq.question}</span>
                <ChevronDown
                  className="size-5 shrink-0 text-amber transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-4 font-body text-sm leading-relaxed text-charcoal whitespace-pre-line">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
