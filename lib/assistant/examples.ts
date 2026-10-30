/**
 * Example asks for Cue (ticket 148), written the way a visitor would text a
 * friend. The home bar and the Cue panel show one as placeholder text, picked
 * at random after the page loads, so the server and the first client render
 * agree on EXAMPLE_ASKS[0].
 *
 * Every ask here must get a real answer on prod data. Check them on a Preview
 * before changing the list.
 */

export const EXAMPLE_ASKS = [
  'Where can I get braids in Atlanta?',
  'I need a dentist near me',
  'Help me plan a party in Detroit',
  'Who sells Black-owned produce in Chicago?',
  'How do I switch to Black-owned bath products?',
  "Somewhere for soul food that's open now",
  'Find me a barber close by',
  'Any good coffee shops in Houston?',
  'I want a gift from a local maker',
  'Who does catering in Washington DC?',
] as const

/** A random example. `random` is a seam for tests. */
export function pickExample(random: () => number = Math.random): string {
  const i = Math.floor(random() * EXAMPLE_ASKS.length)
  return EXAMPLE_ASKS[Math.min(Math.max(i, 0), EXAMPLE_ASKS.length - 1)] ?? EXAMPLE_ASKS[0]
}

/** Three different examples for the empty panel, starting at a random one. */
export function pickExamples(count = 3, random: () => number = Math.random): string[] {
  const start = Math.floor(random() * EXAMPLE_ASKS.length)
  const picks: string[] = []
  for (let i = 0; i < Math.min(count, EXAMPLE_ASKS.length); i++) {
    picks.push(EXAMPLE_ASKS[(Math.max(start, 0) + i) % EXAMPLE_ASKS.length] ?? EXAMPLE_ASKS[0])
  }
  return picks
}
