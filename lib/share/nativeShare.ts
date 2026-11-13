// =============================================================================
// Browser share helpers. Client-only.
// =============================================================================
// iOS only opens the share sheet from a tap, and loses the tap if the handler
// awaits anything slow first. So the image is fetched or drawn before the
// sheet opens, and these helpers take a ready File.
// =============================================================================

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed'

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** True when the browser can put an image file into the share sheet. */
export function canShareFiles(file: File): boolean {
  if (!canNativeShare() || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

function outcomeOf(err: unknown): ShareOutcome {
  return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'failed'
}

export async function shareLink(data: {
  title?: string
  text: string
  url: string
}): Promise<ShareOutcome> {
  if (!canNativeShare()) return 'unsupported'
  try {
    await navigator.share(data)
    return 'shared'
  } catch (err) {
    return outcomeOf(err)
  }
}

/**
 * Share an image file. Text rides along where the target app accepts it;
 * Instagram drops it, which is why the sheet also copies the caption first.
 */
export async function shareImageFile(file: File, text?: string): Promise<ShareOutcome> {
  if (!canShareFiles(file)) return 'unsupported'
  try {
    await navigator.share({ files: [file], ...(text ? { text } : {}) })
    return 'shared'
  } catch (err) {
    return outcomeOf(err)
  }
}

export function downloadFile(file: File): void {
  const href = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = href
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the download a moment to start before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(href), 10_000)
}

export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type || 'image/png' })
}

/** A filesystem-safe name: "the-blacqlist-mama-s-kitchen-story.png". */
export function shareFileName(businessName: string, format: string): string {
  const slug = businessName
    .toLowerCase()
    .normalize('NFKD')
    // Drop the accents NFKD split off, so "Crème" is "creme", not "cre-me".
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `the-blacqlist-${slug || 'share'}-${format}.png`
}
