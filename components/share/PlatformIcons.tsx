import { cn } from '@/lib/utils'

// Brand glyphs this lucide-react version doesn't ship. Instagram and TikTok
// match components/nav/public-footer.tsx. Decorative only: every use sits in a
// button that carries its own text label.

interface IconProps {
  className?: string
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5', className)}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

export function TikTokIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('size-5', className)}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.21 8.21 0 0 0 4.79 1.53V6.77a4.85 4.85 0 0 1-1.02-.08z" />
    </svg>
  )
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('size-5', className)}
      aria-hidden="true"
    >
      <path d="M24 12.07C24 5.44 18.63.07 12 .07S0 5.44 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.39H7.08v-3.46h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.46h-2.8v8.39C19.61 23.02 24 18.06 24 12.07z" />
    </svg>
  )
}

export function XIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('size-5', className)}
      aria-hidden="true"
    >
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z" />
    </svg>
  )
}

export function ThreadsIcon({ className }: IconProps) {
  // A simplified "@" mark, which is how Threads reads at icon size.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn('size-5', className)}
      aria-hidden="true"
    >
      <path d="M16.5 11.5c0-2.8-1.9-4.5-4.4-4.5-2.7 0-4.6 2.1-4.6 5s1.8 5 4.4 5c1.9 0 3.2-1 3.6-2.6" />
      <path d="M15.5 11.5c0 2 .9 3.5 2.6 3.5 1.9 0 2.9-2 2.9-4.5C21 5.8 17.2 2 12 2S3 6.1 3 12s4 10 9 10c2 0 3.6-.5 5-1.4" />
    </svg>
  )
}

export function SnapchatIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={cn('size-5', className)}
      aria-hidden="true"
    >
      <path d="M12 2.5c3 0 5 2.2 5 5.2v2.4l1.7-.6c.6-.2 1.1.5.6 1l-1.9 1.3c.6 2 2.1 3.4 4 3.9-.4.9-1.6 1.2-2.7 1.4l-.4 1.4c-1-.2-2.2-.1-3.2.6-.9.6-1.8 1.4-3.1 1.4s-2.2-.8-3.1-1.4c-1-.7-2.2-.8-3.2-.6l-.4-1.4c-1.1-.2-2.3-.5-2.7-1.4 1.9-.5 3.4-1.9 4-3.9l-1.9-1.3c-.5-.5 0-1.2.6-1l1.7.6V7.7c0-3 2-5.2 5-5.2z" />
    </svg>
  )
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5', className)}
      aria-hidden="true"
    >
      <path d="M3 21l1.65-4.5A9 9 0 1 1 8 19.6L3 21z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.5-1.5-2-1-1 .8c-1-.4-1.9-1.3-2.3-2.3l.8-1-1-2L9 9.5z" />
    </svg>
  )
}
