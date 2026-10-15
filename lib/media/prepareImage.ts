import sharp from 'sharp'
import { matchesDeclaredType, SIGNATURE_HEADER_BYTES } from '@/lib/security/file-signature'

// =============================================================================
// Re-encoding listing photos before they are stored (ticket 127)
// =============================================================================
// Every listing photo, uploaded or imported from an owner's site, goes through
// here first:
//
//   * the bytes must match the declared type (or, for an import, be one of the
//     three types we store), using the same magic-byte check as uploads;
//   * the image is decoded and written out again. Writing it out again drops
//     EXIF, XMP and IPTC data, so a phone photo's GPS position never reaches
//     the public bucket. Orientation is applied first so the photo still
//     faces the right way once the tag is gone;
//   * anything larger than 2400px on its long edge is scaled down.
//
// Decoding also rejects a file that only looks like an image in its first
// twelve bytes, which the signature check alone cannot.
// =============================================================================

export const STORED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type StoredImageType = (typeof STORED_IMAGE_TYPES)[number]

export const IMAGE_MAX_EDGE = 2400

/** A decompression bomb guard: 50 megapixels is past any phone camera. */
const MAX_INPUT_PIXELS = 50_000_000

const EXT: Record<StoredImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type PreparedImage = {
  ok: true
  bytes: Buffer
  contentType: StoredImageType
  ext: string
  width: number
  height: number
}

export type PrepareImageFailure = {
  ok: false
  /** `mismatch`: bytes are not the declared type. `unsupported`: not JPEG, PNG or WebP. `unreadable`: failed to decode. */
  reason: 'mismatch' | 'unsupported' | 'unreadable'
}

/** The stored type the leading bytes belong to, or null. */
export function sniffImageType(header: Uint8Array): StoredImageType | null {
  return STORED_IMAGE_TYPES.find((type) => matchesDeclaredType(header, type)) ?? null
}

/**
 * Checks, decodes and re-encodes an image. With `declaredType`, the bytes must
 * match it. Without one (an imported photo, whose server may send any
 * content-type), the type is read from the bytes.
 */
export async function prepareImage(
  input: Buffer,
  declaredType?: string,
): Promise<PreparedImage | PrepareImageFailure> {
  const header = input.subarray(0, SIGNATURE_HEADER_BYTES)
  let type: StoredImageType | null
  if (declaredType !== undefined) {
    if (!(STORED_IMAGE_TYPES as readonly string[]).includes(declaredType)) {
      return { ok: false, reason: 'unsupported' }
    }
    if (!matchesDeclaredType(header, declaredType)) return { ok: false, reason: 'mismatch' }
    type = declaredType as StoredImageType
  } else {
    type = sniffImageType(header)
    if (!type) return { ok: false, reason: 'unsupported' }
  }

  try {
    let pipeline = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width: IMAGE_MAX_EDGE,
        height: IMAGE_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
    if (type === 'image/jpeg') pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true })
    else if (type === 'image/png') pipeline = pipeline.png()
    else pipeline = pipeline.webp({ quality: 85 })

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
    return { ok: true, bytes: data, contentType: type, ext: EXT[type], width: info.width, height: info.height }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}
