'use client'

// Ticket 284: hide a live Page, or put back one an admin hid. Both take two
// steps, like JobUnpublishAction: the first click opens a form, and only
// Confirm changes anything.

import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import {
  putBackPageAction,
  unpublishPageAction,
  type PageHideState,
} from '@/lib/actions/admin/unpublishPage'
import { PAGE_HIDE_NOTE_MAX, PAGE_HIDE_REASONS } from '@/lib/admin/pageHide'

/** What the confirm step says about money. */
export type PagePlanNotice =
  | { kind: 'none' }
  | { kind: 'paid'; plan: string }
  | { kind: 'unknown' }

const FIELD =
  'w-full px-3 py-2 rounded-lg border border-red-300 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-soft focus:outline-none focus:ring-2 focus:ring-red-400/40'
const LABEL = 'block font-subhead text-sm font-semibold text-red-800 mb-1'

function ErrorNote({ state }: { state: PageHideState }) {
  if (!state || !('error' in state)) return null
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
    >
      <AlertCircle className="size-4 text-red-600 shrink-0" aria-hidden="true" />
      <p className="font-body text-sm text-red-800">{state.error}</p>
    </div>
  )
}

function DoneNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3"
    >
      <CheckCircle className="size-4 mt-0.5 text-green-700 shrink-0" aria-hidden="true" />
      <p className="font-subhead text-sm font-semibold text-green-800">{children}</p>
    </div>
  )
}

/** Opening a form moves focus into it; Cancel gives focus back to the button. */
function useConfirmStep<T extends HTMLElement>() {
  const [confirming, setConfirming] = useState(false)
  const openButton = useRef<HTMLButtonElement>(null)
  const firstField = useRef<T>(null)
  const opened = useRef(false)
  useEffect(() => {
    if (confirming) {
      opened.current = true
      firstField.current?.focus()
    } else if (opened.current) {
      openButton.current?.focus()
    }
  }, [confirming])
  return { confirming, setConfirming, openButton, firstField }
}

export interface PageHideInfo {
  /** "Owner Asked", from the hide's audit row. */
  reasonLabel: string
  hiddenOn: string
  note: string | null
  marked: boolean
}

interface PageVisibilityProps {
  listingId: string
  listingName: string
  plan: PagePlanNotice
  /** null while the Page is live; set once an admin has hidden it. */
  hide: PageHideInfo | null
}

/**
 * One component for both states: a success refreshes the page underneath, which
 * swaps the form for the other one, and the message has to outlive that.
 */
export function PageVisibilityAction({ listingId, listingName, plan, hide }: PageVisibilityProps) {
  const [hideState, hideAction, hiding] = useActionState(unpublishPageAction, null)
  const [backState, backAction, puttingBack] = useActionState(putBackPageAction, null)
  const messageRef = useRef<HTMLDivElement>(null)

  const done = hide ? hideState : backState
  const message =
    done && 'success' in done
      ? hide
        ? `${listingName} is hidden. The map can take about an hour to catch up.`
        : `${listingName} is live again. The map can take about an hour to catch up.`
      : null
  // The button that was pressed is gone, so focus goes to what happened.
  useEffect(() => {
    if (message) messageRef.current?.focus()
  }, [message])

  return (
    <div>
      <div
        role="status"
        ref={messageRef}
        tabIndex={-1}
        className={message ? 'mb-3 focus:outline-none' : undefined}
      >
        {message && <DoneNote>{message}</DoneNote>}
      </div>
      {hide ? (
        <PutBackForm
          listingId={listingId}
          hide={hide}
          state={backState}
          action={backAction}
          isPending={puttingBack}
        />
      ) : (
        <UnpublishForm
          listingId={listingId}
          plan={plan}
          state={hideState}
          action={hideAction}
          isPending={hiding}
        />
      )}
    </div>
  )
}

interface FormProps {
  listingId: string
  state: PageHideState
  action: (form: FormData) => void
  isPending: boolean
}

