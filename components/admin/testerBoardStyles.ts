// Shared look for the admin testers board (ticket 137). Status always has a
// word in the pill, so color is never the only signal.

import type { SpotState, WalkState } from '@/lib/tester/board'

const GOLD = 'text-[#7a5600] bg-[#fbf3e2] border-[#ecd9ad]'
const BLUE = 'text-[#1f4f8f] bg-[#eaf1fa] border-[#c9daf0]'
const GREEN = 'text-[#126240] bg-[#e8f3ec] border-[#bfdcca]'
const GRAY = 'text-[#55545a] bg-[#f0eff2] border-[#dddce0]'

export const PILL_CLASS: Record<SpotState, string> = {
  quiet: GOLD,
  free_waiting: GOLD,
  just_joined: BLUE,
  walking: BLUE,
  done: GREEN,
  free_used: GREEN,
  ended: GRAY,
}

export const PILL_BASE =
  'inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold font-subhead'

export const SEGMENT_CLASS: Record<WalkState, string> = {
  done: 'bg-ink',
  stuck: 'bg-gold',
  next: 'bg-[#e3e2e5]',
  todo: 'bg-[#e3e2e5]',
}

/** Small gray text, darkened past charcoal-soft per the design critique. */
export const MUTED = 'text-[#55545a]'
