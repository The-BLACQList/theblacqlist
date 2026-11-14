// Pure and client-safe: the strength meter (a client component) and the owner
// Cue (server) both read these.

// Short labels and anchors for the finish view (tickets 126 and 129). The
// checklist's own labels are longer, written for a standalone list.
export const FINISH_ITEMS: Record<string, { label: string; anchor: string }> = {
  tagline: { label: 'One-line tagline', anchor: '#basics' },
  description: { label: 'About, 100+ characters', anchor: '#about' },
  logo: { label: 'A photo', anchor: '#photos' },
  cover: { label: 'Cover photo', anchor: '#photos' },
  gallery: { label: 'A second photo', anchor: '#photos' },
  cta: { label: 'Main button', anchor: '#main-button' },
  contact: { label: 'Phone or website', anchor: '#contact' },
  hours: { label: 'Hours', anchor: '#hours' },
  social: { label: 'A social link', anchor: '#social' },
  service: { label: 'A service', anchor: '#services' },
  meta_title: { label: 'Search title', anchor: '#google' },
  meta_description: { label: 'Search description', anchor: '#google' },
  niche: { label: 'A niche', anchor: '#details' },
  sample: { label: 'A sample post or video', anchor: '#video' },
}

export function itemLabel(id: string, fallback: string): string {
  return FINISH_ITEMS[id]?.label ?? fallback
}
