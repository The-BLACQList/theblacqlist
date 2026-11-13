import {
  Accessibility,
  Award,
  Calendar,
  ClipboardCheck,
  Clock,
  Coffee,
  CreditCard,
  Dog,
  Flame,
  Gift,
  Handshake,
  Heart,
  Leaf,
  Lightbulb,
  MapPin,
  MessageSquare,
  Music,
  Paintbrush,
  Palette,
  PenTool,
  Printer,
  Recycle,
  Rocket,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Truck,
  Users,
  Utensils,
  Wifi,
  type LucideIcon,
} from 'lucide-react'

/**
 * The icons a highlight may name (ticket 195). A fixed allow-list, keyed by
 * the kebab-case name the owner picks in the editor, so the page never
 * imports an icon by an arbitrary string.
 */
export const HIGHLIGHT_ICONS = {
  accessibility: Accessibility,
  award: Award,
  calendar: Calendar,
  'clipboard-check': ClipboardCheck,
  clock: Clock,
  coffee: Coffee,
  'credit-card': CreditCard,
  dog: Dog,
  flame: Flame,
  gift: Gift,
  handshake: Handshake,
  heart: Heart,
  leaf: Leaf,
  lightbulb: Lightbulb,
  'map-pin': MapPin,
  'message-square': MessageSquare,
  music: Music,
  paintbrush: Paintbrush,
  palette: Palette,
  'pen-tool': PenTool,
  printer: Printer,
  recycle: Recycle,
  rocket: Rocket,
  scissors: Scissors,
  search: Search,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  truck: Truck,
  users: Users,
  utensils: Utensils,
  wifi: Wifi,
} as const satisfies Record<string, LucideIcon>

export type HighlightIconName = keyof typeof HIGHLIGHT_ICONS

export function isHighlightIcon(name: string): name is HighlightIconName {
  return Object.hasOwn(HIGHLIGHT_ICONS, name)
}

/** The named icon, or a spark when the name is missing or unknown. */
export function highlightIcon(name: string | null | undefined): LucideIcon {
  return name && isHighlightIcon(name) ? HIGHLIGHT_ICONS[name] : Sparkles
}
