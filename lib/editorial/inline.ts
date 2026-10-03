// Inline markdown for editorial bodies: links only, `[text](href)`.
//
// Story bodies are written by admins, but they are still rendered as public
// HTML, so the href is checked before it becomes a link:
//   - an internal path (`/houston/business/peach-and-rye`) → next/link
//   - an absolute `https:` URL → a plain link with rel="noopener noreferrer"
//   - anything else (`javascript:`, `data:`, `http:`, `//host`) → the link
//     text alone, with no link at all

export type HrefKind = 'internal' | 'external'

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string; kind: HrefKind }

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g

export function classifyHref(href: string): HrefKind | null {
  // `//host` and `/\host` are protocol-relative: browsers treat both as
  // another origin, so neither counts as an internal path.
  if (href.startsWith('/')) {
    return href.startsWith('//') || href.startsWith('/\\') ? null : 'internal'
  }
  try {
    return new URL(href).protocol === 'https:' ? 'external' : null
  } catch {
    return null
  }
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let last = 0
  for (const match of text.matchAll(LINK)) {
    const [whole, label = '', href = ''] = match
    const start = match.index ?? 0
    if (start > last) tokens.push({ type: 'text', text: text.slice(last, start) })
    const kind = classifyHref(href)
    tokens.push(kind ? { type: 'link', text: label, href, kind } : { type: 'text', text: label })
    last = start + whole.length
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) })
  return tokens
}

/** The text with link markup removed, for places that render plain text. */
export function stripInline(text: string): string {
  return parseInline(text)
    .map((t) => t.text)
    .join('')
}

/** Every href in the text that passes `classifyHref`, in order. */
export function inlineHrefs(text: string): { href: string; kind: HrefKind }[] {
  return parseInline(text).flatMap((t) =>
    t.type === 'link' ? [{ href: t.href, kind: t.kind }] : []
  )
}

/**
 * The first `> ` blockquote in a body, as plain text, or null. Split the same
 * way `EditorialRichTextDisplay` splits paragraphs, so the index pull quote is
 * exactly the quote the article page renders.
 */
export function firstPullQuote(body: string | null | undefined): string | null {
  for (const para of (body ?? '').split(/\n\n+/)) {
    const p = para.trim()
    if (p.startsWith('> ')) {
      const quote = stripInline(p.slice(2)).trim()
      if (quote) return quote
    }
  }
  return null
}
