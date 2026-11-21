import type { ReactElement } from 'react'

export interface LegendMarks {
  squares: boolean
  dots: boolean
  groups: boolean
  landmarks: boolean
}

interface Item {
  key: string
  label: string
  swatch: ReactElement
}

/**
 * Desktop legend pill, bottom-left of the map. Ticket 244 (Calm Map): it lists
 * only the marks on screen right now, one shape per meaning. Text carries the
 * meaning; the swatches are decorative.
 */
export function MapLegend({ marks }: { marks: LegendMarks }) {
  const items: Item[] = []
  if (marks.squares)
    items.push({
      key: 'square',
      label: 'Claimed Business',
      swatch: <span className="size-3.5 rounded-[4px] border-2 border-gold bg-white" />,
    })
  if (marks.dots)
    items.push({ key: 'dot', label: 'Business', swatch: <span className="size-2 rounded-full bg-ink/55" /> })
  if (marks.groups)
    items.push({
      key: 'group',
      label: 'Group',
      swatch: <span className="size-4 rounded-full border-[1.5px] border-ink bg-white" />,
    })
  if (marks.landmarks)
    items.push({
      key: 'landmark',
      label: 'Landmark',
      swatch: <span className="size-2.5 rotate-45 border border-ink bg-gold" />,
    })

  if (items.length === 0) return null
  return (
    <ul
      aria-label="Map legend"
      className="absolute bottom-8 left-4 z-20 m-0 flex list-none items-center gap-4 rounded-full bg-white px-4 py-2 text-[12.5px] text-ink shadow-[0_6px_20px_rgba(29,28,29,0.2)]"
    >
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          <span aria-hidden="true" className="flex items-center">
            {item.swatch}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  )
}
