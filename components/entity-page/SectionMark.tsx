import type { ReactNode } from 'react'
import type { SectionId } from '@/lib/entity-page/sections'

interface Props {
  id: SectionId
  children: ReactNode
}

/**
 * A layout-neutral marker around one page section (ticket 184). `display:
 * contents` keeps it out of the box tree, so wrapping a section changes
 * nothing visible; the `data-section` attribute is what Playwright and, later,
 * the click-to-fill editor (ticket 188) find a section by. The ids are the
 * registry's (lib/entity-page/sections.ts), never free text.
 */
export function SectionMark({ id, children }: Props) {
  return (
    <div data-section={id} className="contents">
      {children}
    </div>
  )
}
