import { BlockList, isIP } from 'node:net'

// =============================================================================
// Which network addresses an owner-supplied URL may reach (ticket 127)
// =============================================================================
// The site import is the first server code that fetches a URL a user typed.
// Without this list, "my website is http://169.254.169.254/" reads the cloud
// metadata service, and "http://10.0.0.5/" reaches whatever sits on the private
// network next to the function. Every address a fetch connects to goes through
// `isBlockedAddress`, including each hop of a redirect.
//
// Blocked: anything that is not ordinary public unicast. That is loopback,
// private ranges, carrier-grade NAT, link-local (which holds the metadata
// service), documentation and benchmark ranges, multicast, and reserved space.
// IPv6 forms that wrap an IPv4 address (mapped, NAT64, 6to4) are unwrapped and
// judged by the IPv4 address inside.
// =============================================================================

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, includes broadcast
]

const V6_BLOCKED: [string, number][] = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // old site-local
  ['ff00::', 8], // multicast
]

const v4List = new BlockList()
for (const [net, prefix] of V4_BLOCKED) v4List.addSubnet(net, prefix, 'ipv4')

const v6List = new BlockList()
for (const [net, prefix] of V6_BLOCKED) v6List.addSubnet(net, prefix, 'ipv6')

/** Expands an IPv6 address to eight 16-bit groups. Returns null if malformed. */
function expandV6(address: string): number[] | null {
  let addr = address.toLowerCase()
  const zone = addr.indexOf('%')
  if (zone !== -1) addr = addr.slice(0, zone)

  // A trailing dotted IPv4 part (::ffff:1.2.3.4) becomes two groups.
  const lastColon = addr.lastIndexOf(':')
  const tail = addr.slice(lastColon + 1)
  if (tail.includes('.')) {
    if (isIP(tail) !== 4) return null
    const [a, b, c, d] = tail.split('.').map(Number) as [number, number, number, number]
    addr = `${addr.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }

  const halves = addr.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 1 && missing !== 0) return null
  if (missing < 0) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest]
  if (groups.length !== 8) return null
  const out = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN))
  return out.some(Number.isNaN) ? null : out
}

function v4FromGroups(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`
}

/**
 * The IPv4 address an IPv6 address stands for, when it is one of the forms
 * that wrap one: IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d),
 * NAT64 (64:ff9b::a.b.c.d) or 6to4 (2002:aabb:ccdd::).
 */
function embeddedV4(groups: number[]): string | null {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [
    number, number, number, number, number, number, number, number,
  ]
  const zeroPrefix = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0
  if (zeroPrefix && g5 === 0xffff) return v4FromGroups(g6, g7)
  if (zeroPrefix && g5 === 0 && (g6 !== 0 || g7 > 1)) return v4FromGroups(g6, g7)
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return v4FromGroups(g6, g7)
  }
  if (g0 === 0x2002) return v4FromGroups(g1, g2)
  return null
}

/**
 * True when a fetch must not connect to `address`. Anything that is not a
 * well-formed IP address is blocked too: this guard fails closed.
 */
export function isBlockedAddress(address: string): boolean {
  const bare = address.startsWith('[') && address.endsWith(']') ? address.slice(1, -1) : address
  const family = isIP(bare.split('%')[0] ?? '')
  if (family === 4) return v4List.check(bare, 'ipv4')
  if (family !== 6) return true

  const groups = expandV6(bare)
  if (!groups) return true
  const v4 = embeddedV4(groups)
  if (v4) return v4List.check(v4, 'ipv4')
  return v6List.check(bare.split('%')[0]!, 'ipv6')
}
