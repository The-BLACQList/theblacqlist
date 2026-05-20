"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

interface Props {
  defaultValue?: string
}

export function ClaimSearchForm({ defaultValue = "" }: Props) {
  const [value, setValue] = useState(defaultValue)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (!q) return
    router.push(`/claim?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-charcoal/40 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by business name…"
          className="w-full h-11 pl-9 pr-4 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60"
          autoComplete="off"
          aria-label="Search for a business to claim"
        />
      </div>
      <button
        type="submit"
        className="h-11 px-5 rounded-lg bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
      >
        Search
      </button>
    </form>
  )
}
