'use client'

// The open panel of a finished tour step. Before this, a done row opened onto
// nothing: its instructions and note box were tied to the to-do statuses, so a
// tester could not look back at a step or at what they wrote (founder,
// 2026-10-15). Focus handling for the edit lives in TourStepRow, which owns the
// refs because it decides when the form closes.

import type { RefObject } from 'react'
import { Pencil } from 'lucide-react'

import { TourReflectionForm } from './TourReflectionForm'
import type { TourStepState } from './useTourState'

/**
 * The open panel of a finished step: what the step asked, and the tester's own
 * note with a way to change it. The final reflection is written in the rail
 * itself, so its "finish the steps above" instruction is left out.
 */
export function TourDoneStepReview({
  step,
  guide,
  showInstructions,
  note,
  editing,
  noteUpdated,
  editButtonRef,
  noteStatusRef,
  onEdit,
  onCancel,
  onSaved,
}: {
  step: TourStepState
  guide: readonly string[] | null
  showInstructions: boolean
  note: string | null
  editing: boolean
  noteUpdated: boolean
  editButtonRef: RefObject<HTMLButtonElement | null>
  noteStatusRef: RefObject<HTMLParagraphElement | null>
  onEdit: () => void
  onCancel: () => void
  onSaved: (text: string) => void
}) {
  return (
    <>
      {showInstructions &&
        (guide !== null ? (
          <ol className="list-decimal space-y-1 pl-4 font-subhead text-xs text-cream/75 marker:font-bold marker:text-amber-gold">
            {guide.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : (
          <p className="font-subhead text-sm text-cream/70">{step.instructions}</p>
        ))}

      {step.gated && editing && (
        <TourReflectionForm
          step={step}
          initialText={note ?? ''}
          submitLabel="Save changes"
          onCancel={onCancel}
          onSaved={onSaved}
        />
      )}

      {step.gated && !editing && note !== null && (
        <div className={showInstructions ? 'mt-3' : undefined}>
          {step.prompt && (
            <p className="font-subhead text-xs text-cream/60">{step.prompt}</p>
          )}
          <p className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-subhead text-sm text-cream">
            <span className="sr-only">Your note: </span>
            {note}
          </p>
          {noteUpdated && (
            <p
              ref={noteStatusRef}
              tabIndex={-1}
              role="status"
              className="mt-1 font-subhead text-sm text-amber-gold focus:outline-none"
            >
              Note updated.
            </p>
          )}
          <button
            ref={editButtonRef}
            type="button"
            onClick={onEdit}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-4 py-1.5 font-subhead text-sm text-cream transition-colors hover:border-amber-gold hover:text-amber-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit your note
          </button>
        </div>
      )}
    </>
  )
}
