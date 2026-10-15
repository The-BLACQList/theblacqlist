import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import type { Readable } from 'node:stream'
import zlib from 'node:zlib'
import { isBlockedAddress } from './address-policy'

// =============================================================================
// Fetching a URL an owner typed, without letting it reach our own network
// =============================================================================
// Server-side request forgery (SSRF) is the risk here: the URL comes from a
// user, and the request runs inside our infrastructure. The rules:
//
//   - http and https only, ports 80 and 443 only, no credentials in the URL.
//   - Every address a request connects to must be public. The check runs inside
//     the DNS lookup that the socket itself uses, so a name cannot resolve to a
//     public address when checked and a private one when connected. Literal IP
//     hosts skip DNS, so they are checked before the request starts.
//   - Redirects are followed by hand, at most 3, and each hop is checked again.
//   - One deadline covers every hop (8 s by default). The body cap (2 MB by
//     default) counts bytes after decompression, so a small gzip bomb cannot
//     expand past it.
//   - No cookies are sent or kept, and the User-Agent says who we are.
//
// `fetchWithPolicy` takes the address policy as a parameter so tests can reach
// a server on 127.0.0.1. Product code calls `safeFetch`, which always uses the
// strict policy.
// =============================================================================

export const IMPORT_USER_AGENT =
  'TheBLACQList/1.0 (+https://theblacqlist.com; hello@theblacqlist.com)'

export type SafeFetchErrorCode =
  | 'invalid_url'
  | 'blocked_address'
  | 'robots_blocked'
  | 'too_large'
  | 'timeout'
  | 'not_found'
  | 'http_error'
  | 'too_many_redirects'
  | 'unsupported_type'
  | 'network'

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode

  constructor(code: SafeFetchErrorCode, message: string) {
    super(message)
    this.name = 'SafeFetchError'
    this.code = code
  }
}

export interface SafeFetchPolicy {
  /** True when a request must not connect to this IP address. */
  isBlocked: (address: string) => boolean
  /** Ports a URL may name. `null` allows any port (tests only). */
  allowedPorts: ReadonlySet<number> | null
}

export const STRICT_POLICY: SafeFetchPolicy = {
  isBlocked: isBlockedAddress,
  allowedPorts: new Set([80, 443]),
}

export interface SafeFetchOptions {
  /** Body cap in bytes, counted after decompression. Default 2 MB. */
  maxBytes?: number
  /** One deadline across every redirect hop. Default 8000 ms. */
  timeoutMs?: number
  /** Default 3. */
  maxRedirects?: number
  /** Accept header. Default prefers HTML. */
  accept?: string
}

export interface SafeFetchResult {
  /** The URL that answered, after redirects. */
  url: string
  status: number
  /** Lowercased media type without parameters, e.g. `text/html`. */
  contentType: string
  body: Buffer
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_MAX_REDIRECTS = 3
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/** Parses and checks a URL before any network work. */
export function checkUrl(raw: string, policy: SafeFetchPolicy = STRICT_POLICY): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new SafeFetchError('invalid_url', 'That does not look like a web address.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('invalid_url', 'Only http and https addresses can be read.')
  }
  if (url.username || url.password) {
    throw new SafeFetchError('invalid_url', 'Web addresses with a login in them cannot be read.')
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  if (policy.allowedPorts && !policy.allowedPorts.has(port)) {
    throw new SafeFetchError('blocked_address', 'That address uses a port we do not read.')
  }
  // WHATWG URL parsing already turned 0x7f.1, 2130706433 and friends into
  // dotted IPv4, so a literal check here sees the real address.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && policy.isBlocked(host)) {
    throw new SafeFetchError('blocked_address', 'That address points somewhere we do not read.')
  }
  return url
}

function makeLookup(policy: SafeFetchPolicy): LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0)
      if (addresses.length === 0) {
        const e: NodeJS.ErrnoException = new Error(`No addresses for ${hostname}`)
        e.code = 'ENOTFOUND'
        return callback(e, '', 0)
      }
      // Refuse the host if ANY address is private. Picking only the public
      // ones would still let a split answer steer retries inward.
      if (addresses.some((a) => policy.isBlocked(a.address))) {
        const e = new SafeFetchError(
          'blocked_address',
          'That address points somewhere we do not read.',
        ) as SafeFetchError & NodeJS.ErrnoException
        return callback(e, '', 0)
      }
      if (options.all) return callback(null, addresses)
      const first = addresses[0]!
      return callback(null, first.address, first.family)
    })
  }
}

