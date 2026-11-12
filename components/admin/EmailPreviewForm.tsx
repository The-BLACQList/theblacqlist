'use client'

import { useActionState, useState } from 'react'

import {
  renderTesterInviteAction,
  type TesterEmailKind,
} from '@/lib/actions/admin/renderTesterInvite'
import type { TesterInviteAudience } from '@/lib/email/templates/tester-invite'
import { cn } from '@/lib/utils'

type CopyState = 'idle' | 'copied' | 'failed'

interface RadioOption<T extends string> {
  value: T
  label: string
  description: string
}

const EMAIL_OPTIONS: RadioOption<TesterEmailKind>[] = [
  {
    value: 'invite',
    label: 'Invite',
    description: 'For someone new. Opens the test with their one-tap link.',
  },
  {
    value: 'update',
    label: 'Tester update',
    description: 'For someone already testing. Finish the guide, see The Collective.',
  },
]

const AUDIENCE_OPTIONS: RadioOption<TesterInviteAudience>[] = [
  {
    value: 'owner',
    label: 'Business owner',
    description: 'Claim or make their page, then walk the guide',
  },
  {
    value: 'supporter',
    label: 'Supporter',
    description: 'Search, save, map, and review',
  },
  {
    value: 'shared',
    label: 'Anyone (shared link)',
    description: 'Can be forwarded. Each person picks owner or supporter.',
  },
]

/** The tester update thanks one person, so it has no shared option. */
const UPDATE_AUDIENCE_OPTIONS = AUDIENCE_OPTIONS.filter((option) => option.value !== 'shared')

const INPUT_CLASS =
  'mt-1.5 w-full rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40'

/**
 * The same radio-card pattern as the role picker on /sign-up. Real named
 * inputs, not client-only state: the server action reads the form body and
 * nothing else.
 */
function RadioCards<T extends string>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  name: string
  legend: string
  hint: string
  options: RadioOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="font-subhead text-sm font-semibold text-brand-black">{legend}</legend>
      <p className="font-body text-xs text-charcoal-soft mt-0.5">{hint}</p>
      <div
        className={cn(
          'mt-1.5 grid grid-cols-1 gap-2',
          options.length > 2 ? 'sm:grid-cols-3 max-w-2xl' : 'sm:grid-cols-2 max-w-lg'
        )}
      >
        {options.map((option) => {
          const isSelected = value === option.value
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
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
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
  )
}

export function EmailPreviewForm() {
  const [state, dispatch, pending] = useActionState(renderTesterInviteAction, null)
  const [copied, setCopied] = useState<CopyState>('idle')

  // Controlled on purpose. React 19 resets an uncontrolled form once the
  // action resolves, which here means a validation error wipes the link you
  // just pasted. tests/form-input-preservation.test.ts guards this.
  const [emailKind, setEmailKind] = useState<TesterEmailKind>('invite')
  const [testerLink, setTesterLink] = useState('')
  const [audience, setAudience] = useState<TesterInviteAudience>('owner')
  const [firstName, setFirstName] = useState('')
  const [openingDate, setOpeningDate] = useState('')

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
        <RadioCards
          name="email_kind"
          legend="Which email?"
          hint="The invite opens the test. The update goes to people already in it."
          options={EMAIL_OPTIONS}
          value={emailKind}
          onChange={(kind) => {
            setEmailKind(kind)
            // The update has no shared option. Fall back rather than post a
            // value the form no longer shows.
            if (kind === 'update' && audience === 'shared') setAudience('owner')
          }}
        />

        <div>
          <label
            htmlFor="tester-link"
            className="block font-subhead text-sm font-semibold text-brand-black"
          >
            Tester link
          </label>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            The one-tap link that ends in <code>/t#…</code>. Make one on the Testers page: a Shared
            link for an invite people can forward, or a one-person link. A fresh link also works for
            someone already testing: it picks up where they left off. This form posts, so the link
            never lands in a URL or a server log.
          </p>
          <input
            id="tester-link"
            name="tester_link"
            type="url"
            required
            autoComplete="off"
            spellCheck={false}
            value={testerLink}
            onChange={(e) => setTesterLink(e.target.value)}
            placeholder="https://theblacqlist.com/t#…"
            className={INPUT_CLASS}
          />
        </div>

        <RadioCards
          name="audience"
          legend="Who is this email for?"
          hint={
            emailKind === 'invite'
              ? 'The body changes with this. Pick Anyone when you pasted a Shared link: that email can be forwarded until the tester spots are filled.'
              : 'The body changes with this. Owners also hear about the free month.'
          }
          options={emailKind === 'invite' ? AUDIENCE_OPTIONS : UPDATE_AUDIENCE_OPTIONS}
          value={audience}
          onChange={setAudience}
        />

        <div>
          <label
            htmlFor="first-name"
            className="block font-subhead text-sm font-semibold text-brand-black"
          >
            First name <span className="font-normal text-charcoal-soft">(optional)</span>
          </label>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            {emailKind === 'invite'
              ? 'Leave it blank and the greeting reads “You’re in early.”'
              : 'Leave it blank and the greeting reads “Thank you.”'}
          </p>
          <input
            id="first-name"
            name="first_name"
            type="text"
            autoComplete="off"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Andrea"
            className={cn(INPUT_CLASS, 'max-w-xs')}
          />
        </div>

        {emailKind === 'update' && (
          <div>
            <label
              htmlFor="opening-date"
              className="block font-subhead text-sm font-semibold text-brand-black"
            >
              Opening date <span className="font-normal text-charcoal-soft">(optional)</span>
            </label>
            <p className="font-body text-xs text-charcoal-soft mt-0.5">
              Written out, as it should read in the email. Leave it blank and it says &ldquo;We open
              to everyone soon.&rdquo;
            </p>
            <input
              id="opening-date"
              name="opening_date"
              type="text"
              autoComplete="off"
              maxLength={40}
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              placeholder="e.g. Tuesday, 17 November"
              className={cn(INPUT_CLASS, 'max-w-xs')}
            />
          </div>
        )}

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
                  (rendered.shareable
                    ? 'Copied. Paste into a Gmail compose window. The styling comes with it. This one can be forwarded: anyone can join until the spots are filled.'
                    : 'Copied. Paste into a Gmail compose window. The styling comes with it. One person per email.')}
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
              title="Tester email preview"
              srcDoc={rendered.html}
              sandbox=""
              className="w-full h-[1100px] border-0 bg-[#F5F5F0]"
            />
          </div>
        </div>
      )}
    </div>
  )
}
