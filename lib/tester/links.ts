import { createHash, randomBytes } from 'node:crypto'

/**
 * One-tap tester links: the pure parts, kept out of the 'use server' files so
 * they can be unit tested and shared by the mint and redeem actions.
 *
 * A link is `<origin>/t#<token>`. The token is 32 random bytes in base64url and
 * only its SHA-256 hex is stored (tester_invites.token_hash). It rides in the
 * URL fragment, which browsers never send to a server, so it stays out of
 * request logs, the proxy and Referer headers. Nothing in this module logs.
 *
 * Plan: docs/blacqlist/ops/tester-week/one-tap-link-plan-2026-10-01.md.
 */

export type TesterLinkKind = 'supporter' | 'owner'

/** D1, approved 2026-10-01: reusable, five uses, fourteen days. */
export const TESTER_LINK_MAX_USES = 5
export const TESTER_LINK_TTL_DAYS = 14

export const TESTER_LINK_LABEL_MAX = 40

/** 32 bytes of base64url without padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function generateTesterToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashTesterToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Shape check only. A well-formed token can still be unknown or spent. */
export function isWellFormedTesterToken(value: string): boolean {
  return TOKEN_PATTERN.test(value)
}

export function buildTesterLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/t#${token}`
}

/**
 * The origin the admin is minting from. A link has to land on the deployment
 * whose database holds its hash: a link made on a Preview must open on that
 * Preview, because Previews are bound to the staging database.
 */
export function originFromHeaders(headers: Headers): string | null {
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (!host) return null
  const forwardedProto = headers.get('x-forwarded-proto')
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  const proto = forwardedProto ?? (isLocal ? 'http' : 'https')
  return `${proto}://${host}`
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeTesterEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null
}

export function normalizeTesterLabel(raw: string): string | null {
  const label = raw.trim()
  return label.length >= 1 && label.length <= TESTER_LINK_LABEL_MAX ? label : null
}

export interface TesterLinkStatusInput {
  use_count: number
  max_uses: number
  expires_at: string
  revoked_at: string | null
}

export type TesterLinkStatus =
  | { state: 'revoked'; label: 'Revoked' }
  | { state: 'expired'; label: 'Expired' }
  | { state: 'used_up'; label: string }
  | { state: 'unused'; label: 'Unused' }
  | { state: 'in_use'; label: string }

/** Order matters: a revoked link reads as revoked even after it expires. */
export function testerLinkStatus(
  row: TesterLinkStatusInput,
  now: Date = new Date()
): TesterLinkStatus {
  if (row.revoked_at !== null) return { state: 'revoked', label: 'Revoked' }
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    return { state: 'expired', label: 'Expired' }
  }
  if (row.use_count >= row.max_uses) {
    return { state: 'used_up', label: `Used ${row.use_count} of ${row.max_uses}` }
  }
  if (row.use_count === 0) return { state: 'unused', label: 'Unused' }
  return { state: 'in_use', label: `Used ${row.use_count} of ${row.max_uses}` }
}
