import http from 'node:http'
import type { AddressInfo } from 'node:net'
import zlib from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isBlockedAddress } from '@/lib/import/address-policy'
import {
  fetchWithPolicy,
  safeFetch,
  SafeFetchError,
  type SafeFetchPolicy,
} from '@/lib/import/safe-fetch'

// A local server stands in for an owner's site. The test policy lets requests
// reach 127.0.0.1 on any port and nothing else private, so redirects into
// private space are still refused.
const TEST_POLICY: SafeFetchPolicy = {
  isBlocked: (address) => address !== '127.0.0.1' && isBlockedAddress(address),
  allowedPorts: null,
}

let server: http.Server
let base = ''
let lastHeaders: http.IncomingHttpHeaders = {}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    lastHeaders = req.headers
    const path = req.url ?? '/'
    if (path === '/ok') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<html><title>Salon</title></html>')
    } else if (path === '/gzip') {
      res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
      res.end(zlib.gzipSync('<p>squeezed</p>'))
    } else if (path === '/bomb') {
      // A few KB on the wire, 5 MB once expanded.
      res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
      res.end(zlib.gzipSync(Buffer.alloc(5 * 1024 * 1024, 'a')))
    } else if (path === '/big') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(Buffer.alloc(3 * 1024 * 1024, 'a'))
    } else if (path === '/slow') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.write('<p>')
      // never ends
    } else if (path === '/to-ok') {
      res.writeHead(302, { location: '/ok' })
      res.end()
    } else if (path === '/to-metadata') {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' })
      res.end()
    } else if (path === '/to-private') {
      res.writeHead(301, { location: 'http://10.0.0.5/' })
      res.end()
    } else if (path === '/to-file') {
      res.writeHead(302, { location: 'file:///etc/passwd' })
      res.end()
    } else if (path.startsWith('/loop')) {
      const n = Number(path.slice(5) || '0')
      res.writeHead(302, { location: `/loop${n + 1}` })
      res.end()
    } else if (path === '/gone') {
      res.writeHead(404)
      res.end()
    } else {
      res.writeHead(500)
      res.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
    return 'resolved'
  } catch (err) {
    expect(err).toBeInstanceOf(SafeFetchError)
    return (err as SafeFetchError).code
  }
}

describe('safeFetch under the strict policy', () => {
  it.each([
    'http://127.0.0.1/',
    'http://10.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://0x7f.1/', // URL parsing turns this into 127.0.0.1
    'http://2130706433/',
  ])('refuses literal private address %s', async (url) => {
    expect(await codeOf(safeFetch(url))).toBe('blocked_address')
  })

  it('refuses a name that resolves to a private address', async () => {
    expect(await codeOf(safeFetch('http://localhost/'))).toBe('blocked_address')
  })

  it('refuses ports other than 80 and 443', async () => {
    expect(await codeOf(safeFetch('http://example.com:8080/'))).toBe('blocked_address')
  })

  it.each(['ftp://example.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])(
    'refuses %s as an invalid URL',
    async (url) => {
      expect(await codeOf(safeFetch(url))).toBe('invalid_url')
    },
  )

  it('refuses URLs with credentials', async () => {
    expect(await codeOf(safeFetch('http://user:pass@example.com/'))).toBe('invalid_url')
  })
})

describe('fetchWithPolicy against a local server', () => {
  it('reads a page and identifies itself', async () => {
    const res = await fetchWithPolicy(`${base}/ok`, {}, TEST_POLICY)
    expect(res.status).toBe(200)
    expect(res.contentType).toBe('text/html')
    expect(res.body.toString()).toContain('Salon')
    expect(lastHeaders['user-agent']).toContain('TheBLACQList')
    expect(lastHeaders.cookie).toBeUndefined()
  })

  it('decompresses gzip', async () => {
    const res = await fetchWithPolicy(`${base}/gzip`, {}, TEST_POLICY)
    expect(res.body.toString()).toBe('<p>squeezed</p>')
  })

  it('follows a same-site redirect and reports the final URL', async () => {
    const res = await fetchWithPolicy(`${base}/to-ok`, {}, TEST_POLICY)
    expect(res.url).toBe(`${base}/ok`)
  })

  it('refuses a redirect to the metadata address', async () => {
    expect(await codeOf(fetchWithPolicy(`${base}/to-metadata`, {}, TEST_POLICY))).toBe(
      'blocked_address',
    )
  })

  it('refuses a redirect to a private address', async () => {
    expect(await codeOf(fetchWithPolicy(`${base}/to-private`, {}, TEST_POLICY))).toBe(
      'blocked_address',
    )
  })

  it('refuses a redirect to a non-http scheme', async () => {
    expect(await codeOf(fetchWithPolicy(`${base}/to-file`, {}, TEST_POLICY))).toBe('invalid_url')
  })

  it('stops after 3 redirects', async () => {
    expect(await codeOf(fetchWithPolicy(`${base}/loop0`, {}, TEST_POLICY))).toBe(
      'too_many_redirects',
    )
  })

  it('caps the body size', async () => {
    expect(await codeOf(fetchWithPolicy(`${base}/big`, {}, TEST_POLICY))).toBe('too_large')
  })

  it('caps the body size after decompression', async () => {
    expect(await codeOf(fetchWithPolicy(`${base}/bomb`, {}, TEST_POLICY))).toBe('too_large')
  })

  it('gives up when the site is too slow', async () => {
    const started = Date.now()
    expect(await codeOf(fetchWithPolicy(`${base}/slow`, { timeoutMs: 300 }, TEST_POLICY))).toBe(
      'timeout',
    )
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('reports a missing page as not found', async () => {
    expect(await codeOf(fetchWithPolicy(`${base}/gone`, {}, TEST_POLICY))).toBe('not_found')
  })

  it('reports other error statuses', async () => {
    expect(await codeOf(fetchWithPolicy(`${base}/boom`, {}, TEST_POLICY))).toBe('http_error')
  })
})
