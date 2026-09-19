'use client'

import { useActionState, useState } from 'react'

import { renderTesterInviteAction } from '@/lib/actions/admin/renderTesterInvite'

type CopyState = 'idle' | 'copied' | 'failed'

export function EmailPreviewForm() {
  const [state, dispatch, pending] = useActionState(renderTesterInviteAction, null)
  const [copied, setCopied] = useState<CopyState>('idle')

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
            placeholder="https://theblacqlist.com/sign-up?preview=…"
            className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>

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
