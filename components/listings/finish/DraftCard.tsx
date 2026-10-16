'use client'

import { useId, type ReactNode } from 'react'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY } from './WritingHelp'

// One draft card after "Save my draft" (ticket 128). Same look as a writing
// help suggestion (ticket 138). The card's text is the owner's to change; only
// Use this saves anything.

export interface CardStatus {
  busy: 'asking' | 'saving' | null
  saved: string | null
  error: string | null
}

export const IDLE_CARD: CardStatus = { busy: null, saved: null, error: null }

interface Props {
  title: string
  /** The editable draft: an input or textarea the card labels with `title`. */
  children: (id: string) => ReactNode
  status: CardStatus
  sample: boolean
  /** Show "Shorter" and "Warmer". Off for the category card. */
  restyle: boolean
  /** Hide every button that asks again (a cap was reached). */
  capped: boolean
  /** Use this is not offered: nothing would change. */
  note?: string | null
  onUse: (() => void) | null
  onAsk: (style: 'fresh' | 'shorter' | 'warmer') => void
}

export function DraftCard({
  title,
  children,
  status,
  sample,
  restyle,
  capped,
  note = null,
  onUse,
  onAsk,
}: Props) {
  const uid = useId()
  const fieldId = `${uid}-field`
  const busy = status.busy !== null

  return (
    <div
      role="group"
      aria-labelledby={`${uid}-title`}
      aria-busy={busy || undefined}
      className="rounded-lg border border-amber-gold/50 bg-amber-gold/5 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${uid}-title`} className="font-headline text-sm text-brand-black">
          <label htmlFor={fieldId}>{title}</label>
        </h3>
        <span className="rounded-full bg-amber-gold px-2.5 py-0.5 font-subhead text-[11px] font-bold uppercase tracking-wider text-brand-black">
          Suggested
        </span>
        {sample && (
          <span className="rounded-full border border-charcoal/25 px-2.5 py-0.5 font-subhead text-[11px] font-bold uppercase tracking-wider text-charcoal-soft">
            Sample text
          </span>
        )}
      </div>

      <div className="mt-2">{children(fieldId)}</div>

      {note && <p className="mt-2 font-body text-xs text-charcoal-soft">{note}</p>}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {onUse && (
          <button type="button" onClick={onUse} disabled={busy} className={BTN_PRIMARY}>
            {status.busy === 'saving' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {status.busy === 'saving' ? 'Saving…' : 'Use this'}
          </button>
        )}
        {!capped && restyle && (
          <>
            <button type="button" onClick={() => onAsk('shorter')} disabled={busy} className={BTN_SECONDARY}>
              Shorter
            </button>
            <button type="button" onClick={() => onAsk('warmer')} disabled={busy} className={BTN_SECONDARY}>
              Warmer
            </button>
          </>
        )}
        {!capped && (
          <button type="button" onClick={() => onAsk('fresh')} disabled={busy} className={BTN_QUIET}>
            {status.busy === 'asking' ? 'Writing…' : 'Try again'}
          </button>
        )}
      </div>

      <div aria-live="polite" className="empty:hidden">
        {status.saved && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 font-body text-sm text-green-700">
            <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
            {status.saved}
          </p>
        )}
      </div>
      {status.error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{status.error}</p>
        </div>
      )}
    </div>
  )
}
