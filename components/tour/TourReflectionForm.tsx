'use client'

// The reflection textarea for one step. Moved out of TourRail.tsx unchanged in
// behaviour except for the focus fix at the bottom of this file.

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import {
  submitReflectionAction,
  type ReflectionState,
} from '@/lib/actions/tour/submitReflection'
import { REFLECTION_MIN_LENGTH } from '@/lib/tour/steps'
import type { TourStepState } from './useTourState'

function ReflectionSubmit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-amber-gold px-4 py-1.5 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Saving…' : 'Save reflection'}
    </button>
  )
}

export function TourReflectionForm({
  step,
  onSaved,
}: {
  step: TourStepState
  onSaved: () => void
}) {
  const [state, action] = useActionState<ReflectionState, FormData>(
    submitReflectionAction,
    null
  )
  // CONTROLLED on purpose: React 19 resets an uncontrolled
  // <form action={…}> when the action resolves, which would wipe the
  // tester's text on every validation failure (the recorded debt-⑰ defect
  // class). A controlled value survives the reset.
  const [text, setText] = useState('')
  const savedRef = useRef<HTMLParagraphElement | null>(null)

  const succeeded = state !== null && 'success' in state && state.success
  const error = state !== null && 'error' in state ? state.error : null

  useEffect(() => {
    if (succeeded) onSaved()
  }, [succeeded, onSaved])

  // ⚠ FOCUS, not decoration. When the refetch triggered by `onSaved` flips this
  // step to 'done', this whole subtree unmounts — and the tester's focus was
  // inside it, on the submit button. Focus does not go to "the next sensible
  // thing" when its element disappears; it goes to <body>, which drops a
  // keyboard user out of the rail entirely and a screen-reader user to the top
  // of the document, mid-tour, with no announcement of why.
  //
  // Moving focus to the confirmation first means that when the unmount happens
  // focus is already on a node whose removal the rail's own live region has
  // just explained. `preventScroll` because the rail is a fixed panel — there
  // is nothing to scroll to and Safari will scroll the page anyway.
  useEffect(() => {
    if (succeeded) savedRef.current?.focus({ preventScroll: true })
  }, [succeeded])

  if (succeeded) {
    return (
      <p
        ref={savedRef}
        tabIndex={-1}
        role="status"
        className="mt-1 font-subhead text-sm text-amber-gold focus:outline-none"
      >
        Reflection saved.
      </p>
    )
  }

  const errorId = error ? `tour-reflection-error-${step.key}` : undefined

  return (
    <form action={action} className="mt-2" noValidate>
      <input type="hidden" name="step" value={step.key} />
      <label
        htmlFor={`tour-reflection-${step.key}`}
        className="font-subhead text-sm text-cream/80"
      >
        {step.prompt}
      </label>
      <textarea
        id={`tour-reflection-${step.key}`}
        name="reflection"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={errorId}
        placeholder={`At least ${REFLECTION_MIN_LENGTH} characters`}
        className="mt-1.5 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 font-subhead text-sm text-white placeholder:text-cream/40 focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
      />
      {error && (
        <p id={errorId} role="alert" className="mb-2 font-subhead text-sm text-light-gold">
          {error}
        </p>
      )}
      <ReflectionSubmit />
    </form>
  )
}
