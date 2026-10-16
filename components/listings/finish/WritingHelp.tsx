'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronDown, Lock, PenLine } from 'lucide-react'
import { generateSuggestionAction } from '@/lib/actions/ai/generateSuggestion'
import { rejectSuggestionAction } from '@/lib/actions/ai/rejectSuggestion'
import {
  UNCHANGED_NOTE,
  WRITE_BUTTON,
  fieldHelpReducer,
  initialFieldHelp,
  monthlyUsedUpMessage,
  usedSuggestionId,
  writeBlockedReason,
  type FieldHelp,
  type FieldHelpAction,
  type HelpAgent,
  type Suggestion,
  type WritingAllowance,
} from '@/lib/ai/writingHelp'

// Writing help inside Edit content (ticket 138). One provider holds the
// allowance for the whole page; each field keeps its own value and suggestion
// card through `useFieldHelp`, and `SuggestionPanel` draws the card under it.

const REASON_MAX = 200
const FAILED = "Couldn't write a suggestion right now. Try again."

type RequestResult =
  | { ok: true; suggestion: Suggestion }
  | { ok: false; message: string; limit: boolean }

interface WritingHelpValue {
  listingId: string
  allowance: WritingAllowance
  request: (agent: HelpAgent) => Promise<RequestResult>
}

const WritingHelpContext = createContext<WritingHelpValue | null>(null)

export function WritingHelpProvider({
  listingId,
  allowance: initialAllowance,
  children,
}: {
  listingId: string
  allowance: WritingAllowance
  children: ReactNode
}) {
  const [allowance, setAllowance] = useState(initialAllowance)

  const request = useCallback(
    async (agent: HelpAgent): Promise<RequestResult> => {
      const form = new FormData()
      form.set('listing_id', listingId)
      form.set('agent_type', agent)
      try {
        const result = await generateSuggestionAction(null, form)
        if (result && 'success' in result) {
          setAllowance(result.allowance)
          const { id, text, sample } = result.suggestion
          return { ok: true, suggestion: { id, text, sample } }
        }
        if (result && 'error' in result) {
          if (result.allowance) setAllowance(result.allowance)
          return {
            ok: false,
            message: result.error,
            limit: result.code === 'daily' || result.code === 'monthly',
          }
        }
      } catch {
        // Network or server failure: same message as any other failed request.
      }
      return { ok: false, message: FAILED, limit: false }
    },
    [listingId]
  )

  return (
    <WritingHelpContext.Provider value={{ listingId, allowance, request }}>
      {children}
    </WritingHelpContext.Provider>
  )
}

/** The page's writing help, or null where it is off, locked or not provided. */
export function useWritingHelp(): WritingHelpValue | null {
  const help = useContext(WritingHelpContext)
  return help && help.allowance.state === 'ready' ? help : null
}

// ── One field's help ─────────────────────────────────────────────────────────

export interface FieldHelpHandle {
  agent: HelpAgent
  state: FieldHelp
  /** The id the section's save should send, if a suggestion is in the field. */
  usedId: string | null
  setValue: (value: string) => void
  use: () => void
  putBack: () => void
  notThis: () => void
  request: () => Promise<boolean>
  /** Records Not this. Resolves to an error message, or null when it worked. */
  reject: (reason: string) => Promise<string | null>
  /** The section saved; a used card closes. */
  markSaved: () => void
}

/**
 * Value and suggestion card for one field. `onValueChange` hears every change
 * to the value (typing, Use this, Put mine back) so the live preview and the
 * "Not saved yet" line stay in step.
 */
