'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface AnchorTab {
  id: string
  label: string
}

interface Props {
  tabs: AnchorTab[]
}

/**
 * Sticky in-page navigation for the microsite templates (Living Commerce
 * Index anatomy ②). Only tabs with content are passed in. Sticks below the
 * fixed site header (h-14 md:h-16), scroll-spies the target sections, and
 * stays keyboard-operable (plain anchor links).
 */
export function EntityAnchorTabs({ tabs }: Props) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')
  const ticking = useRef(false)

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        ticking.current = false
        let current = tabs[0]?.id ?? ''
        for (const tab of tabs) {
          const el = document.getElementById(tab.id)
          if (el && el.getBoundingClientRect().top < 180) current = tab.id
        }
        setActive(current)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [tabs])

  if (tabs.length < 2) return null

  return (
    <nav
      aria-label="Page sections"
      className="sticky top-14 md:top-16 z-40 bg-white border-b border-charcoal/10"
    >
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <ul className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <li key={tab.id} className="shrink-0">
              <a
                href={`#${tab.id}`}
                aria-current={active === tab.id ? 'true' : undefined}
                className={cn(
                  'inline-block px-4 py-3.5 font-subhead text-sm font-semibold whitespace-nowrap border-b-[2.5px] transition-colors duration-150',
                  active === tab.id
                    ? 'text-brand-black border-amber'
                    : 'text-charcoal border-transparent hover:text-brand-black'
                )}
              >
                {tab.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
