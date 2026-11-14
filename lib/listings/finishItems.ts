// Pure and client-safe: the strength meter (a client component) and the owner
// Cue (server) both read these.

// Short labels and anchors for the finish view (tickets 126 and 129). The
// checklist's own labels are longer, written for a standalone list.
export const FINISH_ITEMS: Record<string, { label: string; anchor: string }> = {
  tagline: { label: 'One-Line Tagline', anchor: '#basics' },
  description: { label: 'About, 100+ Characters', anchor: '#about' },
  logo: { label: 'A Photo', anchor: '#photos' },
  cover: { label: 'Cover Photo', anchor: '#photos' },
  gallery: { label: 'A Second Photo', anchor: '#photos' },
  cta: { label: 'Main Button', anchor: '#main-button' },
  contact: { label: 'Phone or Website', anchor: '#contact' },
  hours: { label: 'Hours', anchor: '#hours' },
  social: { label: 'A Social Link', anchor: '#social' },
  service: { label: 'A Service', anchor: '#services' },
  meta_title: { label: 'Search Title', anchor: '#google' },
  meta_description: { label: 'Search Description', anchor: '#google' },
  niche: { label: 'A Niche', anchor: '#details' },
  sample: { label: 'A Sample Post or Video', anchor: '#video' },
}

export function itemLabel(id: string, fallback: string): string {
  return FINISH_ITEMS[id]?.label ?? fallback
}
