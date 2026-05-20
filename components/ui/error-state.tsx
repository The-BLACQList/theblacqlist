"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  heading?: string
  body?: string
  reset?: () => void
  homeHref?: string
  className?: string
}

export function ErrorState({
  heading = "Something went wrong",
  body = "An unexpected error occurred. Please try again.",
  reset,
  homeHref = "/",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex flex-col items-center text-center py-16 px-4 gap-4",
        className
      )}
    >
      <AlertCircle
        size={48}
        className="text-charcoal"
        aria-hidden="true"
      />

      <h2 className="font-headline text-xl md:text-2xl text-brand-black">
        {heading}
      </h2>

      <p className="font-body text-base text-charcoal max-w-sm">
        {body}
      </p>

      {reset && (
        <Button
          onClick={reset}
          className="bg-amber-gold text-brand-black hover:bg-light-gold rounded-full px-6 py-2.5 font-subhead font-semibold"
        >
          Try again
        </Button>
      )}

      <Link
        href={homeHref}
        className="text-amber-gold hover:underline font-subhead text-sm"
      >
        Go home
      </Link>
    </div>
  )
}
