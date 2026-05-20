import Link from "next/link"
import { cn } from "@/lib/utils"

interface Props {
  label: string
  count: number
  href: string
  urgent?: boolean
}

export function AdminStatCard({ label, count, href, urgent = false }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border bg-white p-5 hover:shadow-md transition-shadow",
        urgent && count > 0 ? "border-amber-300" : "border-charcoal/10"
      )}
    >
      <p className="font-subhead text-xs text-charcoal/60 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={cn(
          "font-headline text-4xl",
          urgent && count > 0 ? "text-amber-600" : "text-brand-black"
        )}
      >
        {count.toLocaleString()}
      </p>
      <p className="font-subhead text-xs text-amber-gold mt-2">
        View queue →
      </p>
    </Link>
  )
}
