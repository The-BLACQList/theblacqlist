export type CopyResult = 'copied' | 'failed'

interface ClipboardLike {
  writeText(text: string): Promise<void>
}

/**
 * Try the clipboard API. Returns 'failed' when it is missing or refuses (denied
 * permission, insecure context), so the caller can fall back to selecting the
 * text for the visitor to copy by hand.
 */
export async function copyToClipboard(
  text: string,
  clipboard: ClipboardLike | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.clipboard
): Promise<CopyResult> {
  if (!clipboard) return 'failed'
  try {
    await clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
