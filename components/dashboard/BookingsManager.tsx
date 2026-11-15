'use client'

import { useState, useTransition } from 'react'
import { Check, Clock, Loader2, Mail, MessageSquare, Phone, X } from 'lucide-react'
import { respondToBookingAction, saveBookingSettingsAction } from '@/lib/actions/dashboard/bookings'
import {
  BOOKING_PROMPT_MAX,
  BOOKING_REPLY_MAX,
  canRespond,
  whenLabel,
  type BookingDecision,
  type BookingSettings,
  type BookingStatus,
  type OwnerBookingRequest,
} from '@/lib/listings/booking'

// Booking requests (ticket 109), the owner's side: switch the form on and
// word it, then answer what comes in. Each answer emails the visitor.

interface Props {
  listingId: string
  /** Premium: the form can be switched on. Below it, only off and answering. */
  canEnable: boolean
  initialSettings: BookingSettings
  initialRequests: OwnerBookingRequest[]
  /** Service id → name, for requests that picked one. */
  serviceNames: Record<string, string>
}

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'
const CHECK = 'flex items-start gap-2 font-body text-sm text-charcoal'

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Waiting for You',
  proposed: 'You Suggested Another Time',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: 'bg-amber-gold/15 text-brand-black',
  proposed: 'bg-pale-lavender text-charcoal',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-charcoal/10 text-charcoal',
  cancelled: 'bg-charcoal/10 text-charcoal-soft',
}

function receivedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function SettingsCard({
  listingId,
  canEnable,
  initial,
}: {
  listingId: string
  canEnable: boolean
  initial: BookingSettings
}) {
  const [settings, setSettings] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved)

  function save() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await saveBookingSettingsAction({
        listingId,
        enabled: settings.enabled,
        prompt: settings.prompt ?? '',
        askDate: settings.ask_date,
        askPartySize: settings.ask_party_size,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      setSettings(result.settings)
      setSaved(result.settings)
      setNotice(result.settings.enabled ? 'Saved. Your form is on.' : 'Saved. Your form is off.')
    })
  }

  return (
    <section
      aria-labelledby="booking-settings-heading"
      className="rounded-xl border border-charcoal/10 bg-white p-5 space-y-4"
    >
      <div>
        <h2
          id="booking-settings-heading"
          className="font-subhead text-base font-bold text-brand-black"
        >
          Your Request Form
        </h2>
        <p className="font-body text-sm text-charcoal-soft mt-0.5">
          Visitors ask for a time. Nothing is booked until you accept, and no payment is taken.
        </p>
      </div>

      <label className={CHECK}>
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-brand-black"
          checked={settings.enabled}
          disabled={!canEnable && !settings.enabled}
          onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
        />
        <span>Show the request form on my page</span>
      </label>

      <div>
        <label htmlFor="booking-prompt" className={LABEL}>
          Line Above the Form (Optional)
        </label>
        <input
          id="booking-prompt"
          type="text"
          className={INPUT}
          maxLength={BOOKING_PROMPT_MAX}
          placeholder="Tell us when you'd like to come in and we'll confirm by email."
          value={settings.prompt ?? ''}
          onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Ask For</legend>
        <label className={CHECK}>
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-brand-black"
            checked={settings.ask_date}
            onChange={(e) => setSettings({ ...settings, ask_date: e.target.checked })}
          />
          <span>A preferred date</span>
        </label>
        <label className={CHECK}>
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-brand-black"
            checked={settings.ask_party_size}
            onChange={(e) => setSettings({ ...settings, ask_party_size: e.target.checked })}
          />
          <span>Party size</span>
        </label>
        <p className="font-body text-xs text-charcoal-soft">
          Name, email and time of day are always asked. Phone and service are optional for them.
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="font-body text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && !dirty && (
        <p role="status" className="font-body text-sm text-green-700">
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending || !dirty}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-brand-black text-white font-subhead text-sm font-bold disabled:opacity-50"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Save Settings
      </button>
    </section>
  )
}

