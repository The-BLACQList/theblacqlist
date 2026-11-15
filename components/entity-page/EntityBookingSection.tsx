'use client'

import { useActionState } from 'react'
import { CalendarCheck, CheckCircle2 } from 'lucide-react'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import { HoneypotField } from '@/components/security/HoneypotField'
import { TurnstileWidget } from '@/components/security/TurnstileWidget'
import {
  submitBookingRequestAction,
  type BookingRequestState,
} from '@/lib/actions/booking/submitBookingRequest'
import {
  BOOKING_NOTE_MAX,
  BOOKING_PARTY_MAX,
  type BookingFieldErrors,
} from '@/lib/listings/booking'
import type { BookingConfig, ServiceItem } from '@/types'

interface Props {
  booking: BookingConfig | null | undefined
  /** Business name, for the heading. */
  name: string
  /** The page's id. Without it the form can't send, so it stays inert. */
  listingId?: string
  /** The page's services, offered as an optional "which one" pick. */
  services?: ServiceItem[]
  /**
   * When set, every field is disabled and this note replaces the submit
   * promise. The sample pages pass "Requests are off on the sample page."
   */
  inertNote?: string
  bare?: boolean
}

const INPUT =
  'w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 disabled:bg-cream disabled:text-charcoal-soft aria-[invalid=true]:border-red-600'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal mb-1.5'

type Field = keyof BookingFieldErrors

function FieldError({ errors, field }: { errors: BookingFieldErrors; field: Field }) {
  const message = errors[field]
  if (!message) return null
  return (
    <p id={`booking-${field}-error`} className="mt-1 font-body text-xs text-red-700">
      {message}
    </p>
  )
}

/** Today in the visitor's own time zone, for the date picker's minimum. */
function localToday(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/**
 * Booking request form (ticket 109). Premium only, hidden until the loader
 * provides `booking` (the owner switched the form on). Request-and-confirm,
 * never instant booking: the visitor asks, the owner answers from their
 * dashboard, and the visitor hears back by email.
 */
export function EntityBookingSection({
  booking,
  name,
  listingId,
  services,
  inertNote,
  bare = false,
}: Props) {
  const [state, formAction, isPending] = useActionState<BookingRequestState, FormData>(
    submitBookingRequestAction,
    null
  )
  if (!booking) return null
  // A sample page, or a page without an id: shown, never sent.
  const inert = Boolean(inertNote) || !listingId
  const fieldErrors: BookingFieldErrors =
    state && 'fieldErrors' in state ? (state.fieldErrors ?? {}) : {}
  const formError = state && 'error' in state ? state.error : null
  const sent = Boolean(state && 'success' in state)
  const invalid = (field: Field) =>
    fieldErrors[field]
      ? { 'aria-invalid': true as const, 'aria-describedby': `booking-${field}-error` }
      : {}

  return (
    <section
      aria-labelledby="booking-heading"
      className={bare ? undefined : 'bg-white py-12 md:py-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        {bare ? (
          <TemplateSectionHeading
            kicker="Reserve a Time"
            heading="Request a Booking"
            headingId="booking-heading"
          />
        ) : (
          <h2
            id="booking-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-2"
          >
            Request a Booking
          </h2>
        )}
        <p className="font-body text-sm text-charcoal max-w-prose mb-6">
          {booking.prompt ??
            `Tell ${name} when you'd like to come in and they'll confirm by email.`}
        </p>

        {sent ? (
          <div
            role="status"
            className="md:max-w-2xl rounded-2xl border border-charcoal/10 bg-cream/60 p-5 md:p-6 flex gap-3"
          >
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
            <div>
              <p className="font-subhead text-sm font-bold text-brand-black">Request Sent</p>
              <p className="font-body text-sm text-charcoal mt-1">
                {name} will accept it, decline it or suggest another time, and we&apos;ll email you
                their answer. We sent you a copy of your request.
              </p>
            </div>
          </div>
        ) : (
          <form
            className="md:max-w-2xl rounded-2xl border border-charcoal/10 bg-cream/60 p-5 md:p-6"
            action={inert ? undefined : formAction}
            // A sample page's submit must never reload the page or send anything.
            onSubmit={inert ? (e) => e.preventDefault() : undefined}
            aria-describedby={inert ? 'booking-inert-note' : undefined}
            noValidate
          >
            {!inert && (
              <>
                <input type="hidden" name="listing_id" value={listingId} />
                <HoneypotField />
              </>
            )}
            <fieldset
              disabled={inert || isPending}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <legend className="sr-only">Your request</legend>
              <div>
                <label htmlFor="booking-name" className={LABEL}>
                  Your Name
                </label>
                <input
                  id="booking-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={80}
                  className={INPUT}
                  {...invalid('name')}
                />
                <FieldError errors={fieldErrors} field="name" />
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
                  required
                  maxLength={254}
                  className={INPUT}
                  {...invalid('email')}
                />
                <FieldError errors={fieldErrors} field="email" />
              </div>
              <div>
                <label htmlFor="booking-phone" className={LABEL}>
                  Phone (Optional)
                </label>
                <input
                  id="booking-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  className={INPUT}
                  {...invalid('phone')}
                />
                <FieldError errors={fieldErrors} field="phone" />
              </div>
              {services && services.length > 0 && (
                <div>
                  <label htmlFor="booking-service" className={LABEL}>
                    Service (Optional)
                  </label>
                  <select id="booking-service" name="service_id" className={INPUT} defaultValue="">
                    <option value="">Not sure yet</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {booking.askDate && (
                <div>
                  <label htmlFor="booking-date" className={LABEL}>
                    Preferred Date
                  </label>
                  <input
                    id="booking-date"
                    name="requested_date"
                    type="date"
                    min={inert ? undefined : localToday()}
                    suppressHydrationWarning
                    className={INPUT}
                    {...invalid('requested_date')}
                  />
                  <FieldError errors={fieldErrors} field="requested_date" />
                </div>
              )}
              <div>
                <label htmlFor="booking-window" className={LABEL}>
                  Time of Day
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
                    Party Size
                  </label>
                  <input
                    id="booking-party"
                    name="party_size"
                    type="number"
                    min={1}
                    max={BOOKING_PARTY_MAX}
                    inputMode="numeric"
                    className={INPUT}
                    {...invalid('party_size')}
                  />
                  <FieldError errors={fieldErrors} field="party_size" />
                </div>
              )}
              <div className="sm:col-span-2">
                <label htmlFor="booking-message" className={LABEL}>
                  Anything Else?
                </label>
                <textarea
                  id="booking-message"
                  name="message"
                  rows={3}
                  maxLength={BOOKING_NOTE_MAX}
                  className={`${INPUT} h-auto py-2.5 resize-none`}
                  {...invalid('message')}
                />
                <FieldError errors={fieldErrors} field="message" />
              </div>
            </fieldset>

            {!inert && <TurnstileWidget resetKey={state} className="mt-4" />}

            {formError && (
              <p role="alert" className="mt-4 font-body text-sm text-red-700">
                {formError}
              </p>
            )}

            <div className="flex items-center gap-4 flex-wrap mt-5">
              <button
                type="submit"
                disabled={inert || isPending}
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-gold"
              >
                <CalendarCheck className="size-4" aria-hidden="true" />
                {isPending ? 'Sending…' : 'Send Request'}
              </button>
              <p id="booking-inert-note" className="font-body text-xs text-charcoal-soft">
                {inertNote ??
                  `No payment is taken. Your name, email and phone go to ${name} so they can answer.`}
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
