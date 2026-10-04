// Gmail dot trick: Gmail ignores dots in the part before the @, so
// a.b.c.d12@gmail.com and abcd12@gmail.com reach the same inbox. Bots use this
// to sign one inbox up many times while each address looks new. On 2026-10-04,
// 20 of the 23 waitlist rows were this pattern: letters plus 2 or 3 digits,
// with 2 to 10 dots scattered through, often between single letters or digits.
//
// The rule is narrow on purpose, so real addresses like first.last@gmail.com
// or first.m.last@gmail.com still pass:
//   * 3 or more dots in the name part, or
//   * a dot between two digits (people don't split a number with a dot).
//
// A real person caught by this loses nothing: because Gmail ignores the dots,
// they can enter the same address with fewer dots and still get our mail.

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])
const MAX_DOTS = 2

export const GMAIL_DOT_TRICK_ERROR =
  'Gmail ignores dots in addresses. Please enter yours without the extra dots.'

export function isGmailDotTrick(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 1) return false

  const domain = email.slice(at + 1).toLowerCase()
  if (!GMAIL_DOMAINS.has(domain)) return false

  // Gmail also ignores everything after a +, so only the part before it counts.
  const name = email.slice(0, at).split('+')[0] ?? ''
  const dots = name.split('.').length - 1

  return dots > MAX_DOTS || /[0-9]\.[0-9]/.test(name)
}