export function useFieldHelp(
  agent: HelpAgent,
  savedValue: string,
  initial?: Suggestion,
  onValueChange?: (value: string) => void
): FieldHelpHandle {
  const help = useWritingHelp()
  const [state, dispatch] = useReducer(fieldHelpReducer, undefined, () =>
    initialFieldHelp(savedValue, initial)
  )

  // Value-changing actions run from events, so `state` here is current.
  function act(action: FieldHelpAction) {
    const next = fieldHelpReducer(state, action)
    dispatch(action)
    if (next.value !== state.value) onValueChange?.(next.value)
  }

  async function request(): Promise<boolean> {
    if (!help || state.card.kind === 'used' || state.card.kind === 'loading') return false
    dispatch({ type: 'request' })
    const result = await help.request(agent)
    if (result.ok) dispatch({ type: 'received', suggestion: result.suggestion })
    else dispatch({ type: 'failed', message: result.message, limit: result.limit })
    return result.ok
  }

  async function reject(reason: string): Promise<string | null> {
    const card = state.card
    if (card.kind !== 'whyNot') return null
    const form = new FormData()
    form.set('suggestion_id', card.suggestion.id)
    if (reason.trim()) form.set('reason', reason.trim().slice(0, REASON_MAX))
    try {
      const result = await rejectSuggestionAction(null, form)
      if (result && 'error' in result) return result.error
    } catch {
      return "Couldn't send that. Try again."
    }
    dispatch({ type: 'rejected' })
    return null
  }

  return {
    agent,
    state,
    usedId: usedSuggestionId(state),
    setValue: (value) => act({ type: 'edit', value }),
    use: () => act({ type: 'use' }),
    putBack: () => act({ type: 'putBack' }),
    notThis: () => dispatch({ type: 'notThis' }),
    request,
    reject,
    markSaved: () => dispatch({ type: 'saved' }),
  }
}

// ── The card under a field ───────────────────────────────────────────────────

export const BTN_PRIMARY =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-gold px-5 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
export const BTN_SECONDARY =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-charcoal/20 bg-white px-4 font-subhead text-sm font-semibold text-brand-black transition-colors hover:border-amber-gold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
export const BTN_QUIET =
  'inline-flex h-11 w-full items-center justify-center rounded-lg px-4 font-subhead text-sm font-semibold text-charcoal-soft underline decoration-charcoal/30 underline-offset-4 hover:text-brand-black sm:w-auto'

type FocusTarget = 'card' | 'reason' | 'write' | 'field' | null

interface PanelProps {
  field: FieldHelpHandle
  /** The input the suggestion fills. Focus goes there after Use this. */
  fieldId?: string
  /** 'copy' is for captions: Copy caption instead of Use this, nothing is saved. */
  mode?: 'field' | 'copy'
  /** The plan's character limit for the field, if any. */
  charLimit?: number | null
}

