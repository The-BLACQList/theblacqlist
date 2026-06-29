'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { FacetSidebar, type FacetSidebarProps } from '@/components/discovery/FacetSidebar'
import { FACET_KEYS } from '@/components/discovery/useFacetParams'

/** Mobile entry point: a "Filters" button that opens the full FacetSidebar in a sheet. */
export function MobileFilterSheet(props: FacetSidebarProps) {
  const [open, setOpen] = useState(false)
  const searchParams = useSearchParams()

  const activeCount = FACET_KEYS.reduce((acc, key) => {
    if (key === 'city' && props.hideCityFilter) return acc
    const value = searchParams.get(key)
    if (!value) return acc
    return acc + (key === 'price' || key === 'attrs' ? value.split(',').filter(Boolean).length : 1)
  }, 0)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-9 rounded-lg border border-charcoal/30 bg-white px-3 font-subhead text-sm font-semibold text-brand-black"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-black text-white text-[11px] tabular-nums">
              {activeCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      {/* bg-white belt-and-suspenders so the panel is solid even if a theme token regresses */}
      <SheetContent side="left" className="w-[88%] max-w-sm overflow-y-auto bg-white flex flex-col p-0">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription className="sr-only">
            Refine results by identity, price, amenities, and more.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 mt-5">
          <FacetSidebar {...props} />
        </div>
        {/* Sticky footer — filters apply instantly to the URL; this just closes the sheet */}
        <div className="sticky bottom-0 border-t border-charcoal/10 bg-white px-6 py-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full h-11 rounded-full bg-brand-black text-white font-subhead font-bold text-sm hover:bg-charcoal transition-colors"
          >
            Show results
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
