import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"
import { SaveIconButton } from "@/components/ui/save-icon-button"

type TrustTier = "unclaimed" | "claimed" | "verified" | "certified"

interface EntityCardProps {
  id: string
  name: string
  slug: string
  citySlug: string
  entityType?: string
  coverImageUrl?: string | null
  category: string
  city: string
  trustTier: TrustTier
  isSaved?: boolean
  isFeatured?: boolean
  isSponsored?: boolean
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()
}

export function EntityCard({
  id,
  name,
  slug,
  citySlug,
  entityType = "business",
  coverImageUrl,
  category,
  city,
  trustTier,
  isSaved = false,
  isFeatured = false,
  className,
}: EntityCardProps) {
  const href = `/${citySlug}/${entityType}/${slug}`
  const initials = getInitials(name)

  return (
    // article + pseudo-element card-link pattern: avoids nesting <button> inside <a>
    // The <Link> inside the name text has after:absolute after:inset-0, extending its
    // click area to cover the full card for mouse users while keeping the DOM valid.
    // SaveIconButton stays at z-10 above the transparent overlay.
    <article
      className={cn(
        "relative group rounded-lg border border-pale-lavender overflow-hidden bg-white transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-amber-gold focus-within:ring-offset-2",
        className
      )}
    >
      {/* ── Cover image area ───────────────────────────────────────────────── */}
      <div className="relative aspect-video w-full bg-charcoal overflow-hidden">
        {coverImageUrl ? (
          // alt="" — decorative; the card link text (name) is the accessible description
          <Image
            src={coverImageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="font-headline text-2xl text-white select-none"
              aria-hidden="true"
            >
              {initials}
            </span>
          </div>
        )}

        {/* Trust tier badge — bottom-left */}
        <StatusBadge
          tier={trustTier}
          size="small"
          className="absolute bottom-2 left-2 z-10"
        />

        {/* Featured badge — top-left */}
        {isFeatured && (
          <span className="absolute top-2 left-2 z-10 inline-flex items-center rounded-full border border-amber-gold text-amber-gold bg-transparent text-[11px] px-2 py-0.5 font-subhead font-semibold leading-none">
            Featured
          </span>
        )}

        {/* Save icon button — top-right, z-10 keeps it above the card link overlay */}
        <SaveIconButton
          listingId={id}
          listingName={name}
          initialIsSaved={isSaved}
          className="z-10"
        />
      </div>

      {/* ── Card content ───────────────────────────────────────────────────── */}
      <div className="p-3">
        <p className="font-headline text-[15px] text-brand-black leading-tight line-clamp-2">
          {/* after:absolute after:inset-0 stretches the link hit area to cover the full card */}
          <Link
            href={href}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {name}
          </Link>
        </p>
        <p className="font-subhead text-[13px] text-charcoal mt-1">
          {category}
        </p>
        <p className="font-subhead text-[13px] text-charcoal">
          {city}
        </p>
      </div>
    </article>
  )
}
