/**
 * Seeds for a new business draft (ticket 126).
 *
 * The quick start asks "What do you do?" once. That answer is the about text,
 * and its first sentence is the tagline unless the owner wrote their own one
 * line. Both stay editable on the finish page.
 */

const TAGLINE_MAX = 120

/** First sentence of `text`, cut at a word boundary to fit `max`. */
export function firstSentence(text: string, max = TAGLINE_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const match = clean.match(/^.+?[.!?](?=\s|$)/)
  const sentence = (match ? match[0] : clean).trim()
  if (sentence.length <= max) return sentence
  const cut = sentence.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, '')}…`
}

/**
 * The old form had a separate founder story box and dropped it on save. There
 * is no column for it, so it joins the about text as its own paragraph.
 */
export function foldFounderStory(description: string, founderStory: string | null): string {
  const story = founderStory?.trim()
  if (!story) return description
  if (description.includes(story)) return description
  return description ? `${description}\n\n${story}` : story
}
