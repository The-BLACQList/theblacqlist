'use client'

import { useEffect, useRef, type ReactNode, type Ref } from 'react'

import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { SITE_TOUR_ANSWERS, SITE_TOUR_BUTTONS, SITE_TOUR_QUESTION } from '@/lib/site-tour/copy'
import type { CaptionMode } from '@/lib/site-tour/layout'
import { cn } from '@/lib/utils'

export function Arrow() {
  return (
    <svg className="blq-tour-arrow" viewBox="0 0 22 14" aria-hidden="true">
      <path d="M0 7h20M14 1l6 6-6 6" />
    </svg>
  )
}

function Cross() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="blq-tour-cross">
      <path d="M2 2l12 12M14 2L2 14" />
    </svg>
  )
}

export function SiteTourClose({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="blq-tour-x" aria-label={label} onClick={onClick}>
      <Cross />
    </button>
  )
}

/** The full-screen dark cards: the opening and the chapters. */
export function SiteTourTitleCard({
  titleRef,
  kind,
  eyebrow,
  title,
  onNext,
}: {
  titleRef: Ref<HTMLHeadingElement>
  kind: 'opening' | 'chapter'
  eyebrow?: string
  title: string
  onNext?: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blq-tour-title"
      className={cn('blq-tour-full blq-tour-card-title', kind === 'opening' && 'is-opening')}
    >
      <GoldBrandMark className="blq-tour-mark" />
      {eyebrow && <p className="blq-tour-eyebrow">{eyebrow}</p>}
      <h2 id="blq-tour-title" ref={titleRef} tabIndex={-1}>
        {title}
      </h2>
      {onNext && (
        <button type="button" className="blq-tour-btn is-quiet" onClick={onNext}>
          {SITE_TOUR_BUTTONS.next}
        </button>
      )}
    </div>
  )
}

export function SiteTourWelcome({
  titleRef,
  onAnswer,
}: {
  titleRef: Ref<HTMLHeadingElement>
  onAnswer: (answer: 'owner' | 'shopper' | 'notNow') => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blq-tour-title"
      className="blq-tour-full blq-tour-welcome"
    >
      <div className="blq-tour-welcome-in">
        <GoldBrandMark className="blq-tour-mark" />
        <h2 id="blq-tour-title" ref={titleRef} tabIndex={-1}>
          {SITE_TOUR_QUESTION}
        </h2>
        <button type="button" className="blq-tour-answer" onClick={() => onAnswer('owner')}>
          {SITE_TOUR_ANSWERS.owner}
          <Arrow />
        </button>
        <button type="button" className="blq-tour-answer" onClick={() => onAnswer('shopper')}>
          {SITE_TOUR_ANSWERS.shopper}
          <Arrow />
        </button>
        <button type="button" className="blq-tour-btn is-quiet" onClick={() => onAnswer('notNow')}>
          {SITE_TOUR_ANSWERS.notNow}
        </button>
      </div>
    </div>
  )
}

export type CardAction = 'back' | 'next' | 'example' | 'go' | 'other'

export interface CardButton {
  label: string
  kind: 'plain' | 'go'
  action: CardAction
}

/** The step and end cards. One set of nodes across steps, so focus survives. */
export function SiteTourCard({
  ref,
  titleRef,
  mode,
  modal,
  barInUse,
  isEnd,
  count,
  title,
  body,
  note,
  buttons,
  onAction,
  onEnd,
}: {
  ref: Ref<HTMLDivElement>
  titleRef: Ref<HTMLHeadingElement>
  mode: CaptionMode
  modal: boolean
  barInUse: boolean
  isEnd: boolean
  count: string | null
  title: string
  body: string
  note?: string
  buttons: readonly CardButton[]
  onAction: (action: CardAction) => void
  /** Absent on the end card, which has only its two ways on. */
  onEnd?: () => void
}) {
  let mark: ReactNode = null
  if (isEnd) mark = <GoldBrandMark className="blq-tour-end-mark" />
  else if (count) mark = <p className="blq-tour-count">{count}</p>
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal={modal}
      aria-labelledby="blq-tour-title"
      aria-describedby="blq-tour-body"
      className={cn(
        'blq-tour-card',
        mode === 'bar' ? 'is-bar-mode' : `is-${mode}`,
        isEnd && 'is-end',
        barInUse && 'is-typing'
      )}
    >
      <div className="blq-tour-text">
        {mark}
        <h2 id="blq-tour-title" ref={titleRef} tabIndex={-1}>
          {title}
        </h2>
        <p id="blq-tour-body" className="blq-tour-body">
          {body}
        </p>
        {note && <p className="blq-tour-note">{note}</p>}
      </div>
      <div className="blq-tour-btns">
        {onEnd && (
          <button type="button" className="blq-tour-btn is-quiet is-end-tour" onClick={onEnd}>
            {SITE_TOUR_BUTTONS.end}
          </button>
        )}
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            className={cn('blq-tour-btn', button.kind === 'go' && 'is-go')}
            onClick={() => onAction(button.action)}
          >
            {button.label}
            {button.kind === 'go' && <Arrow />}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SiteTourPrompt({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  // Clear of what is already there: above Ask Cue on a phone (and above Enter
  // The Collective), beside The Collective's panel on a computer. They move, so
  // look again.
  useEffect(() => {
    const place = () => {
      const el = ref.current
      if (!el) return
      const set = (name: string, px: number | null) => {
        if (px === null) el.style.removeProperty(name)
        else el.style.setProperty(name, `${Math.round(px)}px`)
      }
      const shown = (selector: string) => {
        const found = document.querySelector(selector)
        if (!found || getComputedStyle(found).visibility === 'hidden') return null
        const rect = found.getBoundingClientRect()
        return rect.height > 0 ? rect : null
      }
      const under = [shown("[data-assistant='on']"), shown('.silo .silo-enter')]
        .filter((rect) => rect !== null)
        .filter((rect) => rect.top > window.innerHeight / 3 && rect.top < window.innerHeight)
        .map((rect) => window.innerHeight - rect.top + 12)
      set('--blq-tour-prompt-bottom', under.length > 0 ? Math.max(...under) : null)
      const panel = shown('.silo aside.ctx')
      const beside = panel && panel.left > window.innerWidth / 2
      set('--blq-tour-prompt-right', beside ? window.innerWidth - panel.left + 12 : null)
    }
    place()
    const timer = window.setInterval(place, 250)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <aside ref={ref} className="blq-tour-prompt" aria-label={SITE_TOUR_BUTTONS.take}>
      <button type="button" className="blq-tour-prompt-go" onClick={onOpen}>
        <GoldBrandMark className="blq-tour-prompt-mark" />
        {SITE_TOUR_BUTTONS.take}
      </button>
      <button
        type="button"
        className="blq-tour-prompt-x"
        aria-label="Close"
        onClick={onClose}
      >
        <Cross />
      </button>
    </aside>
  )
}

/** Dark everywhere but the light, with the ring around it. */
export function SiteTourScrim({
  scrimRef,
  ringRef,
  clipRef,
  shade,
}: {
  scrimRef: Ref<SVGPathElement>
  ringRef: Ref<SVGPathElement>
  clipRef: Ref<SVGRectElement>
  shade: boolean
}) {
  return (
    <svg className="blq-tour-scrim" aria-hidden="true">
      <clipPath id="blq-tour-clear">
        <rect ref={clipRef} />
      </clipPath>
      {shade && <path ref={scrimRef} className="blq-tour-shade" fillRule="evenodd" />}
      <path ref={ringRef} className="blq-tour-ring" clipPath="url(#blq-tour-clear)" />
    </svg>
  )
}
