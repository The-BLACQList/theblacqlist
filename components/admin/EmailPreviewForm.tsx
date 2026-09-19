'use client'

import { useActionState, useState } from 'react'

import { renderTesterInviteAction } from '@/lib/actions/admin/renderTesterInvite'
import type { TesterInviteVariant } from '@/lib/email/templates/tester-invite'
import { cn } from '@/lib/utils'

type CopyState = 'idle' | 'copied' | 'failed'

const AUDIENCE_OPTIONS: {
  value: TesterInviteVariant
  label: string
  description: string
}[] = [
  {
    value: 'owner',
    label: 'Business owner',
    description: 'Asks them to add their business',
  },
  {
    value: 'supporter',
    label: 'Supporter',
    description: 'Asks them to search, save, and review',
  },
]

export function EmailPreviewForm() {
  const [state, dispatch, pending] = useActionState(renderTesterInviteAction, null)
  const [copied, setCopied] = useState<CopyState>('idle')

  // Controlled on purpose. React 19 resets an uncontrolled form once the
  // action resolves, which here means a validation error wipes the link you
  // just pasted. tests/form-input-preservation.test.ts guards this.
  const [previewLink, setPreviewLink] = useState('')
  const [audience, setAudience] = useState<TesterInviteVariant>('owner')
  const [firstName, setFirstName] = useState('')

  const error = state !== null && 'error' in state ? state.error : null
  const rendered = state !== null && 'html' in state ? state : null

  async function copyForGmail() {
    if (!rendered) return
    try {
      // Rich HTML on the clipboard is what makes a Gmail paste keep the
      // styling. The plain-text flavour rides along for anywhere that cannot
      // take HTML.
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([rendered.html], { type: 'text/html' }),
          'text/plain': new Blob([rendered.text], { type: 'text/plain' }),
        }),
      ])
      setCopied('copied')
    } catch {
      // Safari and older browsers reject ClipboardItem in some contexts.
      // Plain text is a worse paste, but it is not nothing.
      try {
        await navigator.clipboard.writeText(rendered.text)
        setCopied('copied')
      } catch {
        setCopied('failed')
      }
    }
  }

  return (
    <div className="space-y-6">
      <form
        action={(formData) => {
          setCopied('idle')
          dispatch(formData)
        }}
        className="rounded-xl border border-charcoal/10 bg-white p-5 space-y-4"
      >
        <div>
          <label
            htmlFor="preview-link"
            className="block font-subhead text-sm font-semibold text-brand-black"
          >
            Preview link
          </label>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            The full <code>https://</code> link with <code>?preview=</code> on the end, from the
            go-public runbook. This form posts — the link never lands in a URL or a server log.
          </p>
          <input
            id="preview-link"
            name="preview_link"
            type="url"
            required
            autoComplete="off"
            spellCheck={false}
            value={previewLink}
            onChange={(e) => setPreviewLink(e.target.value)}
            placeholder="https://theblacqlist.com/sign-up?preview=…"
            className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>

        {/* A real named input, not client-only state: the server action reads
            the form body and nothing else. Same radio-card pattern as the role
            picker on /sign-up. */}
        <fieldset>
          <legend className="font-subhead text-sm font-semibold text-brand-black">
            Who is this invite for?
          </legend>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            The body and the subject line change with this.
          </p>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-lg">
            {AUDIENCE_OPTIONS.map((option) => {
              const isSelected = audience === option.value
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
                    isSelected
                      ? 'border-brand-black bg-pale-lavender'
                      : 'border-charcoal/20 hover:border-charcoal/40'
                  )}
                >
                  <input
                    type="radio"
                    name="audience"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setAudience(option.value)}
                    className="mt-0.5 accent-brand-black shrink-0"
                  />
                  <span className="flex flex-col min-w-0">
                    <span className="font-subhead text-sm font-semibold text-brand-black leading-snug">
                      {option.label}
                    </span>
                    <span className="font-subhead text-xs text-charcoal-soft leading-snug mt-0.5">
                      {option.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="first-name"
            className="block font-subhead text-sm font-semibold text-brand-black"
          >
            First name <span className="font-normal text-charcoal-soft">(optional)</span>
          </label>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            Leave it blank and the greeting reads &ldquo;You&rsquo;re in early.&rdquo;
          </p>
          <input
            id="first-name"
            name="first_name"
            type="text"
            autoComplete="off"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Andrea"
            className="mt-1.5 w-full max-w-xs rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>

        {error && (
          <p role="alert" className="font-body text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-black px-4 py-2 font-subhead text-sm font-semibold text-white transition-colors hover:bg-charcoal disabled:opacity-50"
        >
          {pending ? 'Rendering…' : 'Show the email'}
        </button>
      </form>

      {rendered && (
        <div className="space-y-3">
          <div className="rounded-xl border border-charcoal/10 bg-white p-5 space-y-3">
            <div>
              <p className="font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                Subject line
              </p>
              <p className="font-body text-sm text-brand-black mt-1">{rendered.subject}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={copyForGmail}
                className="rounded-lg bg-amber-gold px-4 py-2 font-subhead text-sm font-semibold text-brand-black transition-opacity hover:opacity-90"
              >
                Copy for Gmail
              </button>
              <span role="status" className="font-body text-sm text-charcoal-soft">
                {copied === 'copied' &&
                  'Copied. Paste into a Gmail compose window — the styling comes with it.'}
                {copied === 'failed' &&
                  'Your browser blocked the copy. Select the preview below and copy it by hand.'}
              </span>
            </div>
          </div>

          {/* srcDoc, not src. The site sends X-Frame-Options: DENY, which
              blocks a normal iframe even on our own origin. srcDoc hands the
              markup straight to the frame, so nothing is fetched. */}
          <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
            <iframe
              title="Tester invite email preview"
              srcDoc={rendered.html}
              sandbox=""
              className="w-full h-[900px] border-0 bg-[#F5F5F0]"
            />
          </div>
        </div>
      )}
    </div>
  )
}
