// The kind label on a BLACQLight story ("Founder story", "Profile", ...).
// There is no kind column: the label comes from the article's tags. The first
// tag that names a known kind wins; a story with no matching tag shows no label
// rather than a guessed one. Spec: page-workshop-2026-10-spec.md §3.

export type EditorialKind = 'Founder story' | 'Profile' | 'Movement' | 'Guide'

const KIND_BY_TAG: Record<string, EditorialKind> = {
  founder: 'Founder story',
  founders: 'Founder story',
  'founder story': 'Founder story',
  profile: 'Profile',
  profiles: 'Profile',
  movement: 'Movement',
  movements: 'Movement',
  guide: 'Guide',
  guides: 'Guide',
}

export function editorialKind(tags: readonly string[] | null | undefined): EditorialKind | null {
  for (const tag of tags ?? []) {
    const kind = KIND_BY_TAG[tag.trim().toLowerCase()]
    if (kind) return kind
  }
  return null
}
