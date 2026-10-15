import { describe, expect, it } from 'vitest'
import { isAllowedByRobots } from '@/lib/import/robots'

describe('isAllowedByRobots', () => {
  it('allows everything when robots.txt is empty', () => {
    expect(isAllowedByRobots('', '/')).toBe(true)
  })

  it('honors a site-wide Disallow for every reader', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow: /', '/about')).toBe(false)
  })

  it('treats an empty Disallow as allow all', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow:', '/')).toBe(true)
  })

  it('prefers our own group over the * group', () => {
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: TheBLACQList\nAllow: /'
    expect(isAllowedByRobots(txt, '/')).toBe(true)
  })

  it('obeys a group that names us even when * allows', () => {
    const txt = 'User-agent: *\nAllow: /\n\nUser-agent: theblacqlist\nDisallow: /'
    expect(isAllowedByRobots(txt, '/')).toBe(false)
  })

  it('ignores groups for other readers', () => {
    expect(isAllowedByRobots('User-agent: Googlebot\nDisallow: /', '/')).toBe(true)
  })

  it('lets the longest matching rule win, and Allow win a tie', () => {
    const txt = 'User-agent: *\nDisallow: /shop\nAllow: /shop/about'
    expect(isAllowedByRobots(txt, '/shop/cart')).toBe(false)
    expect(isAllowedByRobots(txt, '/shop/about')).toBe(true)
    expect(isAllowedByRobots('User-agent: *\nDisallow: /a\nAllow: /a', '/a')).toBe(true)
  })

  it('supports * wildcards and $ anchors', () => {
    const txt = 'User-agent: *\nDisallow: /*.pdf$\nDisallow: /private*/'
    expect(isAllowedByRobots(txt, '/menu.pdf')).toBe(false)
    expect(isAllowedByRobots(txt, '/menu.pdf?x=1')).toBe(true)
    expect(isAllowedByRobots(txt, '/private-stuff/x')).toBe(false)
    expect(isAllowedByRobots(txt, '/')).toBe(true)
  })

  it('shares one group across consecutive user-agent lines and skips comments', () => {
    const txt = '# hi\nUser-agent: foo\nUser-agent: *  # everyone\nDisallow: /x\n'
    expect(isAllowedByRobots(txt, '/x/y')).toBe(false)
  })
})
