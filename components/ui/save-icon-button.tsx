"use client"

import { useState, useTransition } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"

import { cn } from "@/lib/utils"

interface SaveIconButtonProps {
  listingId: string
  listingName: string
  initialIsSaved?: boolean
  className?: string
}

export function SaveIconButton({
  listingId,
  listingName,
  initialIsSaved = false,
  className,
}: SaveIconButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved)
  const [isPending, startTransition] = useTransition()

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    e.preventDefault()
    if (isPending) return

    const next = !isSaved
    setIsSaved(next)

    startTransition(async () => {
      try {
        if (next) {
          const res = await fetch("/api/saves", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listing_id: listingId }),
          })
          if (!res.ok) {
            if (res.status === 401) {
              const currentUrl = window.location.pathname + window.location.search
              window.location.href = `/sign-in?next=${encodeURIComponent(currentUrl)}&action=save&listing_id=${listingId}`
              return
            }
            setIsSaved(!next)
          }
        } else {
          const res = await fetch(`/api/saves?listing_id=${listingId}`, { method: "DELETE" })
          if (!res.ok && res.status !== 204) {
            setIsSaved(!next)
          }
        }
      } catch {
        setIsSaved(!next)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
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
