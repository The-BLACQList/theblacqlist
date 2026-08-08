'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  /** Stagger step in ms, applied as a transition delay */
  delay?: number
  className?: string
}

/**
 * Gentle luxury entrance: content rises 14px and fades in over 600ms with
 * the house easing as it scrolls into view. One orchestrated move, used on
 * section boundaries — never scattered per-element effects.
 *
 * Reduced motion is handled entirely in CSS: the hidden/transition styles
 * only exist inside `@media (prefers-reduced-motion: no-preference)`
 * (see .blacq-reveal in globals.css), so reduced-motion users get static
 * content with zero JS involvement.
 */
export function Reveal({ children, delay = 0, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('blacq-reveal', shown && 'blacq-reveal-shown', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {/* If JS never runs, the observer never fires and the content would stay at
          opacity 0 — invisible links a keyboard user can still tab into. */}
      <noscript>
        <style>{`.blacq-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      {children}
    </div>
  )
}