function RequestCard({
  listingId,
  request,
  serviceName,
  onSaved,
}: {
  listingId: string
  request: OwnerBookingRequest
  serviceName: string | null
  onSaved: (r: OwnerBookingRequest) => void
}) {
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const open = canRespond(request.status)

  function answer(decision: BookingDecision) {
    setError(null)
    startTransition(async () => {
      const result = await respondToBookingAction({
        listingId,
        id: request.id,
        decision,
        reply,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      setReply('')
      onSaved(result.request)
    })
  }

  const replyId = `booking-reply-${request.id}`
  return (
    <li className="rounded-xl border border-charcoal/10 bg-white p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-subhead text-base font-bold text-brand-black">
            {request.requester_name}
          </p>
          <p className="font-body text-xs text-charcoal-soft">
            Received {receivedLabel(request.created_at)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 font-subhead text-xs font-semibold ${STATUS_CLASS[request.status]}`}
        >
          {STATUS_LABEL[request.status]}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 font-body text-sm text-charcoal">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-charcoal-soft" aria-hidden="true" />
          <dt className="sr-only">When</dt>
          <dd>{whenLabel(request.requested_date, request.time_window)}</dd>
        </div>
        {serviceName && (
          <div>
            <dt className="inline text-charcoal-soft">Service: </dt>
            <dd className="inline">{serviceName}</dd>
          </div>
        )}
        {request.party_size && (
          <div>
            <dt className="inline text-charcoal-soft">Party Size: </dt>
            <dd className="inline">{request.party_size}</dd>
          </div>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="size-4 text-charcoal-soft" aria-hidden="true" />
          <dt className="sr-only">Email</dt>
          <dd className="truncate">
            <a
              href={`mailto:${request.requester_email}`}
              className="underline underline-offset-2 decoration-amber-gold"
            >
              {request.requester_email}
            </a>
          </dd>
        </div>
        {request.requester_phone && (
          <div className="flex items-center gap-2">
            <Phone className="size-4 text-charcoal-soft" aria-hidden="true" />
            <dt className="sr-only">Phone</dt>
            <dd>
              <a
                href={`tel:${request.requester_phone.replace(/[^\d+]/g, '')}`}
                className="underline underline-offset-2 decoration-amber-gold"
              >
                {request.requester_phone}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {request.note && (
        <p className="border-l-2 border-amber-gold pl-3 font-body text-sm text-charcoal whitespace-pre-wrap">
          {request.note}
        </p>
      )}

      {request.owner_reply && (
        <p className="flex gap-2 font-body text-sm text-charcoal-soft">
          <MessageSquare className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Your note:</span> {request.owner_reply}
          </span>
        </p>
      )}

      {open && (
        <div className="space-y-2 pt-1">
          <label htmlFor={replyId} className={LABEL}>
            Note to Them (Needed to Suggest Another Time)
          </label>
          <textarea
            id={replyId}
            rows={2}
            maxLength={BOOKING_REPLY_MAX}
            className={`${INPUT} resize-none`}
            placeholder="Thursday at 2 works for us."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          {error && (
            <p role="alert" className="font-body text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => answer('accept')}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold disabled:opacity-50"
            >
              <Check className="size-4" aria-hidden="true" />
              Accept
            </button>
            <button
              type="button"
              disabled={pending || !reply.trim()}
              onClick={() => answer('propose')}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-charcoal/20 bg-white text-brand-black font-subhead text-sm font-bold disabled:opacity-50"
            >
              <Clock className="size-4" aria-hidden="true" />
              Suggest Another Time
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => answer('decline')}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-charcoal/20 bg-white text-charcoal font-subhead text-sm font-bold disabled:opacity-50"
            >
              <X className="size-4" aria-hidden="true" />
              Decline
            </button>
            {pending && (
              <Loader2
                className="size-4 animate-spin self-center text-charcoal-soft"
                aria-label="Sending"
              />
            )}
          </div>
          <p className="font-body text-xs text-charcoal-soft">
            We email them your answer and your note.
          </p>
        </div>
      )}
    </li>
  )
}

export function BookingsManager({
  listingId,
  canEnable,
  initialSettings,
  initialRequests,
  serviceNames,
}: Props) {
  const [requests, setRequests] = useState(initialRequests)
  const waiting = requests.filter((r) => canRespond(r.status))
  const answered = requests.filter((r) => !canRespond(r.status))

  function replace(updated: OwnerBookingRequest) {
    setRequests((list) => list.map((r) => (r.id === updated.id ? updated : r)))
  }

  const card = (r: OwnerBookingRequest) => (
    <RequestCard
      key={r.id}
      listingId={listingId}
      request={r}
      serviceName={r.service_id ? (serviceNames[r.service_id] ?? null) : null}
      onSaved={replace}
    />
  )

  return (
    <div className="space-y-8">
      <SettingsCard listingId={listingId} canEnable={canEnable} initial={initialSettings} />

      <section aria-labelledby="booking-waiting-heading" className="space-y-3">
        <h2
          id="booking-waiting-heading"
          className="font-subhead text-base font-bold text-brand-black"
        >
          Waiting for You ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <p className="font-body text-sm text-charcoal-soft">No requests to answer.</p>
        ) : (
          <ul className="space-y-3">{waiting.map(card)}</ul>
        )}
      </section>

      {answered.length > 0 && (
        <section aria-labelledby="booking-answered-heading" className="space-y-3">
          <h2
            id="booking-answered-heading"
            className="font-subhead text-base font-bold text-brand-black"
          >
            Answered ({answered.length})
          </h2>
          <ul className="space-y-3">{answered.map(card)}</ul>
        </section>
      )}
    </div>
  )
}