function UnpublishForm({
  listingId,
  plan,
  state,
  action,
  isPending,
}: FormProps & { plan: PagePlanNotice }) {
  const { confirming, setConfirming, openButton, firstField } = useConfirmStep<HTMLSelectElement>()
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [mark, setMark] = useState(false)

  return (
    <div className="space-y-3">
      <p className="font-body text-sm text-charcoal-soft">
        This Page is live. Unpublishing hides it from the site, search and the map and keeps its
        content. The owner can&apos;t put it back up; they see &ldquo;Taken Down&rdquo; with the
        support address.
      </p>

      <ErrorNote state={state} />

      {!confirming ? (
        <button
          ref={openButton}
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full inline-flex items-center justify-center h-11 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-subhead font-bold text-sm transition-colors"
        >
          Unpublish Page
        </button>
      ) : (
        <form action={action} className="space-y-3 border border-red-200 rounded-lg p-4 bg-red-50">
          <input type="hidden" name="listing_id" value={listingId} />

          {plan.kind !== 'none' && (
            <p className="flex items-start gap-2 font-body text-sm text-red-800">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {plan.kind === 'paid'
                  ? `This Page is on the ${plan.plan} plan. Unpublishing doesn’t stop billing, and the Page keeps its place in the plan. Cancel in Stripe if it should stop.`
                  : 'We couldn’t check for a paid plan. Unpublishing doesn’t stop billing, so check Stripe.'}
              </span>
            </p>
          )}

          <div>
            <label htmlFor="hide-reason" className={LABEL}>
              Reason
            </label>
            <select
              id="hide-reason"
              ref={firstField}
              name="reason"
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                // On by default when the owner asked; the admin can change it.
                setMark(e.target.value === 'owner_asked')
              }}
              className={`${FIELD} h-11`}
            >
              <option value="">Choose a reason</option>
              {PAGE_HIDE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="hide-note" className={LABEL}>
              {reason === 'other' ? 'Note for the Record' : 'Note for the Record (Optional)'}
            </label>
            <textarea
              id="hide-note"
              name="note"
              rows={3}
              maxLength={PAGE_HIDE_NOTE_MAX}
              required={reason === 'other'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Only admins see this. Leave out personal details."
              className={`${FIELD} resize-none`}
            />
          </div>

          <label className="flex items-start gap-2 min-h-11 py-1 font-body text-sm text-red-800">
            <input
              type="checkbox"
              name="do_not_re_add"
              checked={mark}
              onChange={(e) => setMark(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-red-700"
            />
            <span>
              <span className="block font-subhead font-semibold">Do Not Re-Add</span>
              Seed scripts skip this business, and reviewers see a warning if it&apos;s added again.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-subhead font-bold text-sm transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Unpublishing…' : 'Confirm Unpublish'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="px-4 h-11 rounded-lg border border-charcoal/20 text-charcoal-soft hover:text-brand-black font-subhead text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function PutBackForm({
  listingId,
  hide,
  state,
  action,
  isPending,
}: FormProps & { hide: PageHideInfo }) {
  const { confirming, setConfirming, openButton, firstField } =
    useConfirmStep<HTMLTextAreaElement>()
  const [reason, setReason] = useState('')

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-[#f5f5f7] px-4 py-3 space-y-1 font-body text-sm text-charcoal">
        <p>
          Hidden on {hide.hiddenOn}. Reason: <strong>{hide.reasonLabel}</strong>.
        </p>
        {hide.note && <p className="whitespace-pre-wrap break-words">{hide.note}</p>}
        {hide.marked && <p>Marked Do Not Re-Add. Putting the Page back clears the mark.</p>}
      </div>

      <ErrorNote state={state} />

      {!confirming ? (
        <button
          ref={openButton}
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full inline-flex items-center justify-center h-11 rounded-lg border border-charcoal/30 text-brand-black hover:bg-[#f5f5f7] font-subhead font-bold text-sm transition-colors"
        >
          Put Back
        </button>
      ) : (
        <form
          action={action}
          className="space-y-3 border border-charcoal/15 rounded-lg p-4 bg-[#f5f5f7]"
        >
          <input type="hidden" name="listing_id" value={listingId} />
          <div>
            <label
              htmlFor="put-back-reason"
              className="block font-subhead text-sm font-semibold text-brand-black mb-1"
            >
              Reason
            </label>
            <textarea
              id="put-back-reason"
              ref={firstField}
              name="reason"
              rows={3}
              maxLength={PAGE_HIDE_NOTE_MAX}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why it’s going back up. Only admins see this."
              className="w-full px-3 py-2 rounded-lg border border-charcoal/30 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-soft focus:outline-none focus:ring-2 focus:ring-charcoal/30 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-subhead font-bold text-sm transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Putting Back…' : 'Confirm Put Back'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="px-4 h-11 rounded-lg border border-charcoal/20 text-charcoal-soft hover:text-brand-black font-subhead text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
