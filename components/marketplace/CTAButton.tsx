"use client"

import { ExternalLink } from "lucide-react"

interface CTAButtonProps {
  href: string
  label: string
  ctaType: string
  entityType: "listing" | "product" | "service"
  entityId: string
  listingId: string
  variant?: "primary" | "outline"
}

const CTA_LABELS: Record<string, string> = {
  "visit-website": "Visit Website",
  "shop-now":      "Shop Now",
  "book-now":      "Book Now",
  "request-quote": "Request Quote",
  "order":         "Order Now",
  "buy-now":       "Buy Now",
  "shop":          "Shop",
  "book":          "Book",
}

export function CTAButton({
  href,
  label,
  ctaType,
  entityType,
  entityId,
  listingId,
  variant = "primary",
}: CTAButtonProps) {
  const displayLabel = label || CTA_LABELS[ctaType] || "Visit Website"

  function handleClick() {
    // Fire-and-forget analytics — do not block navigation
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/marketplace/cta-click",
        JSON.stringify({
          entity_type:     entityType,
          entity_id:       entityId,
          cta_type:        ctaType,
          listing_id:      listingId,
          destination_url: href,
        })
      )
    } else {
      fetch("/api/marketplace/cta-click", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type:     entityType,
          entity_id:       entityId,
          cta_type:        ctaType,
          listing_id:      listingId,
          destination_url: href,
        }),
        keepalive: true,
      }).catch(() => {})
    }
  }

  if (variant === "outline") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors min-h-[44px]"
      >
        {displayLabel}
        <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      </a>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors min-h-[44px]"
    >
      {displayLabel}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
    </a>
  )
}
