// =============================================================================
// Magic-byte signature checking for uploads (ledger 6.3)
// =============================================================================
// `file.type` on a multipart upload is a string the client chose. Before this,
// nothing on the upload path ever looked at the bytes: a caller could declare
// `image/jpeg`, send an HTML document or a shell script, and it would be stored
// in a public bucket with `Content-Type: image/jpeg`. The consolidation (6.2)
// removed the *filename* as an attacker-controlled input; this removes the
// declared *type* as one.
//
// What this is NOT. A file whose first bytes are a valid JPEG header IS a JPEG
// as far as this check is concerned, and a real image can still carry a payload
// appended after the image data, or be a polyglot crafted to parse as two
// formats at once. Signature checking raises the floor — it does not make an
// upload safe. Malware scanning is the other half of ledger 6.3 and needs a
// scanning service, which is a spend decision, not a code change. It is
// deliberately not attempted here in a way that would look like coverage.
//
// Scope: the four types the upload endpoint accepts. Anything else fails
// closed — an unrecognised declared type has no signature to match, and
// guessing is how a check like this quietly becomes a no-op.
// =============================================================================

/**
 * Bytes the caller must supply to `matchesDeclaredType`. WebP needs the most:
 * `RIFF` at 0..3 and `WEBP` at 8..11.
 */
export const SIGNATURE_HEADER_BYTES = 12

/** Error code and copy for a declared type the bytes do not support. */
export const SIGNATURE_MISMATCH_CODE = 'FILE_CONTENT_MISMATCH'
export const SIGNATURE_MISMATCH_ERROR =
  'That file does not appear to be the type it claims to be. Re-save it and try again.'

function startsWith(header: Uint8Array, bytes: number[], offset = 0): boolean {
  if (header.length < offset + bytes.length) return false
  for (let i = 0; i < bytes.length; i++) {
    if (header[offset + i] !== bytes[i]) return false
  }
  return true
}

const ASCII_RIFF = [0x52, 0x49, 0x46, 0x46]
const ASCII_WEBP = [0x57, 0x45, 0x42, 0x50]

const MATCHERS: Record<string, (header: Uint8Array) => boolean> = {
  // SOI marker, then the first segment marker. Every JFIF/Exif JPEG opens this
  // way regardless of which encoder produced it.
  'image/jpeg': (h) => startsWith(h, [0xff, 0xd8, 0xff]),

  // The 8-byte PNG signature, including the CR/LF and EOF bytes that exist
  // specifically to detect mangled transfers.
  'image/png': (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),

  // RIFF container with a WEBP form type. Bytes 4..7 are the file length and
  // are not checked — they vary per file and prove nothing about the format.
  'image/webp': (h) => startsWith(h, ASCII_RIFF) && startsWith(h, ASCII_WEBP, 8),

  // `%PDF-`. The spec allows a reader to tolerate junk before the header, and
  // this deliberately does not: a document produced by a scanner, a phone, or
  // any office suite puts it at byte 0, and accepting a leading-junk PDF means
  // accepting a file that is something else with a PDF stapled inside it.
  'application/pdf': (h) => startsWith(h, [0x25, 0x50, 0x44, 0x46, 0x2d]),
}

/**
 * True when the leading bytes are consistent with `declaredMime`.
 *
 * Fails closed on an unrecognised type and on a header too short to decide.
 */
export function matchesDeclaredType(header: Uint8Array, declaredMime: string): boolean {
  const matcher = MATCHERS[declaredMime]
  if (!matcher) return false
  return matcher(header)
}

/** Reads only the leading bytes — the body is not buffered to run this check. */
export async function readSignatureHeader(file: File): Promise<Uint8Array> {
  const slice = await file.slice(0, SIGNATURE_HEADER_BYTES).arrayBuffer()
  return new Uint8Array(slice)
}
