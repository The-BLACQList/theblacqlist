'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  addExtraButtonAction,
  deleteExtraButtonAction,
  moveExtraButtonAction,
  type ButtonsState,
} from '@/lib/actions/dashboard/updateButtons'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import {
  BUTTON_LABEL_MAX,
  CTA_OPTIONS,
  extraButtonLabel,
  shownExtraButtons,
  type ExtraButton,
} from '@/lib/listings/pageButtons'
import { extraButtonLimit } from '@/lib/stripe/features'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'

interface Props {
  listingId: string
  initial: ExtraButton[]
  tier: string | null
  /** The plan the limit note offers (`upgradeTarget`), or null for no link. */
  upgradeTo: UpgradeTarget
  /** False when the page has no phone number, so "Call us" would go nowhere. */
  hasPhone: boolean
}

const EXTRA_OPTIONS = CTA_OPTIONS.filter((o) => o.value !== 'message')

/**
 * Buttons beyond the main one (owner-experience round 2, part B): Starter 1,
 * Growth 2, Premium 3. Lives inside the "Buttons on your page" card, outside
 * the main button's form, so each change saves on its own.
 */
export function ExtraButtonsEditor({ listingId, initial, tier, upgradeTo, hasPhone }: Props) {
  const [buttons, setButtons] = useState(initial)
  const [type, setType] = useState('')
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const limit = extraButtonLimit(tier)
  const hiddenIds = new Set(shownExtraButtons(buttons, tier).hidden.map((b) => b.id))
  const full = buttons.length >= limit
  const option = EXTRA_OPTIONS.find((o) => o.value === type)
  const isEmail = type === 'email'

  function run(id: string | null, action: () => Promise<ButtonsState>, onSuccess?: () => void) {
    setError(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await action()
      setBusyId(null)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setButtons(result.buttons)
      onSuccess?.()
    })
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    run(null, () => addExtraButtonAction({ listingId, type, value, label }), () => {
      setType('')
      setValue('')
      setLabel('')
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-subhead text-sm font-bold text-brand-black">More buttons</h3>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          {limit === 0
            ? 'Paid plans add buttons beside your main one.'
            : `Your plan shows up to ${limit} more ${limit === 1 ? 'button' : 'buttons'} beside your main one.`}{' '}
          When your inbox is on, a Message button appears by itself and doesn&rsquo;t count.
        </p>
      </div>

      {buttons.length > 0 && (
        <ol className="space-y-2">
          {buttons.map((b, i) => (
            <li
              key={b.id}
              className="flex items-center gap-2 rounded-lg border border-charcoal/8 bg-white px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="font-subhead text-sm font-semibold text-brand-black">{extraButtonLabel(b)}</p>
                <p className="font-body text-xs text-charcoal-soft truncate">
                  {b.type === 'call' ? 'Calls the phone number on your page' : b.value}
                </p>
                {hiddenIds.has(b.id) && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-pale-lavender px-2 py-0.5 font-subhead text-xs font-semibold text-charcoal">
                    <EyeOff className="size-3" aria-hidden="true" />
                    Hidden on your page
                  </span>
                )}
                {b.type === 'call' && !hasPhone && (
                  <p className="mt-1 font-body text-xs text-amber-900">Add a phone number to show this button.</p>
                )}
              </div>
              <IconButton
                label={`Move ${extraButtonLabel(b)} up`}
                disabled={isPending || i === 0}
                onClick={() => run(b.id, () => moveExtraButtonAction({ listingId, id: b.id, direction: 'up' }))}
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label={`Move ${extraButtonLabel(b)} down`}
                disabled={isPending || i === buttons.length - 1}
                onClick={() => run(b.id, () => moveExtraButtonAction({ listingId, id: b.id, direction: 'down' }))}
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label={`Delete ${extraButtonLabel(b)}`}
                disabled={isPending}
                danger
                onClick={() => run(b.id, () => deleteExtraButtonAction({ listingId, id: b.id }))}
              >
                {busyId === b.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
              </IconButton>
            </li>
          ))}
        </ol>
      )}

      {hiddenIds.size > 0 && (
        <p className="font-body text-xs text-charcoal-soft">
          Your page shows the first {limit === 1 ? 'one' : limit}. Move a button up to show it instead. Nothing was
          deleted.
        </p>
      )}

      {full ? (
        <PlanLimitNote upgradeTo={upgradeTo}>
          {limit === 0
            ? `Extra buttons are part of Starter. Upgrade to add ${extraButtonLimit('starter')} beside your main button.`
            : `Your plan includes ${limit === 1 ? '1 extra button' : `up to ${limit} extra buttons`}. Delete one to add another.`}
        </PlanLimitNote>
      ) : (
        <form onSubmit={add} className="space-y-3 rounded-lg bg-charcoal/5 px-3 py-3">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[11rem] flex-1">
              <label htmlFor="extra-button-type" className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1">
                Button
              </label>
              <select
                id="extra-button-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40 bg-white"
              >
                <option value="" disabled>
                  Choose an action…
                </option>
                {EXTRA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[11rem] flex-1">
              <label htmlFor="extra-button-label" className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1">
                Label <span className="font-normal text-charcoal-faint">(optional)</span>
              </label>
              <input
                id="extra-button-label"
                type="text"
                value={label}
                maxLength={BUTTON_LABEL_MAX}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Leave blank for the usual label"
                className="w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
              />
            </div>
          </div>

          {option?.requiresUrl && (
            <div>
              <label htmlFor="extra-button-value" className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1">
                {isEmail ? 'Email address' : 'Link'}
              </label>
              <input
                key={isEmail ? 'email' : 'url'}
                id="extra-button-value"
                type={isEmail ? 'email' : 'url'}
                autoComplete={isEmail ? 'email' : 'url'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                placeholder={isEmail ? 'you@yourbusiness.com' : 'https://example.com'}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
              />
            </div>
          )}
          {type === 'call' && (
            <p className="font-body text-xs text-charcoal-soft">
              {hasPhone ? 'Calls the phone number on your page.' : 'Add a phone number under Contact so this button can show.'}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || !type}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-black text-white font-subhead font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending && busyId === null ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            Add button
          </button>
        </form>
      )}

      <div aria-live="polite">
        {error && (
          <p role="alert" className="font-body text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        danger
          ? 'inline-flex items-center justify-center size-8 shrink-0 rounded-lg text-charcoal-faint hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors'
          : 'inline-flex items-center justify-center size-8 shrink-0 rounded-lg text-charcoal-soft hover:text-brand-black hover:bg-charcoal/5 disabled:opacity-40 transition-colors'
      }
    >
      {children}
    </button>
  )
}