function toSafeFetchError(err: unknown): SafeFetchError {
  if (err instanceof SafeFetchError) return err
  const code = (err as NodeJS.ErrnoException | null)?.code
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'EAI_NONAME' || code === 'EAI_NODATA') {
    return new SafeFetchError('not_found', 'We could not find that site.')
  }
  if (code === 'ETIMEDOUT') {
    return new SafeFetchError('timeout', 'That site took too long to answer.')
  }
  return new SafeFetchError('network', 'We could not reach that site.')
}

type Hop = { kind: 'redirect'; location: string } | { kind: 'done'; result: SafeFetchResult }

function decoded(res: http.IncomingMessage): Readable {
  const encoding = String(res.headers['content-encoding'] ?? '').trim().toLowerCase()
  if (encoding === 'gzip' || encoding === 'x-gzip') return res.pipe(zlib.createGunzip())
  if (encoding === 'deflate') return res.pipe(zlib.createInflate())
  if (encoding === 'br') return res.pipe(zlib.createBrotliDecompress())
  if (encoding === '' || encoding === 'identity') return res
  throw new SafeFetchError('unsupported_type', 'That site sent a format we cannot read.')
}

function requestOnce(
  url: URL,
  policy: SafeFetchPolicy,
  deadline: number,
  maxBytes: number,
  accept: string,
): Promise<Hop> {
  return new Promise<Hop>((resolve, reject) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      reject(new SafeFetchError('timeout', 'That site took too long to answer.'))
      return
    }

    // `finish` reads `timer` and `req` from below. Both are set before any
    // callback can run, since the request and the timer only fire later.
    let settled = false

    const finish = (outcome: { hop: Hop } | { error: unknown }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if ('hop' in outcome) {
        resolve(outcome.hop)
      } else {
        req.destroy()
        reject(toSafeFetchError(outcome.error))
      }
    }

    const transport = url.protocol === 'https:' ? https : http
    const req = transport.request(
      url,
      {
        method: 'GET',
        // A fresh agent per request: no pooled socket from some other caller,
        // and every connection goes through our lookup.
        agent: false,
        lookup: makeLookup(policy),
        headers: {
          'User-Agent': IMPORT_USER_AGENT,
          Accept: accept,
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.8',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0
        const location = res.headers.location

        if (REDIRECT_STATUSES.has(status) && location) {
          res.resume()
          finish({ hop: { kind: 'redirect', location } })
          return
        }
        if (status === 404 || status === 410) {
          res.resume()
          finish({ error: new SafeFetchError('not_found', 'We could not find that page.') })
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          finish({ error: new SafeFetchError('http_error', `That site answered with ${status}.`) })
          return
        }

        const tooLarge = new SafeFetchError('too_large', 'That page is too big to read.')
        const declared = Number(res.headers['content-length'] ?? NaN)
        if (Number.isFinite(declared) && declared > maxBytes) {
          finish({ error: tooLarge })
          return
        }

        let body: Readable
        try {
          body = decoded(res)
        } catch (err) {
          finish({ error: err })
          return
        }

        const chunks: Buffer[] = []
        let total = 0
        res.on('error', (err) => finish({ error: err }))
        body.on('error', (err) => finish({ error: err }))
        body.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > maxBytes) {
            body.destroy()
            finish({ error: tooLarge })
            return
          }
          chunks.push(chunk)
        })
        body.on('end', () => {
          const contentType = String(res.headers['content-type'] ?? '')
            .split(';')[0]!
            .trim()
            .toLowerCase()
          finish({
            hop: {
              kind: 'done',
              result: { url: url.toString(), status, contentType, body: Buffer.concat(chunks) },
            },
          })
        })
      },
    )

    const timer = setTimeout(
      () => finish({ error: new SafeFetchError('timeout', 'That site took too long to answer.') }),
      remaining,
    )
    req.on('error', (err) => finish({ error: err }))
    req.end()
  })
}

/**
 * Fetches `rawUrl` under an explicit address policy. Product code should call
 * `safeFetch`; this exists so tests can point at a local server.
 */
export async function fetchWithPolicy(
  rawUrl: string,
  options: SafeFetchOptions,
  policy: SafeFetchPolicy,
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  const accept = options.accept ?? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  let url = checkUrl(rawUrl, policy)
  for (let hops = 0; ; hops++) {
    const hop = await requestOnce(url, policy, deadline, maxBytes, accept)
    if (hop.kind === 'done') return hop.result
    if (hops >= maxRedirects) {
      throw new SafeFetchError('too_many_redirects', 'That site sent us around too many times.')
    }
    let next: string
    try {
      next = new URL(hop.location, url).toString()
    } catch {
      throw new SafeFetchError('invalid_url', 'That site sent us to an address we cannot read.')
    }
    url = checkUrl(next, policy)
  }
}

/** Fetches an owner-supplied URL under the strict public-internet policy. */
export function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  return fetchWithPolicy(rawUrl, options, STRICT_POLICY)
}
