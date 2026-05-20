"use client"

import { useState, useTransition } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  listingId: string
  initialSaved?: boolean
  className?: string
  tabIndex?: number
  variant?: "icon" | "pill"
}

export function SaveButton({ listingId, initialSaved = false, className, tabIndex, variant = "icon" }: Props) {
  const [saved, setSaved] = useState(initialSaved)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    if (isPending) return
    const next = !saved
    setSaved(next) // optimistic update

    startTransition(async () => {
      try {
        if (next) {
          const res = await fetch("/api/saves", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listing_id: listingId }),
          })
          if (!res.ok) {
            // Redirect to sign-in if unauthenticated
            if (res.status === 401) {
              const currentUrl = window.location.pathname + window.location.search
              window.location.href = `/sign-in?next=${encodeURIComponent(currentUrl)}&action=save&listing_id=${listingId}`
              return
            }
            setSaved(!next) // rollback
          }
        } else {
          const res = await fetch(`/api/saves?listing_id=${listingId}`, { method: "DELETE" })
          if (!res.ok && res.status !== 204) {
            setSaved(!next) // rollback
          }
        }
      } catch {
        setSaved(!next) // rollback on network error
      }
    })
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-label={saved ? "Remove from saved businesses" : "Save this business"}
        aria-pressed={saved}
        className={cn(
          "inline-flex items-center gap-2 h-10 px-4 rounded-full font-subhead font-semibold text-sm transition-colors",
          saved
            ? "bg-amber-gold/15 text-amber-gold border border-amber-gold/30"
            : "bg-charcoal/8 text-charcoal border border-charcoal/15 hover:border-amber-gold/30 hover:text-amber-gold",
          className
        )}
      >
        <Heart
          className={cn("size-4", saved ? "fill-amber-gold text-amber-gold" : "")}
          aria-hidden="true"
        />
        {saved ? "Saved" : "Save"}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={saved ? "Remove from saved businesses" : "Save this business"}
      aria-pressed={saved}
      tabIndex={tabIndex}
      className={cn(
        "inline-flex items-center justify-center size-10 rounded-full transition-colors",
        saved
          ? "bg-amber-gold/20 text-amber-gold hover:bg-amber-gold/30"
          : "bg-white/10 text-white hover:bg-white/20",
        className
      )}
    >
      <Heart
        className={cn("size-4", saved ? "fill-amber-gold text-amber-gold" : "")}
        aria-hidden="true"
      />
    </button>
  )
}