export function SuggestionPanel({ field, fieldId, mode = 'field', charLimit = null }: PanelProps) {
  const help = useWritingHelp()
  const uid = useId()
  const writeRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const reasonRef = useRef<HTMLInputElement>(null)
  const focusNext = useRef<FocusTarget>(null)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)

  const { card } = field.state

  useEffect(() => {
    const target = focusNext.current
    focusNext.current = null
    if (target === 'card') cardRef.current?.focus()
    else if (target === 'reason') reasonRef.current?.focus()
    else if (target === 'write') writeRef.current?.focus()
    else if (target === 'field' && fieldId) document.getElementById(fieldId)?.focus()
  }, [card.kind, fieldId])

  if (!help) return null

  const blocked = writeBlockedReason(help.allowance)
  const loading = card.kind === 'loading'
  const limitHere = card.kind === 'error' && card.limit === true
  const showWrite =
    card.kind === 'idle' ||
    card.kind === 'loading' ||
    card.kind === 'dismissed' ||
    card.kind === 'error' ||
    card.kind === 'saved'

  async function ask() {
    if (loading || blocked) return
    setCopyNote(null)
    focusNext.current = null
    const ok = await field.request()
    focusNext.current = ok ? 'card' : null
    // The card kind may not change (error to error), so focus here too.
    if (ok) requestAnimationFrame(() => cardRef.current?.focus())
  }

  async function send(withReason: boolean) {
    setSending(true)
    setRejectError(null)
    focusNext.current = 'write'
    const error = await field.reject(withReason ? reason : '')
    setSending(false)
    if (error) {
      focusNext.current = null
      setRejectError(error)
      return
    }
    setReason('')
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyNote('Caption copied. Paste it into Instagram.')
    } catch {
      setCopyNote("Couldn't copy. Select the text and copy it yourself.")
    }
  }

  const suggestion =
    card.kind === 'shown' || card.kind === 'whyNot' || card.kind === 'used' ? card.suggestion : null
  const tooLong = suggestion && charLimit !== null && suggestion.text.length > charLimit

  return (
    <div className="flex flex-col gap-3">
      {showWrite && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <button
            ref={writeRef}
            type="button"
            onClick={ask}
            disabled={Boolean(blocked) && !loading}
            aria-disabled={loading || undefined}
            aria-describedby={blocked && !limitHere ? `${uid}-blocked` : undefined}
            className={BTN_SECONDARY}
          >
            <PenLine className="size-4" aria-hidden="true" />
            {loading ? 'Writing…' : WRITE_BUTTON[field.agent]}
          </button>
          {blocked && !limitHere && (
            <p id={`${uid}-blocked`} className="font-body text-xs text-charcoal-soft">
              {blocked}
            </p>
          )}
        </div>
      )}

      <div role="status" className="empty:hidden">
        {loading && (
          <div className="rounded-lg border border-charcoal/10 bg-white p-4">
            <p className="font-body text-sm text-charcoal-soft">
              Writing a suggestion. You can keep editing.
            </p>
            <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
              <div className="h-3 w-full animate-pulse rounded bg-charcoal/10" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-charcoal/10" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-charcoal/10" />
            </div>
          </div>
        )}
        {card.kind === 'dismissed' && (
          <p className="font-body text-xs text-charcoal-soft">{UNCHANGED_NOTE}</p>
        )}
        {limitHere && (
          <p className="rounded-lg border border-charcoal/10 bg-charcoal/5 px-4 py-3 font-body text-sm text-charcoal">
            {card.message}
          </p>
        )}
        {copyNote && <p className="font-body text-xs text-charcoal-soft">{copyNote}</p>}
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

      {card.kind === 'shown' && suggestion && (
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
            {suggestion.sample && (
              <span className="rounded-full border border-charcoal/25 px-2.5 py-0.5 font-subhead text-[11px] font-bold uppercase tracking-wider text-charcoal-soft">
                Sample text
              </span>
            )}
            <span className="ml-auto font-body text-xs text-charcoal-faint">
              {suggestion.text.length} characters
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line break-words font-body text-sm leading-relaxed text-brand-black">
            {suggestion.text}
          </p>
          {suggestion.sample && (
            <p className="mt-2 font-body text-xs text-charcoal-soft">
              Sample text is for trying the buttons. Real suggestions are written from your page.
            </p>
          )}
          {tooLong && (
            <p className="mt-2 font-body text-xs text-red-700">
              This is longer than your plan&apos;s {charLimit} characters. Shorten it before you
              save.
            </p>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {mode === 'copy' ? (
              <button type="button" onClick={() => copy(suggestion.text)} className={BTN_PRIMARY}>
                Copy caption
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    focusNext.current = 'field'
                    field.use()
                  }}
                  className={BTN_PRIMARY}
                >
                  Use this
                </button>
                <button
                  type="button"
                  onClick={ask}
                  disabled={Boolean(blocked)}
                  aria-describedby={blocked ? `${uid}-blocked-card` : undefined}
                  className={BTN_SECONDARY}
                >
                  Try again
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                focusNext.current = 'reason'
                setRejectError(null)
                setCopyNote(null)
                field.notThis()
              }}
              className={BTN_QUIET}
            >
              Not this
            </button>
          </div>
          {blocked && mode === 'field' && (
            <p id={`${uid}-blocked-card`} className="mt-2 font-body text-xs text-charcoal-soft">
              {blocked}
            </p>
          )}
        </div>
      )}

      {card.kind === 'used' && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-gold/40 bg-amber-gold/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-sm text-brand-black">
            Not saved yet. Read it over, then save.
          </p>
          <button
            type="button"
            onClick={() => {
              focusNext.current = 'card'
              field.putBack()
            }}
            className={BTN_SECONDARY}
          >
            Put mine back
          </button>
        </div>
      )}

      {card.kind === 'whyNot' && (
        <div className="rounded-lg border border-charcoal/10 bg-white p-4">
          <label
            htmlFor={`${uid}-reason`}
            className="mb-1 block font-subhead text-xs font-semibold text-charcoal-soft"
          >
            Why not? <span className="font-normal text-charcoal-faint">(optional)</span>
          </label>
          <input
            ref={reasonRef}
            id={`${uid}-reason`}
            type="text"
            value={reason}
            maxLength={REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              // This box sits inside the section's form. Enter sends the
              // reason instead of saving the section.
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!sending) void send(true)
              }
            }}
            placeholder="Too formal, wrong details, not how we talk…"
            className="w-full rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => send(true)}
              disabled={sending}
              className={BTN_PRIMARY}
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => send(false)}
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

