import { describe, expect, it } from 'vitest'
import { isBlockedAddress } from '@/lib/import/address-policy'

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '::',
    '::1',
    '[::1]',
    'fe80::1',
    'fe80::1%en0',
    'fd00::1',
    'fc00::abcd',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:7f00:1', // same, hex form
    '::ffff:169.254.169.254',
    '::127.0.0.1', // IPv4-compatible
    '64:ff9b::a00:5', // NAT64 of 10.0.0.5
    '2002:a9fe:a9fe::1', // 6to4 of 169.254.169.254
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true)
  })

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1', // just past 172.16/12
    '93.184.216.34',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
    '::ffff:8.8.8.8',
    '2002:0808:0808::1', // 6to4 of a public address
  ])('allows %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false)
  })

  it.each(['', 'localhost', 'example.com', '999.1.1.1', '1.2.3', 'gggg::1', '1::2::3'])(
    'fails closed on %j',
    (address) => {
      expect(isBlockedAddress(address)).toBe(true)
    },
  )
})
