import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time equality. `timingSafeEqual` throws on unequal lengths, and an
 * early `false` on a length mismatch leaks the code's length one byte at a
 * time, so mismatched lengths still run a full compare (of the expected value
 * against itself) before answering false.
 */
export function codeMatches(candidate: string, expected: string): boolean {
  if (expected.length === 0) return false
  const a = Buffer.from(candidate, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) {
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}
