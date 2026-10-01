'use client'

import { useActionState, useState } from 'react'
import {
  mintTesterLinkAction,
  revokeTesterLinkAction,
} from '@/lib/actions/admin/testerLinks'

const LABEL_CLASS = 'block font-subhead text-sm font-semibold text-brand-black'
const HINT_CLASS = 'font-body text-xs text-charcoal-soft mt-0.5'
const INPUT_CLASS =
  'mt-1.5 w-full max-w-md rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const BUTTON_CLASS =
  'rounded-lg bg-brand-black px-4 py-2 font-subhead text-sm font-semibold text-white transition-colors hover:bg-charcoal disabled:opacity-50'

/**
 * Mint a one-tap link. The link comes back once, in this component's state,
 * and is gone on reload: the database only has its hash. Copy it straight
 * into the text to the tester.
 */
export function MintTesterLinkForm() {
  const [state, dispatch, pending] = useActionState(mintTesterLinkAction, null)
  const [kind, setKind] = useState<'supporter' | 'owner'>('supporter')
  const [copied, setCopied] = useState(false)

  const error = state !== null && 'error' in state ? state.error : null
  const minted = state !== null && 'success' in state ? state : null

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-4">
      <form
        action={(formData) => {
          setCopied(false)
          dispatch(formData)
        }}
        className="space-y-3"
      >
        <fieldset>
          <legend className={LABEL_CLASS}>Who is it for</legend>
          <div className="mt-1.5 flex flex-wrap gap-4">
            {(['supporter', 'owner'] as const).map((value) => (
              <label key={value} className="inline-flex items-center gap-2 font-body text-sm text-brand-black">
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                  className="h-4 w-4 accent-amber-gold"
                />
                {value === 'supporter' ? 'Supporter' : 'Listing owner'}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="link-label" className={LABEL_CLASS}>
            Label
          </label>
          <p className={HINT_CLASS}>A tag like T-07 so you can tell links apart. Not a name.</p>
          <input
            id="link-label"
            name="label"
            type="text"
            required
            maxLength={40}
            placeholder="T-07"
            className={INPUT_CLASS}
          />
        </div>

        {kind === 'supporter' ? (
          <div>
            <label htmlFor="link-email" className={LABEL_CLASS}>
              Supporter email
            </label>
            <p className={HINT_CLASS}>
              The link signs in to this account and makes it if it does not exist yet.
            </p>
            <input
              id="link-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="name@example.com"
              className={INPUT_CLASS}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="link-listing" className={LABEL_CLASS}>
              Listing ID or slug
            </label>
            <p className={HINT_CLASS}>
              The link signs in as this listing&rsquo;s owner. Their tour ends in a trial on it.
            </p>
            <input
              id="link-listing"
              name="listing"
              type="text"
              required
              placeholder="e.g. harlem-coffee-co or a UUID"
              className={INPUT_CLASS}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="font-body text-sm text-red-600">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending} className={BUTTON_CLASS}>
          {pending ? 'Making link…' : 'Make link'}
        </button>
      </form>

      {minted && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-gold/10 px-4 py-3 space-y-2"
        >
          <p className="font-subhead text-sm font-semibold text-brand-black">
            Link for {minted.label}. It shows once, so copy it now.
          </p>
          {minted.existingAccount && (
            <p className="font-body text-sm text-amber-800">
              This email already has an account. The link signs in to it. Revoke it below if
              that&rsquo;s not who you meant.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={minted.link}
              aria-label="One-tap link"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full max-w-md rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-mono text-xs text-brand-black"
            />
            <button type="button" onClick={() => copyLink(minted.link)} className={BUTTON_CLASS}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="font-body text-xs text-charcoal-soft">
            Works five times for fourteen days. Anyone holding it signs in as this tester, so send
            it only to them.
          </p>
        </div>
      )}
    </div>
  )
}

export function RevokeLinkButton({ inviteId }: { inviteId: string }) {
  const [state, dispatch, pending] = useActionState(revokeTesterLinkAction, null)

  const error = state !== null && 'error' in state ? state.error : null

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <p className="font-body text-xs text-red-600 max-w-[160px] text-right">{error}</p>
      )}
      <form action={dispatch}>
        <input type="hidden" name="invite_id" value={inviteId} />
        <button
          type="submit"
          disabled={pending}
          className="font-subhead text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {pending ? 'Revoking…' : 'Revoke'}
        </button>
      </form>
    </div>
  )
}
