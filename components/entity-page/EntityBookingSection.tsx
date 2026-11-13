'use client'

import { CalendarCheck } from 'lucide-react'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import type { BookingConfig } from '@/types'

interface Props {
  booking: BookingConfig | null | undefined
  /** Business name, for the heading. */
  name: string
  /**
   * When set, every field is disabled and this note replaces the submit
   * promise. The sample pages pass "Requests are off on the sample page."
   */
  inertNote?: string
  bare?: boolean
}

const INPUT =
  'w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 disabled:bg-cream disabled:text-charcoal-soft'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal mb-1.5'

/**
 * Booking / reservation request form (ticket 109; display here, the submit
 * action, Turnstile and owner inbox in Phase 6). Premium only — hidden until a
 * loader provides `booking`. Request-and-confirm, never instant booking.
 */
export function EntityBookingSection({ booking, name, inertNote, bare = false }: Props) {
  if (!booking) return null
  const inert = Boolean(inertNote)

  return (
    <section
      aria-labelledby="booking-heading"
      className={bare ? undefined : 'bg-white py-12 md:py-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        {bare ? (
          <TemplateSectionHeading
            kicker="Reserve a time"
            heading="Request a booking"
            headingId="booking-heading"
          />
        ) : (
          <h2
            id="booking-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-2"
          >
            Request a booking
          </h2>
        )}
        <p className="font-body text-sm text-charcoal max-w-prose mb-6">
          {booking.prompt ??
            `Tell ${name} when you'd like to come in and they'll confirm by email.`}
        </p>

        {/* Ticket 109 replaces this guard with the server action. Until then a
            submit must never reload the page or send anything anywhere. */}
        <form
          className="md:max-w-2xl rounded-2xl border border-charcoal/10 bg-cream/60 p-5 md:p-6"
          onSubmit={(e) => e.preventDefault()}
          aria-describedby={inert ? 'booking-inert-note' : undefined}
        >
          <fieldset disabled={inert} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <legend className="sr-only">Your request</legend>
            <div>
              <label htmlFor="booking-name" className={LABEL}>
                Your name
              </label>
              <input
                id="booking-name"
                name="name"
                type="text"
                autoComplete="name"
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="booking-email" className={LABEL}>
                Email
              </label>
              <input
                id="booking-email"
                name="email"
                type="email"
                autoComplete="email"
                className={INPUT}
              />
            </div>
            {booking.askDate && (
              <div>
                <label htmlFor="booking-date" className={LABEL}>
                  Preferred date
                </label>
                <input id="booking-date" name="requested_date" type="date" className={INPUT} />
              </div>
            )}
            <div>
              <label htmlFor="booking-window" className={LABEL}>
                Time of day
              </label>
              <select id="booking-window" name="time_window" className={INPUT} defaultValue="any">
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            {booking.askPartySize && (
              <div>
                <label htmlFor="booking-party" className={LABEL}>
                  Party size
                </label>
                <input
                  id="booking-party"
                  name="party_size"
                  type="number"
                  min={1}
                  max={500}
                  inputMode="numeric"
                  className={INPUT}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label htmlFor="booking-message" className={LABEL}>
                Anything else?
              </label>
              <textarea
                id="booking-message"
                name="message"
                rows={3}
                maxLength={1000}
                className={`${INPUT} h-auto py-2.5 resize-none`}
              />
            </div>
          </fieldset>

          <div className="flex items-center gap-4 flex-wrap mt-5">
            <button
              type="submit"
              disabled={inert}
              className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-gold"
            >
              <CalendarCheck className="size-4" aria-hidden="true" />
              Send request
            </button>
            <p id="booking-inert-note" className="font-body text-xs text-charcoal-soft">
              {inertNote ?? 'No payment is taken. The business confirms by email.'}
            </p>
          </div>
        </form>
      </div>
    </section>
  )
}
