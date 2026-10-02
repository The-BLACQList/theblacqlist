'use client'

import { LocateFixed, Minus, Plus } from 'lucide-react'

interface Props {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
}

const BTN =
  'flex size-11 items-center justify-center bg-white text-ink hover:bg-off-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber'

/** Desktop zoom and locate controls, bottom-right of the map. */
export function MapControls({ onZoomIn, onZoomOut, onLocate }: Props) {
  return (
    <div
      role="group"
      aria-label="Map controls"
      className="absolute bottom-8 right-4 z-20 flex flex-col gap-2"
    >
      <div className="overflow-hidden rounded-xl shadow-[0_6px_20px_rgba(29,28,29,0.2)]">
        <button type="button" onClick={onZoomIn} aria-label="Zoom in" className={BTN}>
          <Plus className="size-5" aria-hidden="true" />
        </button>
        <span aria-hidden="true" className="block h-px bg-hairline" />
        <button type="button" onClick={onZoomOut} aria-label="Zoom out" className={BTN}>
          <Minus className="size-5" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={onLocate}
        aria-label="Near me, use my location"
        className={`${BTN} rounded-xl shadow-[0_6px_20px_rgba(29,28,29,0.2)]`}
      >
        <LocateFixed className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
