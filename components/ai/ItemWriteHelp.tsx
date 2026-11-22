'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Lock, PenLine } from 'lucide-react'
import { generateSuggestionAction } from '@/lib/actions/ai/generateSuggestion'
import { rejectSuggestionAction } from '@/lib/actions/ai/rejectSuggestion'
import { ITEM_WRITE_BUTTON, type ItemAgentType, type ItemHelp } from '@/lib/ai/itemHelp'
import type { ItemInput } from '@/lib/ai/itemFacts'
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY } from '@/components/listings/finish/WritingHelp'

// Ticket 242: AI help under one form field (a review reply, a Happening Now
// post, a product, service, event or job description). Use this only fills the
// field. Nothing is saved, posted or sent from here: the form's own Save, Post
// or Send button does that, once the owner has read it.

const REASON_MAX = 200
const FAILED = "Couldn't write one right now. Try again."

type Suggestion = { id: string; text: string; sample: boolean }

type Card =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'shown'; suggestion: Suggestion }
  | { kind: 'used'; suggestion: Suggestion; before: string }
  | { kind: 'whyNot'; suggestion: Suggestion }
  | { kind: 'dismissed' }
  | { kind: 'error'; message: string; limit: boolean }

interface Props {
  listingId: string
  agentType: ItemAgentType
  help: ItemHelp
  /** What to write about, read from the form when the button is pressed. Null: not enough yet. */
  getItem: () => ItemInput | null
  /** Shown when getItem gives null, e.g. "Add a name first." */
  missing: string
  /** The field's current text, kept for Put mine back. */
  getValue: () => string
  /** Puts text in the field. Never saves it. */
  setValue: (text: string) => void
  /** The line after Use this. Defaults to the save wording. */
  usedNote?: string
}

