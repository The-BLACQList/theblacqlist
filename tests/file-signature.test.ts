// Unit coverage for lib/security/file-signature.ts.
//
// The route suite proves the check is wired in and ordered correctly. This one
// proves the matcher itself is right, including the two ways a signature check
// silently stops working: a type it does not recognise, and a header too short
// to decide on. Both must fail closed, because a matcher that returns true when
// it does not know is worse than no check at all — it reports coverage it does
// not have.

import { describe, it, expect } from 'vitest'
import {
  matchesDeclaredType,
  readSignatureHeader,
  SIGNATURE_HEADER_BYTES,
} from '@/lib/security/file-signature'

const MAGIC: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/webp': [0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37],
}

const TYPES = Object.keys(MAGIC)

// The buffer type is pinned rather than left to widen: a bare `Uint8Array`
// return annotation resolves to `Uint8Array<ArrayBufferLike>`, which `File`
// rejects as a `BlobPart` because it could be backed by a SharedArrayBuffer.
function header(type: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(MAGIC[type]!)
}

describe('each accepted type matches its own signature', () => {
  for (const type of TYPES) {
    it(`accepts ${type}`, () => {
      expect(matchesDeclaredType(header(type), type)).toBe(true)
    })
  }
})

describe('no accepted type matches another one', () => {
  for (const declared of TYPES) {
    for (const actual of TYPES) {
      if (declared === actual) continue
      it(`rejects ${actual} bytes declared as ${declared}`, () => {
        expect(matchesDeclaredType(header(actual), declared)).toBe(false)
      })
    }
  }
})

describe('failing closed', () => {
  it('rejects a declared type it has no signature for', () => {
    // The route restricts types before calling this, so an unknown type should
    // be unreachable — which is exactly why the default must not be `true`.
    expect(matchesDeclaredType(header('image/png'), 'image/gif')).toBe(false)
    expect(matchesDeclaredType(header('image/png'), 'text/html')).toBe(false)
    expect(matchesDeclaredType(header('image/png'), '')).toBe(false)
  })

  it('rejects a header too short to decide', () => {
    expect(matchesDeclaredType(new Uint8Array([]), 'image/jpeg')).toBe(false)
    expect(matchesDeclaredType(new Uint8Array([0xff, 0xd8]), 'image/jpeg')).toBe(false)
    // A truncated PNG signature: right first four bytes, missing the CR/LF/EOF
    // bytes that exist to catch exactly this.
    expect(matchesDeclaredType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/png')).toBe(false)
  })

  it('rejects a body of zeroes', () => {
    for (const type of TYPES) {
      expect(matchesDeclaredType(new Uint8Array(SIGNATURE_HEADER_BYTES), type)).toBe(false)
    }
  })
})

describe('container formats are not matched on the container alone', () => {
  it('rejects a RIFF file that is not WebP', () => {
    // WAVE and AVI are RIFF containers too. Matching `RIFF` and stopping would
    // accept both as images.
    const wave = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ])
    expect(matchesDeclaredType(wave, 'image/webp')).toBe(false)
  })

  it('rejects WEBP present without the RIFF container', () => {
    const naked = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ])
    expect(matchesDeclaredType(naked, 'image/webp')).toBe(false)
  })
})

describe('the PDF header is required at byte 0', () => {
  it('rejects a PDF preceded by junk', () => {
    // Readers tolerate this; an upload endpoint should not. A file with
    // something else in front of `%PDF-` is something else with a PDF inside.
    const shifted = new Uint8Array([0x0a, 0x0a, 0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
    expect(matchesDeclaredType(shifted, 'application/pdf')).toBe(false)
  })

  it('requires the trailing hyphen, not just the letters', () => {
    const noHyphen = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x31, 0x2e, 0x37, 0x00])
    expect(matchesDeclaredType(noHyphen, 'application/pdf')).toBe(false)
  })
})

describe('readSignatureHeader', () => {
  it('reads only the leading bytes, not the whole body', async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    const read = await readSignatureHeader(big)
    expect(read.length).toBe(SIGNATURE_HEADER_BYTES)
  })

  it('returns a short array rather than padding when the file is smaller', async () => {
    const tiny = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'tiny.jpg', { type: 'image/jpeg' })
    const read = await readSignatureHeader(tiny)
    expect(read.length).toBe(3)
    expect(matchesDeclaredType(read, 'image/jpeg')).toBe(true)
  })

  it('reads the real bytes, so a genuine file round-trips', async () => {
    for (const type of TYPES) {
      const f = new File([header(type)], 'x', { type })
      expect(matchesDeclaredType(await readSignatureHeader(f), type)).toBe(true)
    }
  })
})
