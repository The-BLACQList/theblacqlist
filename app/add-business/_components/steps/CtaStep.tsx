'use client'

import { cn } from '@/lib/utils'

const CTA_CARDS = [
  {
    value: 'book',
    label: 'Book an appointment',
    description: 'Let customers schedule with you',
    inputType: 'url' as const,
    inputLabel: 'Booking link',
    inputPlaceholder: 'https://cal.com/yourbusiness',
  },
  {
    value: 'order',
    label: 'Order online',
    description: 'Send customers to your online store or ordering system',
    inputType: 'url' as const,
    inputLabel: 'Order link',
    inputPlaceholder: 'https://yourbusiness.com/order',
  },
  {
    value: 'call',
    label: 'Call us',
    description: 'Show your phone number as the primary action',
    inputType: 'tel' as const,
    inputLabel: 'Phone number',
    inputPlaceholder: '(404) 555-0100',
  },
  {
    value: 'visit',
    label: 'Visit us',
    description: 'Point customers to your location or directions',
    inputType: 'url' as const,
    inputLabel: 'Directions link',
    inputPlaceholder: 'https://maps.google.com/?q=...',
  },
  {
    value: 'message',
    label: 'Send a message',
    description: 'Let customers contact you by email',
    inputType: 'email' as const,
    inputLabel: 'Contact email',
    inputPlaceholder: 'hello@yourbusiness.com',
  },
] as const

type CtaCardValue = (typeof CTA_CARDS)[number]['value']

interface Props {
  ctaType: string
  ctaUrl: string
  phone: string
  email: string
  onChange: (type: string, url: string) => void
}

export function CtaStep({ ctaType, ctaUrl, phone, email, onChange }: Props) {
  function selectCard(value: CtaCardValue) {
    // Pre-fill contextual value from earlier steps
    let prefilled = ''
    if (value === 'call') prefilled = phone
    else if (value === 'message') prefilled = email
    // Only pre-fill if ctaUrl is empty or was from a different card type
    const currentCard = CTA_CARDS.find((c) => c.value === ctaType)
    const sameType = currentCard?.value === value
    onChange(value, sameType ? ctaUrl : prefilled)
  }

  return (
    <div className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-4">
      <p className="font-subhead text-sm text-charcoal-soft leading-relaxed">
        Choose the primary action you want visitors to take when they find your listing.
      </p>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Primary call to action">
        {CTA_CARDS.map((card) => {
          const isSelected = ctaType === card.value
          return (
            <div key={card.value}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => selectCard(card.value)}
                className={cn(
                  'w-full text-left rounded-xl border px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2',
                  isSelected
                    ? 'border-l-4 border-amber-gold bg-amber-50'
                    : 'border-charcoal/20 bg-white hover:border-charcoal/40'
                )}
              >
                <p
                  className={cn(
                    'font-subhead text-sm font-semibold',
                    isSelected ? 'text-brand-black' : 'text-charcoal'
                  )}
                >
                  {card.label}
                </p>
                <p className="font-subhead text-xs text-charcoal-soft mt-0.5">{card.description}</p>
              </button>

              {isSelected && (
                <div className="mt-2 px-1">
                  <label
                    htmlFor={`cta-input-${card.value}`}
                    className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1.5"
                  >
                    {card.inputLabel}
                  </label>
                  <input
                    id={`cta-input-${card.value}`}
                    type={card.inputType}
                    value={ctaUrl}
                    onChange={(e) => onChange(ctaType, e.target.value)}
                    placeholder={card.inputPlaceholder}
                    className="h-11 w-full rounded-lg border border-charcoal/30 bg-white font-subhead text-sm text-brand-black px-3 placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