export function ItemWriteHelp({
  listingId,
  agentType,
  help,
  getItem,
  missing,
  getValue,
  setValue,
  usedNote = 'Not saved yet. Read it over, then save.',
}: Props) {
  const uid = useId()
  const [card, setCard] = useState<Card>({ kind: 'idle' })
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const reasonRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (card.kind === 'shown') cardRef.current?.focus()
    else if (card.kind === 'whyNot') reasonRef.current?.focus()
  }, [card.kind])

  if (!help) return null

  if (help.state === 'locked') {
    return (
      <p className="flex items-start gap-2 font-body text-xs text-charcoal-soft">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {help.plan === 'Starter' ? 'AI help comes with Starter.' : 'AI help with this comes with Growth.'}{' '}
          <Link
            href="/dashboard/upgrade"
            className="font-subhead font-bold text-brand-black underline decoration-amber-gold underline-offset-4 hover:decoration-brand-black"
          >
            See Plans
          </Link>
        </span>
      </p>
    )
  }

  const loading = card.kind === 'loading'

  async function ask() {
    if (loading) return
    const item = getItem()
    if (!item) {
      setCard({ kind: 'error', message: missing, limit: false })
      return
    }
    setCard({ kind: 'loading' })
    const form = new FormData()
    form.set('listing_id', listingId)
    form.set('agent_type', agentType)
    form.set('item', JSON.stringify(item))
    try {
      const result = await generateSuggestionAction(null, form)
      if (result && 'success' in result) {
        const { id, text, sample } = result.suggestion
        setCard({ kind: 'shown', suggestion: { id, text, sample } })
        return
      }
      if (result && 'error' in result) {
        setCard({
          kind: 'error',
          message: result.error,
          limit: result.code === 'daily' || result.code === 'monthly',
        })
        return
      }
    } catch {
      // Network or server failure: same message as any other failed request.
    }
    setCard({ kind: 'error', message: FAILED, limit: false })
  }

  async function reject(withReason: boolean) {
    if (card.kind !== 'whyNot') return
    setSending(true)
    setRejectError(null)
    const form = new FormData()
    form.set('suggestion_id', card.suggestion.id)
    const why = withReason ? reason.trim().slice(0, REASON_MAX) : ''
    if (why) form.set('reason', why)
    try {
      const result = await rejectSuggestionAction(null, form)
      if (result && 'error' in result) {
        setRejectError(result.error)
        return
      }
      setReason('')
      setCard({ kind: 'dismissed' })
    } catch {
      setRejectError("Couldn't send that. Try again.")
    } finally {
      setSending(false)
    }
  }

  const showWrite = card.kind === 'idle' || loading || card.kind === 'dismissed' || card.kind === 'error'

  return (
    <div className="flex flex-col gap-3">
      {showWrite && (
        <div>
          <button
            type="button"
            onClick={ask}
            aria-disabled={loading || undefined}
            className={BTN_SECONDARY}
          >
            <PenLine className="size-4" aria-hidden="true" />
            {loading ? 'Writing…' : ITEM_WRITE_BUTTON[agentType]}
          </button>
        </div>
      )}

      <div role="status" className="empty:hidden">
        {loading && (
          <p className="font-body text-sm text-charcoal-soft">Writing one. You can keep editing.</p>
        )}
        {card.kind === 'dismissed' && (
          <p className="font-body text-xs text-charcoal-soft">Nothing was changed.</p>
        )}
        {card.kind === 'error' && card.limit && (
          <p className="rounded-lg border border-charcoal/10 bg-charcoal/5 px-4 py-3 font-body text-sm text-charcoal">
            {card.message}
          </p>
        )}
      </div>

      {card.kind === 'error' && !card.limit && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{card.message}</p>
        </div>
      )}

      {card.kind === 'shown' && (
        <div
          ref={cardRef}
          tabIndex={-1}
          aria-labelledby={`${uid}-label`}
          className="rounded-lg border border-amber-gold/50 bg-amber-gold/5 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/40"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              id={`${uid}-label`}
              className="rounded-full bg-amber-gold px-2.5 py-0.5 font-subhead text-[11px] font-bold uppercase tracking-wider text-brand-black"
            >
              Suggested
            </span>
            {card.suggestion.sample && (
              <span className="rounded-full border border-charcoal/25 px-2.5 py-0.5 font-subhead text-[11px] font-bold uppercase tracking-wider text-charcoal-soft">
                Sample text
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-line break-words font-body text-sm leading-relaxed text-brand-black">
            {card.suggestion.text}
          </p>
          {card.suggestion.sample && (
            <p className="mt-2 font-body text-xs text-charcoal-soft">
              Sample text is for trying the buttons. Real suggestions are written from what you
              typed and your page.
            </p>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                const before = getValue()
                setValue(card.suggestion.text)
                setCard({ kind: 'used', suggestion: card.suggestion, before })
              }}
              className={BTN_PRIMARY}
            >
              Use This
            </button>
            <button type="button" onClick={ask} className={BTN_SECONDARY}>
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectError(null)
                setCard({ kind: 'whyNot', suggestion: card.suggestion })
              }}
              className={BTN_QUIET}
            >
              Not This
            </button>
          </div>
        </div>
      )}

      {card.kind === 'used' && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-gold/40 bg-amber-gold/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-sm text-brand-black">{usedNote}</p>
          <button
            type="button"
            onClick={() => {
              setValue(card.before)
              setCard({ kind: 'shown', suggestion: card.suggestion })
            }}
            className={BTN_SECONDARY}
          >
            Put Mine Back
          </button>
        </div>
      )}

      {card.kind === 'whyNot' && (
        <div className="rounded-lg border border-charcoal/10 bg-white p-4">
          <label
            htmlFor={`${uid}-reason`}
            className="mb-1 block font-subhead text-xs font-semibold text-charcoal-soft"
          >
            Why Not? <span className="font-normal text-charcoal-faint">(optional)</span>
          </label>
          <input
            ref={reasonRef}
            id={`${uid}-reason`}
            type="text"
            value={reason}
            maxLength={REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              // This box sits inside the item's form. Enter sends the reason
              // instead of submitting the form.
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!sending) void reject(true)
              }
            }}
            placeholder="Too formal, wrong details, not how we talk…"
            className="w-full rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => reject(true)}
              disabled={sending}
              className={BTN_PRIMARY}
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => reject(false)}
              disabled={sending}
              className={BTN_SECONDARY}
            >
              Skip
            </button>
          </div>
          {rejectError && (
            <p role="alert" className="mt-2 font-body text-xs text-red-700">
              {rejectError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