// ── Instagram caption, under the social links ───────────────────────────────

/** A caption to copy into Instagram. Nothing here is saved to the page. */
export function CaptionHelp({ initial }: { initial?: Suggestion }) {
  const help = useWritingHelp()
  const field = useFieldHelp('social_caption_instagram', '', initial)
  if (!help) return null
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-subhead text-sm font-semibold text-brand-black">Instagram caption</h3>
        <p className="mt-0.5 font-body text-xs text-charcoal-soft">
          A caption about your business to copy into a post. It isn&apos;t added to your page.
        </p>
      </div>
      <SuggestionPanel field={field} mode="copy" />
    </div>
  )
}

// ── The strip at the top of the page ─────────────────────────────────────────

export function WritingHelpStrip() {
  const help = useContext(WritingHelpContext)
  const [open, setOpen] = useState(false)
  const uid = useId()
  if (!help) return null
  const { allowance } = help

  if (allowance.state === 'off') return null

  if (allowance.state === 'locked') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-charcoal/10 bg-pale-lavender px-4 py-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-charcoal-soft" aria-hidden="true" />
        <p className="font-body text-sm text-charcoal">
          Writing help comes with Starter.{' '}
          <Link
            href="/dashboard/upgrade"
            className="font-subhead font-bold text-brand-black underline decoration-amber-gold underline-offset-4 hover:decoration-brand-black"
          >
            See plans
          </Link>
        </p>
      </div>
    )
  }

  const count =
    allowance.left === null
      ? 'Included with your plan'
      : allowance.left === 0
        ? monthlyUsedUpMessage(allowance.resetsOn)
        : `${allowance.left} of ${allowance.limit} left this month`

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-body text-sm text-brand-black">
          <span className="font-subhead font-semibold">Writing help</span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">: </span>
          <span className={allowance.left === 0 ? 'text-charcoal-soft' : undefined}>{count}</span>
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${uid}-how`}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-11 items-center gap-1 font-subhead text-sm font-semibold text-brand-black underline decoration-amber-gold underline-offset-4"
        >
          How
          <ChevronDown
            className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
      <div id={`${uid}-how`} hidden={!open} className="mt-2 space-y-1.5">
        <p className="font-body text-sm leading-relaxed text-charcoal">
          Tap a Write button under a field and you get a suggestion written from what&apos;s
          already on your page. Use this puts it in the box so you can change any word. Nothing
          reaches your page until you save that section.
        </p>
        <p className="font-body text-sm leading-relaxed text-charcoal">
          Each suggestion uses one draft from your monthly allowance. Not this throws it away, and
          telling us why helps us write better ones.
        </p>
      </div>
    </div>
  )
}
