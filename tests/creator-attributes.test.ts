// =============================================================================
// lib/listings/creatorAttributes.ts: creator filter caps and the tag limit
// (ticket 132)
// =============================================================================
// [Decision - founder, 2026-10-08] Creator niche, platform and audience tags
// don't count toward the Free plan's 3-tag limit. Niche is capped at 3 and
// audience size at 1. Other types never save creator groups.
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  CREATOR_GROUP_SLUGS,
  creatorChecklistFacts,
  isCreatorGroup,
  splitAttributePicks,
  type AttributePick,
  type CreatorChecklistInput,
} from '@/lib/listings/creatorAttributes'
import { checkAttributeCount } from '@/lib/stripe/planChecks'

const pick = (id: string, groupSlug: string): AttributePick => ({ id, groupSlug })
const niches = (n: number) => Array.from({ length: n }, (_, i) => pick(`n${i}`, 'creator-niche'))

describe('isCreatorGroup', () => {
  it('knows the three creator groups and nothing else', () => {
    expect(CREATOR_GROUP_SLUGS).toEqual(['creator-niche', 'creator-platforms', 'audience-size'])
    for (const slug of CREATOR_GROUP_SLUGS) expect(isCreatorGroup(slug)).toBe(true)
    expect(isCreatorGroup('identity')).toBe(false)
    expect(isCreatorGroup('')).toBe(false)
  })
})

describe('splitAttributePicks', () => {
  it('drops creator groups from a business page', () => {
    const r = splitAttributePicks(
      [pick('a', 'identity'), pick('n', 'creator-niche'), pick('s', 'audience-size')],
      'business'
    )
    expect(r.kept.map((p) => p.id)).toEqual(['a'])
    expect(r.planCount).toBe(1)
    expect(r.problem).toBeNull()
  })

  it('keeps creator groups on a creator page and leaves them out of the plan count', () => {
    const r = splitAttributePicks(
      [
        pick('a', 'identity'),
        ...niches(3),
        pick('p1', 'creator-platforms'),
        pick('p2', 'creator-platforms'),
        pick('p3', 'creator-platforms'),
        pick('p4', 'creator-platforms'),
        pick('s', 'audience-size'),
      ],
      'creator'
    )
    expect(r.kept).toHaveLength(9)
    expect(r.planCount).toBe(1)
    expect(r.problem).toBeNull()
  })

  it('caps niche at 3', () => {
    expect(splitAttributePicks(niches(4), 'creator').problem).toBe('Pick up to 3 niches.')
  })

  it('caps audience size at 1', () => {
    const r = splitAttributePicks(
      [pick('s1', 'audience-size'), pick('s2', 'audience-size')],
      'creator'
    )
    expect(r.problem).toBe('Pick one audience size.')
  })

  it('does not cap platforms', () => {
    const many = Array.from({ length: 9 }, (_, i) => pick(`p${i}`, 'creator-platforms'))
    expect(splitAttributePicks(many, 'creator').problem).toBeNull()
  })

  it('treats a missing type as not a creator', () => {
    expect(splitAttributePicks(niches(2), null).kept).toEqual([])
  })
})

describe('the Free tag limit with creator tags', () => {
  it('a Free creator with 3 tags plus every creator pick is within the limit', () => {
    const r = splitAttributePicks(
      [pick('a', 'identity'), pick('b', 'identity'), pick('c', 'identity'), ...niches(3)],
      'creator'
    )
    expect(checkAttributeCount('free', r.planCount, 0)).toBeNull()
  })

  it('a Free creator with 4 ordinary tags is still over it', () => {
    const r = splitAttributePicks(
      ['a', 'b', 'c', 'd'].map((id) => pick(id, 'identity')),
      'creator'
    )
    expect(checkAttributeCount('free', r.planCount, 0)).not.toBeNull()
  })
})

describe('creatorChecklistFacts', () => {
  const groups = [
    { slug: 'creator-niche', values: [{ id: 'n1' }, { id: 'n2' }] },
    { slug: 'creator-platforms', values: [{ id: 'p1' }] },
  ]
  const base: Omit<CreatorChecklistInput, 'selectedValueIds'> = {
    attributeGroups: groups,
    videoEmbedUrl: null,
    videoPath: null,
    links: [],
  }

  it('counts only niche picks', () => {
    expect(creatorChecklistFacts({ ...base, selectedValueIds: ['n1', 'p1', 'n2'] }).nicheCount).toBe(2)
    expect(creatorChecklistFacts({ ...base, selectedValueIds: ['p1'] }).nicheCount).toBe(0)
  })

  it('has no sample without a video or link', () => {
    expect(creatorChecklistFacts({ ...base, selectedValueIds: [] }).hasSample).toBe(false)
  })

  it('a video embed, an uploaded video or a link counts as a sample', () => {
    const facts = (extra: Partial<typeof base>) =>
      creatorChecklistFacts({ ...base, selectedValueIds: [], ...extra }).hasSample
    expect(facts({ videoEmbedUrl: 'https://youtu.be/x' })).toBe(true)
    expect(facts({ videoPath: 'listing/video.mp4' })).toBe(true)
    expect(facts({ links: [{}] })).toBe(true)
  })

  it('copes with a database that has no niche group yet', () => {
    expect(
      creatorChecklistFacts({ ...base, attributeGroups: [], selectedValueIds: ['n1'] }).nicheCount
    ).toBe(0)
  })
})
