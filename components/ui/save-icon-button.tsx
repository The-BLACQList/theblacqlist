"use client"

import { useState } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"

import { cn } from "@/lib/utils"

interface SaveIconButtonProps {
  listingId: string
  listingName: string
  initialIsSaved?: boolean
  className?: string
}

export function SaveIconButton({
  // listingId will be used when the save/unsave API route is ready (Ticket 045)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  listingId: _listingId,
  listingName,
  initialIsSaved = false,
  className,
}: SaveIconButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved)

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    e.preventDefault()

    setIsSaved((prev) => !prev)

    // TODO: Replace with real API call when save/unsave routes are ready (Ticket 045)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={isSaved ? `Remove ${listingName} from saved` : `Save ${listingName}`}
        aria-pressed={isSaved}
        className={cn(
          "absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-1",
          className
        )}
      >
        {isSaved ? (
          <BookmarkCheck size={18} className="text-white" aria-hidden="true" />
        ) : (
          <Bookmark size={18} className="text-white" aria-hidden="true" />
        )}
      </button>
      {/* Polite live region announces the state change to screen reader users */}
      <span className="sr-only" aria-live="polite">
        {isSaved ? `${listingName} saved` : `${listingName} removed from saved`}
      </span>
    </>
  )
}
